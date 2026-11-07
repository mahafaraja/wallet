/**
 * BACKUP CODEC — the versioned JSON envelope for every backup, local or cloud.
 *
 * Format:
 * {
 *   "app": "pocket-ledger",
 *   "schemaVersion": 1,
 *   "createdAt": "2026-04-30T09:00:00.000Z",
 *   "revision": 1714467600001,
 *   "counts": { "transactions": 214, ... },
 *   "records": { "accounts": [...], "transactions": [...], ... }
 * }
 *
 * `schemaVersion` exists so a future app version can migrate an old backup
 * instead of failing on it. Restoring a newer format into an older app is
 * refused rather than partially applied.
 */

import { db, TABLE_NAMES } from "@/db/database";
import type { DatabaseRecords } from "@/db/schema";
import { getSyncMetadata } from "@/data/repository";

export const APP_ID = "pocket-ledger";
export const SCHEMA_VERSION = 1;
export const BACKUP_FOLDER_NAME = "Personal Finance Backups";

export type BackupHeader = {
  app: string;
  schemaVersion: number;
  createdAt: string;
  revision: number;
  counts: Record<string, number>;
};

export type BackupPayload = BackupHeader & { records: DatabaseRecords };

export type CodecResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; error: string };

/** Read every table into a deterministic, transportable payload. */
export async function buildBackup(): Promise<BackupPayload> {
  const records = {} as DatabaseRecords;
  const counts: Record<string, number> = {};

  for (const name of TABLE_NAMES) {
    const rows = await db.table(name).toArray();
    (records as Record<string, unknown>)[name] = rows;
    counts[name] = rows.length;
  }

  const meta = await getSyncMetadata("revision");

  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    revision: typeof meta?.value === "number" ? meta.value : Date.now(),
    counts,
    records,
  };
}

/** Strict validation — never import something we only half understand. */
export function parseBackup(text: string): CodecResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "That file is not a backup object." };
  }

  const candidate = parsed as Partial<BackupPayload> & { app?: string };

  if (candidate.app !== APP_ID) {
    return { ok: false, error: `This backup was made by "${candidate.app ?? "an unknown app"}", not Pocket Ledger.` };
  }

  if (typeof candidate.schemaVersion !== "number") {
    return { ok: false, error: "This backup does not declare a schema version." };
  }

  if (candidate.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This backup uses schema version ${candidate.schemaVersion}, which is newer than this app supports (${SCHEMA_VERSION}). Update Pocket Ledger before restoring.`,
    };
  }

  if (typeof candidate.records !== "object" || candidate.records === null) {
    return { ok: false, error: "This backup contains no records." };
  }

  // Validate the shape of each table before anything is written.
  for (const name of TABLE_NAMES) {
    const rows = (candidate.records as Record<string, unknown>)[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      return { ok: false, error: `The "${name}" section of this backup is malformed.` };
    }
    for (const row of rows) {
      if (typeof row !== "object" || row === null || !("id" in row)) {
        return { ok: false, error: `A record in "${name}" is missing its identifier.` };
      }
    }
  }

  const transactions = (candidate.records as Record<string, unknown>).transactions as
    | Array<Record<string, unknown>>
    | undefined;
  if (transactions) {
    for (const tx of transactions) {
      if (typeof tx.amountMinor !== "number" || !Number.isInteger(tx.amountMinor)) {
        return { ok: false, error: "A transaction in this backup has a non-integer amount, which cannot be trusted." };
      }
    }
  }

  return {
    ok: true,
    payload: {
      app: APP_ID,
      schemaVersion: candidate.schemaVersion,
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      revision: typeof candidate.revision === "number" ? candidate.revision : 0,
      counts: candidate.counts ?? {},
      records: candidate.records as DatabaseRecords,
    },
  };
}

/** Serialise deterministically so identical data produces identical bytes. */
export function encodeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** File name used by both the local export and the planned Drive upload. */
export function backupFilename(iso = new Date().toISOString()): string {
  return `pocket-ledger-backup-${iso.replace(/[:.]/g, "-")}.json`;
}

export function describePayload(payload: BackupPayload): string {
  const r = payload.records;
  const parts = [
    r.transactions.length ? `${r.transactions.length} transactions` : null,
    r.accounts.length ? `${r.accounts.length} accounts` : null,
    r.budgets.length ? `${r.budgets.length} budgets` : null,
    r.goals.length ? `${r.goals.length} goals` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "no records";
}
