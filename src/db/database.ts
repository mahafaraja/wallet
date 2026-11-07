/**
 * Dexie database instance and table wiring.
 *
 * IndexedDB is the immediate working database. Google Drive is a future
 * destination handled by the sync adapters in src/data/sync — nothing here
 * knows or cares about it.
 */

import Dexie, { type Table } from "dexie";
import type {
  Account,
  Budget,
  Category,
  GoalContribution,
  PreferenceRow,
  RecurringTransaction,
  SavingsGoal,
  SyncMetadataRow,
  Transaction,
} from "@/db/schema";

export class PocketLedgerDatabase extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<SavingsGoal, string>;
  goalContributions!: Table<GoalContribution, string>;
  recurring!: Table<RecurringTransaction, string>;
  preferences!: Table<PreferenceRow, string>;
  syncMetadata!: Table<SyncMetadataRow, string>;

  constructor() {
    super("pocket-ledger");

    // Compound indices exist to serve the exact queries the repository issues,
    // so filtering a large transaction list never degrades to a table scan.
    this.version(1).stores({
      accounts: "id, name, type, currency, archived, sortOrder",
      categories: "id, name, kind, isCustom, [kind+name]",
      transactions:
        "id, date, type, accountId, toAccountId, categoryId, currency, revision, [date+type], [accountId+date], [categoryId+date]",
      budgets: "id, categoryId, currency, startsOn, [categoryId+startsOn]",
      goals: "id, currency, archived, targetDate",
      goalContributions: "id, goalId, date, transactionId, [goalId+date]",
      recurring: "id, nextDate, active, accountId",
      preferences: "key",
      syncMetadata: "key",
    });
  }
}

export const db = new PocketLedgerDatabase();

/** Table names, used by the backup codec to iterate deterministically. */
export const TABLE_NAMES = [
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "goals",
  "goalContributions",
  "recurring",
  "preferences",
  "syncMetadata",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
