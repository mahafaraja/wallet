/**
 * SYNC MANAGER
 *
 * Orchestrates backup, restore and conflict handling. The UI talks only to
 * this module, never to an adapter directly, so swapping the local-file
 * adapter for Google Drive later is invisible to every screen.
 */

import type { DatabaseRecords } from "@/db/schema";
import type { BackupManifest, ConflictReport, SyncAdapter } from "@/data/sync/adapter";
import { detectConflict, mergeRecords } from "@/data/sync/adapter";
import { driveAdapter, localFileAdapter } from "@/data/sync/adapters";
import {
  backupFilename,
  buildBackup,
  describePayload,
  encodeBackup,
  parseBackup,
  type BackupPayload,
} from "@/data/sync/backupCodec";
import { getSyncMetadata, replaceAll, setSyncMetadata } from "@/data/repository";

export { driveAdapter, localFileAdapter };

export type RestorePlan =
  | { action: "restore"; payload: BackupPayload; summary: string }
  | { action: "merge"; payload: BackupPayload; conflict: ConflictReport }
  | { action: "reject"; reason: string };

/** Read a candidate backup file and decide what to do with it. */
export async function planRestore(file: File): Promise<RestorePlan> {
  const text = await file.text();
  const parsed = parseBackup(text);
  if (!parsed.ok) return { action: "reject", reason: parsed.error };

  const incoming = parsed.payload;
  const localPayload = await buildBackup();

  const conflict = detectConflict(
    {
      records: localPayload.records,
      revision: localPayload.revision,
      changedAt: localPayload.createdAt,
    },
    {
      records: incoming.records,
      revision: incoming.revision,
      changedAt: incoming.createdAt,
    },
  );

  // Nothing here that the device does not already have: safe to restore.
  if (conflict.localOnly.length === 0 && conflict.diverged.length === 0) {
    return {
      action: "restore",
      payload: incoming,
      summary: `This backup holds ${describePayload(incoming)}. Restoring it will replace what is on this device.`,
    };
  }

  // Local data would be lost — surface the conflict and let the user choose.
  return {
    action: "merge",
    payload: incoming,
    conflict: {
      ...conflict,
      summary: `${conflict.summary} You can merge both copies without losing anything, or replace this device entirely.`,
    },
  };
}

/** Restore by replacement. Destructive to local-only records, so always confirmed first. */
export async function restoreBackup(payload: BackupPayload): Promise<void> {
  await replaceAll(payload.records);
  await setSyncMetadata("revision", payload.revision);
  await setSyncMetadata("lastRestoredAt", new Date().toISOString());
}

/** Merge local and backup. No record is ever dropped. */
export async function mergeBackup(payload: BackupPayload): Promise<void> {
  const localPayload = await buildBackup();
  const merged = mergeRecords(localPayload.records, payload.records);
  await replaceAll(merged);
  await setSyncMetadata("revision", Math.max(localPayload.revision, payload.revision));
  await setSyncMetadata("lastMergedAt", new Date().toISOString());
}

/** Build and download a JSON backup. Returns the manifest for confirmation UI. */
export async function exportToFile(): Promise<{ manifest: BackupManifest; filename: string }> {
  const payload = await buildBackup();
  const filename = backupFilename(payload.createdAt);
  const blob = new Blob([encodeBackup(payload)], { type: "application/json" });

  // Object URL is revoked on the next tick; the browser has the download by then.
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  await setSyncMetadata("lastExportedAt", payload.createdAt);

  return {
    filename,
    manifest: {
      id: filename,
      label: `Exported ${new Date(payload.createdAt).toLocaleString()}`,
      createdAt: payload.createdAt,
      revision: payload.revision,
      sizeBytes: blob.size,
      schemaVersion: payload.schemaVersion,
    },
  };
}

/** Highest record revision currently held locally. */
export async function localRevision(): Promise<number> {
  const meta = await getSyncMetadata("revision");
  return typeof meta?.value === "number" ? meta.value : 0;
}

/** Honest status for the Settings screen. No simulated connections. */
export function describeSync(): {
  cloud: { label: string; connected: boolean; detail: string; plannedFolder: string; scope: string };
  local: { label: string; detail: string; available: boolean };
} {
  const cloudStatus = driveAdapter.status();
  return {
    cloud: {
      label: driveAdapter.label,
      connected: cloudStatus.state === "connected",
      detail: cloudStatus.state === "disconnected" ? cloudStatus.detail : "",
      plannedFolder: "Personal Finance Backups",
      scope: "drive.file (narrow — only files this app creates)",
    },
    local: {
      label: localFileAdapter.label,
      detail: "Export and import a JSON backup of everything, any time.",
      available: localFileAdapter.available,
    },
  };
}

/** All known adapters, for rendering the future-facing sync list. */
export function availableAdapters(): SyncAdapter[] {
  return [driveAdapter, localFileAdapter];
}

export type { DatabaseRecords, BackupPayload };
