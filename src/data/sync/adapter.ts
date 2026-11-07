/**
 * SYNCHRONISATION ARCHITECTURE
 * ============================================================================
 *
 * INTENDED LONG-TERM DESIGN (not yet enabled):
 *
 *   IndexedDB  ──►  Google Drive folder "Personal Finance Backups"
 *   (working)       (persistent, user-owned, visible in the Drive UI)
 *
 * This module defines the CONTRACT only. No authentication, no network calls,
 * no simulated success. The Google Drive implementation plugs in later without
 * touching a single screen or calculation.
 *
 * ---------------------------------------------------------------------------
 * WHY AN ADAPTER INTERFACE
 *
 * Everything the UI needs from a backup destination is expressed below. Local
 * JSON export/import already satisfies it, so "cloud backup" is a matter of
 * adding a class — not rewriting the app.
 *
 * ---------------------------------------------------------------------------
 * PLANNED GOOGLE DRIVE MAPPING  (documented for the future implementation)
 *
 *   OAuth scope   : https://www.googleapis.com/auth/drive.file
 *                   NARROW — grants access only to files this app created.
 *                   Nothing else in the user's Drive is reachable.
 *   Backup folder : a user-visible Drive folder named
 *                   "Personal Finance Backups". Deliberately NOT appDataFolder,
 *                   because a hidden folder cannot be the only permanent home
 *                   for financial records the user may need to recover by hand.
 *   File naming   : pocket-ledger-backup-<ISO-timestamp>.json
 *   Format        : the versioned payload produced by backupCodec.ts
 *   List          : GET /drive/v3/files?q='<folderId>'+in+parents+and+trashed=false
 *   Download      : GET /drive/v3/files/<id>?alt=media
 *   Upload        : PATCH for an existing revision, POST for a new file
 *   Conflict rule : compare `revision` clocks; never overwrite a newer remote
 *                   record without asking. See resolveConflict() below.
 * ---------------------------------------------------------------------------
 */

import type { DatabaseRecords } from "@/db/schema";

export type { DatabaseRecords };

/** Monotonic clock used to decide which copy of a record is newer. */
export type Revision = number;

export type BackupManifest = {
  /** Adapter-specific identifier (a Drive file id, or a filename locally). */
  id: string;
  label: string;
  createdAt: string;
  /** Highest record revision contained in this backup. */
  revision: Revision;
  /** Approximate byte size, when the adapter can know it. */
  sizeBytes?: number;
  schemaVersion: number;
};

export type SyncStatus =
  | { state: "disconnected"; detail: string }
  | { state: "connecting" }
  | { state: "connected"; adapterId: string; lastSyncedAt: string | null };

export type SyncSession = {
  /** Stable identity for the signed-in storage account. Not an app login. */
  accountLabel: string;
  /** Human-readable description of where data will live. */
  destination: string;
};

/** Thrown when an operation needs a connection that does not exist yet. */
export class NotConnectedError extends Error {
  constructor(adapterId: string) {
    super(
      `The "${adapterId}" backup destination is not connected. ` +
        `Cloud synchronisation is planned but deliberately not enabled in this version.`,
    );
    this.name = "NotConnectedError";
  }
}

/**
 * The contract every backup destination must satisfy.
 *
 * NOTE on `connect()`: it is present so the interface is complete for the
 * future Drive implementation. Nothing in this version calls it.
 */
export interface SyncAdapter {
  readonly id: string;
  readonly label: string;
  /** One-line explanation shown in the UI so the user knows what this does. */
  readonly description: string;
  /** False for every adapter until synchronisation is switched on. */
  readonly available: boolean;

  status(): SyncStatus;
  /** Establishes a storage session. Unimplemented in this version. */
  connect(): Promise<SyncSession>;
  disconnect(): Promise<void>;

  listBackups(): Promise<BackupManifest[]>;
  download(id: string): Promise<DatabaseRecords>;
  upload(records: DatabaseRecords): Promise<BackupManifest>;
  remove?(id: string): Promise<void>;
}

/* ==========================================================================
   Conflict resolution
   ========================================================================== */

export type ConflictSide = "local" | "remote";

export type ConflictReport = {
  /** True when both sides changed since the last agreed snapshot. */
  conflicted: boolean;
  localRevision: Revision;
  remoteRevision: Revision;
  localChangedAt: string | null;
  remoteChangedAt: string | null;
  /** Records present on one side only. */
  localOnly: string[];
  remoteOnly: string[];
  /** Records with a newer revision on each side. */
  diverged: string[];
  /** Safe recommendation, presented to the user as the default. */
  recommendation: ConflictSide | "merge";
  summary: string;
};

/** Compare a local snapshot against a candidate backup. */
export function detectConflict(
  local: { records: DatabaseRecords; revision: Revision; changedAt: string | null },
  remote: { records: DatabaseRecords; revision: Revision; changedAt: string | null },
): ConflictReport {
  const localIds = collectIds(local.records);
  const remoteIds = collectIds(remote.records);

  const localOnly = [...localIds].filter((id) => !remoteIds.has(id));
  const remoteOnly = [...remoteIds].filter((id) => !localIds.has(id));

  // A record has diverged when it exists on both sides under different revisions.
  const diverged: string[] = [];
  for (const table of ["transactions", "accounts", "goals", "budgets", "goalContributions"] as const) {
    const localRows = local.records[table] as Array<{ id: string; revision: number }>;
    const remoteRows = remote.records[table] as Array<{ id: string; revision: number }>;
    const remoteBy = new Map(remoteRows.map((r) => [r.id, r.revision]));
    for (const row of localRows) {
      const other = remoteBy.get(row.id);
      if (other !== undefined && other !== row.revision) diverged.push(row.id);
    }
  }

  // Which side advanced past the other. Both advancing is a genuine conflict,
  // but so is any single-record divergence — the safest test is per-record.
  const conflicted = diverged.length > 0 || (localOnly.length > 0 && remoteOnly.length > 0);

  let recommendation: ConflictSide | "merge" = "merge";
  if (localOnly.length > 0 && remoteOnly.length === 0 && diverged.length === 0) recommendation = "local";
  else if (remoteOnly.length > 0 && localOnly.length === 0 && diverged.length === 0) recommendation = "remote";

  const summary =
    diverged.length > 0
      ? `${diverged.length} ${diverged.length === 1 ? "record has" : "records have"} been changed in both places.`
      : localOnly.length > 0 && remoteOnly.length > 0
        ? `You have ${localOnly.length} new ${localOnly.length === 1 ? "record" : "records"} and the backup has ${remoteOnly.length}.`
        : remoteOnly.length > 0
          ? `The backup contains ${remoteOnly.length} ${remoteOnly.length === 1 ? "record" : "records"} you do not have.`
          : "No differences were found.";

  return {
    conflicted,
    localRevision: local.revision,
    remoteRevision: remote.revision,
    localChangedAt: local.changedAt,
    remoteChangedAt: remote.changedAt,
    localOnly,
    remoteOnly,
    diverged,
    recommendation,
    summary,
  };
}

function collectIds(records: DatabaseRecords): Set<string> {
  const ids = new Set<string>();
  for (const key of Object.keys(records) as (keyof DatabaseRecords)[]) {
    const rows = records[key] as Array<{ id?: string }>;
    if (Array.isArray(rows)) for (const row of rows) if (row?.id) ids.add(row.id);
  }
  return ids;
}

/**
 * Merge strategy: never drop a record.
 *
 * For each table, keep the row with the HIGHER revision, and include rows that
 * exist on only one side. This is safe because revisions are monotonic
 * timestamps, so "higher" always means "written later".
 */
export function mergeRecords(local: DatabaseRecords, remote: DatabaseRecords): DatabaseRecords {
  const merged = { ...local } as DatabaseRecords;

  for (const key of Object.keys(remote) as (keyof DatabaseRecords)[]) {
    const localRows = (local[key] ?? []) as Array<{ id: string; revision: number }>;
    const remoteRows = (remote[key] ?? []) as Array<{ id: string; revision: number }>;
    const byId = new Map(localRows.map((r) => [r.id, r]));

    for (const row of remoteRows) {
      const existing = byId.get(row.id);
      if (!existing || row.revision > existing.revision) byId.set(row.id, row);
    }

    (merged as Record<string, unknown>)[key] = [...byId.values()];
  }

  return merged;
}
