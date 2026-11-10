# 05 · Storage, backup and sync

[← Documentation index](README.md)

## The four different things that may be called a “backup”

| Item | Contains | Does not contain |
| --- | --- | --- |
| **IndexedDB** | The current browser's financial records and preferences | A copy on another device or a guaranteed permanent backup |
| **JSON export** | An application snapshot of IndexedDB records and metadata | Source code or Git commits |
| **Git bundle / GitHub repo** | Committed source code and Git history | Financial records stored in the browser; uncommitted/ignored files |
| **Service-worker cache** | Cached application resources | A usable financial-data backup |

Google Drive synchronization and authentication are **not connected** in this version.

## Local IndexedDB

`src/db/database.ts` defines a Dexie database named `pocket-ledger`. Its nine stores and their keys are listed in [Data model and finance](04-data-model-and-finance.md). Dexie wraps the browser's IndexedDB; `useLiveQuery` lets React update when observed queries change.

Storage is scoped to the browser and **origin**: scheme, hostname and port. For example, `http://localhost:5173`, `http://localhost:3000`, and an HTTPS preview address are separate origins. Separate browsers or browser profiles also do not share a ledger automatically.

IndexedDB often persists across refresh and browser restarts, but it is not an independent backup. Clearing site data, private-browsing policies, device loss, storage pressure, or browser eviction can remove it. This application does not currently request persistent storage via `navigator.storage.persist()`. See [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## JSON export: current flow

1. In Settings, **Export JSON backup** invokes `exportToFile()` in `src/data/sync/syncManager.ts`.
2. `buildBackup()` in `backupCodec.ts` reads the stores and creates a versioned payload.
3. `encodeBackup()` serializes it as JSON; the browser downloads a file named like `pocket-ledger-backup-<timestamp>.json`.
4. A `lastExportedAt` entry is written to `syncMetadata` after the file is created.

The envelope has this shape (illustrative, not a complete valid restore file):

```json
{
  "app": "pocket-ledger",
  "schemaVersion": 1,
  "createdAt": "2026-11-07T12:00:00.000Z",
  "revision": 123456789,
  "counts": { "transactions": 2 },
  "records": { "accounts": [], "categories": [], "transactions": [] }
}
```

A real export also includes budgets, goals, contributions, recurring records, preferences and sync metadata. Exports are plain JSON and are **not encrypted** by the app. Protect files with device/storage access controls. The current code reads tables sequentially rather than taking one documented atomic snapshot across all stores; concurrent edits need further testing.

## Restore: known issue—do not assume it works

The Settings screen accepts a JSON file and calls `planRestore()`. That function calls `parseBackup()` before comparing local and incoming records. In the current `backupCodec.ts`, the validation loop requires an `id` on every row in every table, but `preferences` and `syncMetadata` rows use **`key`**, not `id`. Consequently, an otherwise normal export containing preferences can be rejected with a message such as:

> A record in "preferences" is missing its identifier.

This mismatch was reproduced while preparing the documentation. **Keep the original browser data and the exported JSON; do not delete the original or rely on restore until the importer is corrected and a round-trip test succeeds.**

Additional implementation limitations:

- `parseBackup()` does not comprehensively validate every record field and relationship.
- `mergeRecords()` treats every table as if it had `id` and `revision`, but preferences and sync metadata are keyed differently. They need a separate merge strategy.
- The function called `replaceAll()` uses `bulkPut()` and does not first clear all stores. The UI's “replace” wording therefore does not describe a strict replacement.
- Conflict detection compares selected ID-bearing tables and local revision values. It is not a complete multi-device conflict protocol and does not model deletions.
- The conflict dialog currently offers the action corresponding to the generated plan; it does not present a complete side-by-side choice of all conflict resolutions.

Do not change financial records manually inside an exported JSON file as a workaround. Future work should add round-trip tests, schema validation by store, transactional import, correct keyed-table handling, explicit merge/replace behavior, and a recovery strategy before presenting restore as reliable.

## Sync architecture: intended future direction

The code sketches a future, user-owned Google Drive backup:

```text
IndexedDB working copy
        ↓
versioned JSON + explicit conflict handling
        ↓
SyncAdapter interface
        ↓
Google Drive adapter → visible “Personal Finance Backups” folder
```

Relevant modules:

| File | Current role |
| --- | --- |
| `src/data/sync/adapter.ts` | `SyncAdapter` interface, status/manifest types, preliminary conflict and merge functions |
| `src/data/sync/adapters.ts` | `DriveSyncAdapter` stub and a `LocalFileSyncAdapter` placeholder |
| `src/data/sync/backupCodec.ts` | Versioned JSON encode/decode and table collection |
| `src/data/sync/syncManager.ts` | Direct local-file export plus restore planning/orchestration |
| `src/data/repository.ts` | `replaceAll()` and sync-metadata operations |

The local file export is implemented **directly by `syncManager.ts`**. Although a `LocalFileSyncAdapter` exists, its `upload()` and `download()` methods still throw `NotConnectedError`; it is not currently the working path for JSON export/import.

`DriveSyncAdapter.available` is `false`. Its connect, list, download and upload methods throw rather than faking a connection. The intended future OAuth permission is `https://www.googleapis.com/auth/drive.file`, subject to the eventual file-picker and folder workflow. The intended folder is visible in Drive rather than relying only on hidden `appDataFolder` storage. These are design intentions, not implemented guarantees.

## Authentication is a separate future concern

Application login would establish who the user is. Google Drive authorization would grant a particular app access to selected/app-created files. They are related, but they are not interchangeable. Neither is implemented here. There is no sign-in flow, token management, remote upload, background sync, or remote conflict resolution in the current product.

## Before moving between devices

1. Do not clear the old device's browser data or uninstall its app until a verified recovery process exists.
2. Export JSON and store the file securely, while remembering the current restore limitation.
3. Keep source code and Git history separately if you also need the project in VS Code.
4. Confirm storage and restore behavior on a disposable test dataset before trusting a new version.

A JSON export cannot be assumed to be restorable merely because the download succeeded.
