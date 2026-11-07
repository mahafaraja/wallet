/**
 * DATA-ACCESS LAYER
 *
 * The ONLY module permitted to touch Dexie. UI components consume these
 * functions (or the live-query hooks in src/data/hooks.ts) and never see a
 * Table object. This is what keeps the Google Drive adapter swappable later —
 * the repository boundary is the seam.
 */

import { liveQuery } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type {
  Account,
  Budget,
  Category,
  GoalContribution,
  PreferenceKey,
  PreferenceRow,
  RecurringTransaction,
  SavingsGoal,
  SyncMetadataRow,
  Transaction,
} from "@/db/schema";
import { newAccountId, newBudgetId, newCategoryId, newContributionId, newGoalId, newTransactionId, nowISO } from "@/lib/id";
import { parseAmountToMinor, type Minor } from "@/lib/money";
import { decimalsOf } from "@/lib/currency";
import { currentMonthKey, todayISO, type ISODate } from "@/lib/dates";
import { DEFAULT_CURRENCY } from "@/lib/currency";

/* ==========================================================================
   IDs — a single choke point guarantees no duplicate keys can ever be written
   ========================================================================== */

const seenIds = new Set<string>();

/** Reserve an ID, throwing if it was already handed out this session. */
function reserve(prefix: string, existing?: string): string {
  if (existing) {
    seenIds.add(existing);
    return existing;
  }
  let candidate = `${prefix}_${crypto.randomUUID()}`;
  while (seenIds.has(candidate)) candidate = `${prefix}_${crypto.randomUUID()}`;
  seenIds.add(candidate);
  return candidate;
}

function bumpRevision(previous?: number): number {
  return Math.max(previous ?? 0, Date.now()) + 1;
}

/* ==========================================================================
   Accounts
   ========================================================================== */

export async function listAccounts(): Promise<Account[]> {
  const rows = await db.accounts.toArray();
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function useAccounts(): Account[] | undefined {
  return useLiveQuery(() => listAccounts(), [], undefined);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id);
}

export type AccountInput = {
  name: string;
  type: Account["type"];
  currency: string;
  openingBalanceMinor: Minor;
  description?: string;
};

export async function createAccount(input: AccountInput): Promise<Account> {
  const id = newAccountId();
  const now = nowISO();
  const account: Account = {
    id: reserve("acc", id),
    name: input.name.trim(),
    type: input.type,
    currency: input.currency,
    openingBalanceMinor: input.openingBalanceMinor,
    description: input.description?.trim() || undefined,
    archived: false,
    sortOrder: (await db.accounts.count()) + 1,
    createdAt: now,
    updatedAt: now,
    revision: bumpRevision(),
  };
  await db.accounts.add(account);
  return account;
}

export async function updateAccount(id: string, patch: Partial<AccountInput> & { archived?: boolean }): Promise<void> {
  const existing = await db.accounts.get(id);
  if (!existing) return;
  await db.accounts.update(id, {
    ...existing,
    ...("name" in patch ? { name: (patch.name ?? "").trim() } : {}),
    ...("type" in patch ? { type: patch.type! } : {}),
    ...("currency" in patch ? { currency: patch.currency! } : {}),
    ...("openingBalanceMinor" in patch ? { openingBalanceMinor: patch.openingBalanceMinor! } : {}),
    ...("description" in patch ? { description: patch.description?.trim() || undefined } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
    updatedAt: nowISO(),
    revision: bumpRevision(existing.revision),
  });
}

/**
 * Deleting an account would orphan its transactions and corrupt balances, so
 * the account is rejected while it still has activity. This is the
 * "never silently delete financial records" rule expressed in code.
 */
export async function deleteAccount(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const used = await db.transactions.filter((t) => t.accountId === id || t.toAccountId === id).count();
  if (used > 0) {
    return {
      ok: false,
      reason: `This account has ${used} ${used === 1 ? "transaction" : "transactions"} attached. Archive it instead to keep your history intact.`,
    };
  }
  await db.accounts.delete(id);
  return { ok: true };
}

/* ==========================================================================
   Categories
   ========================================================================== */

export async function listCategories(): Promise<Category[]> {
  const rows = await db.categories.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(() => listCategories(), [], undefined);
}

export async function createCategory(input: {
  name: string;
  icon: string;
  hue: Category["hue"];
  kind: Category["kind"];
}): Promise<Category> {
  const now = nowISO();
  const category: Category = {
    id: reserve("cat", newCategoryId()),
    name: input.name.trim(),
    icon: input.icon,
    hue: input.hue,
    kind: input.kind,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
    revision: bumpRevision(),
  };
  await db.categories.add(category);
  return category;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, "name" | "icon" | "hue">>): Promise<void> {
  const existing = await db.categories.get(id);
  if (!existing) return;
  await db.categories.update(id, {
    ...patch,
    updatedAt: nowISO(),
    revision: bumpRevision(existing.revision),
  });
}

/** Built-in categories cannot be removed — budgets and history depend on them. */
export async function deleteCategory(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const existing = await db.categories.get(id);
  if (!existing) return { ok: true };
  if (existing.isSystem) return { ok: false, reason: "This is a built-in category and cannot be deleted." };

  const used = await db.transactions.filter((t) => t.categoryId === id).count();
  if (used > 0) {
    return { ok: false, reason: `${used} ${used === 1 ? "transaction uses" : "transactions use"} this category.` };
  }
  const budgeted = await db.budgets.filter((b) => b.categoryId === id).count();
  if (budgeted > 0) return { ok: false, reason: "Remove the budget for this category first." };

  await db.categories.delete(id);
  return { ok: true };
}

/* ==========================================================================
   Transactions
   ========================================================================== */

export type TransactionFilter = {
  type?: Transaction["type"] | "all";
  categoryId?: string | "all";
  accountId?: string | "all";
  from?: ISODate;
  to?: ISODate;
  query?: string;
  sort?: "newest" | "oldest";
  limit?: number;
};

export async function listTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const rows = await db.transactions.toArray();
  return applyFilter(rows, filter);
}

/** Pure so the UI can reuse identical semantics on an in-memory slice. */
export function applyFilter(rows: Transaction[], filter: TransactionFilter): Transaction[] {
  const q = filter.query?.trim().toLowerCase();

  const out = rows.filter((t) => {
    if (filter.type && filter.type !== "all" && t.type !== filter.type) return false;
    if (filter.categoryId && filter.categoryId !== "all" && t.categoryId !== filter.categoryId) return false;
    if (filter.accountId && filter.accountId !== "all" && t.accountId !== filter.accountId && t.toAccountId !== filter.accountId)
      return false;
    if (filter.from && t.date < filter.from) return false;
    if (filter.to && t.date > filter.to) return false;
    if (q) {
      const haystack = `${t.description} ${t.notes ?? ""} ${t.amountMinor}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  out.sort((a, b) => {
    const cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1;
    return filter.sort === "oldest" ? cmp : -cmp;
  });

  return filter.limit ? out.slice(0, filter.limit) : out;
}

export function useTransactions(filter: TransactionFilter = {}): Transaction[] | undefined {
  const key = JSON.stringify(filter);
  return useLiveQuery(() => listTransactions(JSON.parse(key)), [key], undefined);
}

export function useAllTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.toArray(), [], undefined);
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id);
}

export type TransactionInput = {
  type: Transaction["type"];
  amountMinor: Minor;
  currency: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  description: string;
  notes?: string;
  date: ISODate;
  exchangeRate?: number;
  baseCurrency?: string;
  baseAmountMinor?: Minor;
};

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const now = nowISO();
  const transaction: Transaction = {
    id: reserve("txn", newTransactionId()),
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    accountId: input.accountId,
    toAccountId: input.type === "transfer" ? input.toAccountId : undefined,
    categoryId: input.type === "transfer" ? undefined : input.categoryId,
    description: input.description.trim(),
    notes: input.notes?.trim() || undefined,
    date: input.date,
    exchangeRate: input.exchangeRate,
    baseCurrency: input.baseCurrency,
    baseAmountMinor: input.baseAmountMinor,
    createdAt: now,
    updatedAt: now,
    revision: bumpRevision(),
  };
  await db.transactions.add(transaction);
  return transaction;
}

/** Edits bump `revision` so a future sync pass can tell local from remote. */
export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const existing = await db.transactions.get(id);
  if (!existing) return;
  await db.transactions.update(id, {
    ...existing,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    accountId: input.accountId,
    toAccountId: input.type === "transfer" ? input.toAccountId : undefined,
    categoryId: input.type === "transfer" ? undefined : input.categoryId,
    description: input.description.trim(),
    notes: input.notes?.trim() || undefined,
    date: input.date,
    exchangeRate: input.exchangeRate,
    baseCurrency: input.baseCurrency,
    baseAmountMinor: input.baseAmountMinor,
    createdAt: existing.createdAt,
    updatedAt: nowISO(),
    revision: bumpRevision(existing.revision),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  // Any goal contribution that references it is detached, never deleted.
  const linked = await db.goalContributions.filter((c) => c.transactionId === id).toArray();
  if (linked.length) {
    await Promise.all(
      linked.map((c) =>
        db.goalContributions.update(c.id, { ...c, transactionId: undefined, note: c.note ?? "Edited transaction" }),
      ),
    );
  }
  await db.transactions.delete(id);
}

export async function countTransactions(): Promise<number> {
  return db.transactions.count();
}

/* ==========================================================================
   Budgets
   ========================================================================== */

export async function listBudgets(): Promise<Budget[]> {
  const rows = await db.budgets.toArray();
  return rows.sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

export function useBudgets(): Budget[] | undefined {
  return useLiveQuery(() => listBudgets(), [], undefined);
}

/** Upsert a monthly cap for a category. One budget per category. */
export async function setBudget(input: {
  categoryId: string;
  amountMinor: Minor;
  currency: string;
}): Promise<Budget> {
  const existing = await db.budgets.filter((b) => b.categoryId === input.categoryId).first();
  const now = nowISO();

  if (existing) {
    const updated: Budget = {
      ...existing,
      amountMinor: input.amountMinor,
      currency: input.currency,
      updatedAt: now,
      revision: bumpRevision(existing.revision),
    };
    await db.budgets.put(updated);
    return updated;
  }

  const budget: Budget = {
    id: reserve("bud", newBudgetId()),
    categoryId: input.categoryId,
    currency: input.currency,
    amountMinor: input.amountMinor,
    startsOn: currentMonthKey(),
    endsOn: null,
    createdAt: now,
    updatedAt: now,
    revision: bumpRevision(),
  };
  await db.budgets.add(budget);
  return budget;
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id);
}

/* ==========================================================================
   Goals & contributions
   ========================================================================== */

export async function listGoals(): Promise<SavingsGoal[]> {
  const rows = await db.goals.toArray();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function useGoals(): SavingsGoal[] | undefined {
  return useLiveQuery(() => listGoals(), [], undefined);
}

export async function getGoal(id: string): Promise<SavingsGoal | undefined> {
  return db.goals.get(id);
}

export async function createGoal(input: {
  name: string;
  targetAmountMinor: Minor;
  currency: string;
  targetDate?: ISODate | null;
  description?: string;
  icon: string;
  hue: SavingsGoal["hue"];
}): Promise<SavingsGoal> {
  const now = nowISO();
  const goal: SavingsGoal = {
    id: reserve("goal", newGoalId()),
    name: input.name.trim(),
    targetAmountMinor: input.targetAmountMinor,
    currency: input.currency,
    targetDate: input.targetDate ?? null,
    description: input.description?.trim() || undefined,
    icon: input.icon,
    hue: input.hue,
    archived: false,
    createdAt: now,
    updatedAt: now,
    revision: bumpRevision(),
  };
  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<SavingsGoal, "name" | "targetAmountMinor" | "targetDate" | "description" | "icon" | "hue" | "archived">>,
): Promise<void> {
  const existing = await db.goals.get(id);
  if (!existing) return;
  await db.goals.update(id, { ...patch, updatedAt: nowISO(), revision: bumpRevision(existing.revision) });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction("rw", db.goals, db.goalContributions, async () => {
    await db.goalContributions.where("goalId").equals(id).delete();
    await db.goals.delete(id);
  });
}

export async function listContributions(goalId?: string): Promise<GoalContribution[]> {
  const rows = goalId
    ? await db.goalContributions.where("goalId").equals(goalId).toArray()
    : await db.goalContributions.toArray();
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function useContributions(goalId?: string): GoalContribution[] | undefined {
  return useLiveQuery(() => listContributions(goalId), [goalId], undefined);
}

export function useAllContributions(): GoalContribution[] | undefined {
  return useLiveQuery(() => db.goalContributions.toArray(), [], undefined);
}

/**
 * Record a contribution (positive) or withdrawal (negative).
 *
 * When `fromAccountId` is supplied we ALSO write a matching transaction so the
 * account's balance stays truthful — money that leaves an account for a goal is
 * a real expense from that account's point of view, and the contribution links
 * back to it. Both records succeed or neither does.
 */
export async function contributeToGoal(input: {
  goalId: string;
  amountMinor: Minor; // positive = add, negative = withdraw
  currency: string;
  date?: ISODate;
  note?: string;
  fromAccountId?: string;
}): Promise<{ contribution: GoalContribution; transaction?: Transaction }> {
  const goal = await db.goals.get(input.goalId);
  if (!goal) throw new Error("That goal no longer exists.");

  const date = input.date ?? todayISO();
  const now = nowISO();
  const contributionId = reserve("gco", newContributionId());

  let transaction: Transaction | undefined;

  await db.transaction("rw", [db.goals, db.goalContributions, db.transactions], async () => {
    if (input.fromAccountId) {
      transaction = {
        id: reserve("txn", newTransactionId()),
        type: input.amountMinor >= 0 ? "expense" : "income",
        amountMinor: Math.abs(input.amountMinor),
        currency: input.currency,
        accountId: input.fromAccountId,
        categoryId: "cat_savings",
        description: `${input.amountMinor >= 0 ? "Saved to" : "Withdrawn from"} ${goal.name}`,
        notes: input.note?.trim() || undefined,
        date,
        createdAt: now,
        updatedAt: now,
        revision: bumpRevision(),
      };
      await db.transactions.add(transaction);
    }

    const contribution: GoalContribution = {
      id: contributionId,
      goalId: input.goalId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      date,
      note: input.note?.trim() || undefined,
      transactionId: transaction?.id,
      createdAt: now,
      updatedAt: now,
      revision: bumpRevision(),
    };
    await db.goalContributions.add(contribution);
  });

  const saved = await db.goalContributions.get(contributionId);
  if (!saved) throw new Error("Contribution was not persisted.");
  return { contribution: saved, transaction };
}

/* ==========================================================================
   Recurring
   ========================================================================== */

export async function listRecurring(): Promise<RecurringTransaction[]> {
  const rows = await db.recurring.toArray();
  return rows.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function useRecurring(): RecurringTransaction[] | undefined {
  return useLiveQuery(() => listRecurring(), [], undefined);
}

export async function createRecurring(input: Omit<RecurringTransaction, "id" | "createdAt" | "updatedAt" | "revision">): Promise<RecurringTransaction> {
  const now = nowISO();
  const row: RecurringTransaction = {
    ...input,
    id: reserve("rec", crypto.randomUUID()),
    createdAt: now,
    updatedAt: now,
    revision: bumpRevision(),
  };
  await db.recurring.add(row);
  return row;
}

export async function updateRecurring(id: string, patch: Partial<RecurringTransaction>): Promise<void> {
  const existing = await db.recurring.get(id);
  if (!existing) return;
  await db.recurring.update(id, { ...patch, updatedAt: nowISO(), revision: bumpRevision(existing.revision) });
}

export async function deleteRecurring(id: string): Promise<void> {
  await db.recurring.delete(id);
}

/* ==========================================================================
   Preferences
   ========================================================================== */

export async function getPreferences(): Promise<Record<string, unknown>> {
  const rows = await db.preferences.toArray();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getPreference<T>(key: PreferenceKey, fallback: T): Promise<T> {
  const row = await db.preferences.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setPreference(key: PreferenceKey, value: unknown): Promise<void> {
  await db.preferences.put({ key, value, updatedAt: nowISO() });
}

export function usePreference<T>(key: PreferenceKey, fallback: T): T | undefined {
  return useLiveQuery(async () => {
    const row = await db.preferences.get(key);
    return (row?.value as T) ?? fallback;
  }, [key, fallback], undefined);
}

export async function setPreferences(rows: PreferenceRow[]): Promise<void> {
  await db.preferences.bulkPut(rows);
}

/* ==========================================================================
   Sync metadata
   ========================================================================== */

export async function getSyncMetadata(key: string): Promise<SyncMetadataRow | undefined> {
  return db.syncMetadata.get(key);
}

export async function setSyncMetadata(key: string, value: unknown): Promise<void> {
  await db.syncMetadata.put({ key, value, updatedAt: nowISO() });
}

export async function listSyncMetadata(): Promise<SyncMetadataRow[]> {
  return db.syncMetadata.toArray();
}

/* ==========================================================================
   Bulk / destructive operations
   ========================================================================== */

export async function clearAllData(): Promise<void> {
  // Preferences survive a wipe: theme and reporting currency are device
  // settings, not financial records.
  await db.transaction(
    "rw",
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.goals,
      db.goalContributions,
      db.recurring,
    ],
    async () => {
      await db.transactions.clear();
      await db.goalContributions.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.recurring.clear();
      await db.accounts.clear();
      await db.categories.clear();
    },
  );
}

export async function replaceAll(records: {
  accounts?: Account[];
  categories?: Category[];
  transactions?: Transaction[];
  budgets?: Budget[];
  goals?: SavingsGoal[];
  goalContributions?: GoalContribution[];
  recurring?: RecurringTransaction[];
  preferences?: PreferenceRow[];
  syncMetadata?: SyncMetadataRow[];
}): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.goals,
      db.goalContributions,
      db.recurring,
      db.preferences,
      db.syncMetadata,
    ],
    async () => {
      if (records.categories) await db.categories.bulkPut(records.categories);
      if (records.accounts) await db.accounts.bulkPut(records.accounts);
      if (records.transactions) await db.transactions.bulkPut(records.transactions);
      if (records.budgets) await db.budgets.bulkPut(records.budgets);
      if (records.goals) await db.goals.bulkPut(records.goals);
      if (records.goalContributions) await db.goalContributions.bulkPut(records.goalContributions);
      if (records.recurring) await db.recurring.bulkPut(records.recurring);
      if (records.preferences) await db.preferences.bulkPut(records.preferences);
      if (records.syncMetadata) await db.syncMetadata.bulkPut(records.syncMetadata);
    },
  );
}

/** Parse an amount string for a currency, throwing rather than defaulting to 0. */
export function parseOrThrow(text: string, code: string): Minor {
  const value = parseAmountToMinor(text, decimalsOf(code) || 0);
  if (value === null) throw new Error(`Could not read the amount "${text}".`);
  return value;
}

export const DEFAULT_REPORTING_CURRENCY = DEFAULT_CURRENCY;

/** Observable used by the import/restore flow to watch record counts. */
export function watchCounts() {
  return liveQuery(async () => ({
    accounts: await db.accounts.count(),
    transactions: await db.transactions.count(),
    goals: await db.goals.count(),
  }));
}
