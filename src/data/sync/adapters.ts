/**
 * GOOGLE DRIVE ADAPTER — LIVE IMPLEMENTATION
 *
 * Connects to Google Drive using the narrow drive.file OAuth scope. Backups
 * live in a visible "Personal Finance Backups" folder that the user can open
 * in the Drive UI at any time.
 *
 * LocalFileSyncAdapter below handles offline export/import and is unchanged.
 */

import type {
  BackupManifest,
  DatabaseRecords,
  SyncAdapter,
  SyncSession,
  SyncStatus,
} from "@/data/sync/adapter";
import { NotConnectedError } from "@/data/sync/adapter";
import {
  BACKUP_FOLDER_NAME,
  connectDrive,
  disconnectDrive,
  downloadDriveFile,
  driveRequest,
  ensureBackupFolder,
  isAuthenticated,
  isConfigured,
  listDriveBackups,
  uploadDriveFile,
  DRIVE_SCOPE as DRIVE_SCOPE_CONST,
} from "@/data/sync/driveAuth";
import { buildBackup, backupFilename, encodeBackup, parseBackup } from "@/data/sync/backupCodec";

/** Narrow OAuth scope: only files this app created are reachable. */
export const DRIVE_SCOPE = DRIVE_SCOPE_CONST;

/** Planned REST endpoints, documented here so the contract is unambiguous. */
export const DRIVE_ENDPOINTS = {
  createFolder: "POST https://www.googleapis.com/drive/v3/files",
  listFiles: "GET https://www.googleapis.com/drive/v3/files",
  uploadMedia: "PATCH https://www.googleapis.com/upload/drive/v3/files/{id}",
  createFile: "POST https://www.googleapis.com/upload/drive/v3/files",
  download: "GET https://www.googleapis.com/drive/v3/files/{id}?alt=media",
  trash: "PATCH https://www.googleapis.com/drive/v3/files/{id}",
} as const;

export class DriveSyncAdapter implements SyncAdapter {
  readonly id = "google-drive";
  readonly label = "Google Drive";
  readonly description =
    "Keep a versioned backup of your ledger in a folder in your own Google Drive. " +
    "Backups are plain JSON files in a visible Drive folder.";

  /** True when the OAuth client is configured. */
  readonly available: boolean;

  constructor() {
    this.available = isConfigured();
  }

  status(): SyncStatus {
    if (!isConfigured()) {
      return {
        state: "disconnected",
        detail:
          "Google Drive is not configured. Add VITE_GOOGLE_DRIVE_CLIENT_ID to .env.",
      };
    }
    if (isAuthenticated()) {
      return {
        state: "connected",
        adapterId: this.id,
        lastSyncedAt: null,
      };
    }
    return {
      state: "disconnected",
      detail: "Not connected to Google Drive. Click Connect to sign in.",
    };
  }

  async connect(): Promise<SyncSession> {
    const session = await connectDrive();
    return {
      accountLabel: session.accountLabel,
      destination: `Google Drive › "${BACKUP_FOLDER_NAME}" folder`,
    };
  }

  async disconnect(): Promise<void> {
    await disconnectDrive();
  }

  async listBackups(): Promise<BackupManifest[]> {
    if (!isAuthenticated()) throw new NotConnectedError(this.id);
    const manifests = await listDriveBackups();
    const enriched: BackupManifest[] = [];
    for (const m of manifests) {
      try {
        const text = await downloadDriveFile(m.id);
        const parsed = JSON.parse(text);
        enriched.push({ ...m, revision: typeof parsed.revision === "number" ? parsed.revision : 0 });
      } catch {
        enriched.push(m);
      }
    }
    return enriched;
  }

  async download(id: string): Promise<DatabaseRecords> {
    if (!isAuthenticated()) throw new NotConnectedError(this.id);
    const text = await downloadDriveFile(id);
    const result = parseBackup(text);
    if (!result.ok) throw new Error(result.error);
    return result.payload.records;
  }

  async upload(records: DatabaseRecords): Promise<BackupManifest> {
    if (!isAuthenticated()) throw new NotConnectedError(this.id);

    const payload = await buildBackup();
    payload.records = records;

    const content = encodeBackup(payload);
    const filename = backupFilename(payload.createdAt);

    const existing = await this.findBackupByName(filename);
    const manifest = await uploadDriveFile(filename, content, existing?.id);

    return manifest;
  }

  private async findBackupByName(filename: string): Promise<{ id: string } | undefined> {
    const folderId = await ensureBackupFolder();
    const q = encodeURIComponent(
      `name = '${filename}' and '${folderId}' in parents and trashed = false`,
    );
    const res = await driveRequest(`/files?q=${q}&fields=files(id,name)`);
    const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
    return data.files?.[0];
  }

  static get plannedFolder(): string {
    return BACKUP_FOLDER_NAME;
  }

  static get plannedScope(): string {
    return DRIVE_SCOPE;
  }
}

/**
 * LOCAL FILE ADAPTER
 *
 * Functional today. Exposes export/import as the same interface the Drive
 * adapter will use, so the Settings screen does not need a separate code path
 * once cloud backup arrives.
 */
export class LocalFileSyncAdapter implements SyncAdapter {
  readonly id = "local-file";
  readonly label = "Device file";
  readonly description =
    "Export your complete ledger as a JSON file, or restore from one. Works entirely offline.";
  readonly available = true;

  status(): SyncStatus {
    return { state: "disconnected", detail: "On-demand file export and import. Nothing leaves this device." };
  }

  async connect(): Promise<SyncSession> {
    return { accountLabel: "This device", destination: "A JSON file you choose where to save" };
  }

  async disconnect(): Promise<void> {}

  async listBackups(): Promise<BackupManifest[]> {
    // The browser cannot enumerate the user's filesystem, and should not.
    return [];
  }

  async download(): Promise<DatabaseRecords> {
    throw new NotConnectedError(this.id);
  }

  async upload(): Promise<BackupManifest> {
    throw new NotConnectedError(this.id);
  }
}

export const driveAdapter = new DriveSyncAdapter();
export const localFileAdapter = new LocalFileSyncAdapter();

/** Every backup destination the app knows about, in display order. */
export const SYNC_ADAPTERS: SyncAdapter[] = [driveAdapter, localFileAdapter];
