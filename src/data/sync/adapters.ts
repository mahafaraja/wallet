/**
 * GOOGLE DRIVE ADAPTER — STUB, DELIBERATELY NOT CONNECTED
 *
 * This file exists so the sync architecture is real rather than aspirational:
 * the interface is implemented, the intended API surface is documented, and
 * every method reports honestly that it is not available. It never pretends to
 * succeed and never touches the network.
 *
 * Turning it on later means filling in the four private helpers at the bottom
 * and flipping `available` to true. No screen or calculation changes.
 */

import type {
  BackupManifest,
  DatabaseRecords,
  SyncAdapter,
  SyncSession,
  SyncStatus,
} from "@/data/sync/adapter";
import { NotConnectedError } from "@/data/sync/adapter";
import { BACKUP_FOLDER_NAME } from "@/data/sync/backupCodec";

/** Narrow OAuth scope: only files this app created are reachable. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

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
    "Keep a versioned backup of your ledger in a folder in your own Google Drive. Planned, not yet connected.";
  /** False until the Drive implementation is written and enabled. */
  readonly available = false;

  status(): SyncStatus {
    return {
      state: "disconnected",
      detail:
        "Cloud backup is designed but not switched on. Your data is stored on this device and can be exported as a JSON file at any time.",
    };
  }

  async connect(): Promise<SyncSession> {
    throw new NotConnectedError(this.id);
  }

  async disconnect(): Promise<void> {
    // Nothing to disconnect while the adapter is unavailable.
  }

  async listBackups(): Promise<BackupManifest[]> {
    throw new NotConnectedError(this.id);
  }

  async download(): Promise<DatabaseRecords> {
    throw new NotConnectedError(this.id);
  }

  async upload(): Promise<BackupManifest> {
    throw new NotConnectedError(this.id);
  }

  /** Intended destination, surfaced in the UI so expectations are set early. */
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
