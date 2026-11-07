/**
 * DOMAIN MODEL
 *
 * Tables mirror the conceptual model exactly; the data-access layer
 * (src/data/repository.ts) is the ONLY module that touches Dexie, so UI
 * components can never issue ad-hoc IndexedDB queries.
 */

import type { ISODate, MonthKey } from "@/lib/dates";
import type { Minor } from "@/lib/money";
import type { CurrencyCode } from "@/lib/currency";

export type AccountType = "cash" | "mobile" | "bank" | "savings" | "other";

export type TransactionType = "income" | "expense" | "transfer";

export type CategoryKind = "income" | "expense";

export type HueIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalanceMinor: Minor;
  description?: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type Category = {
  id: string;
  name: string;
  /** Lucide icon name, resolved through the registry in src/design/icons.ts */
  icon: string;
  hue: HueIndex;
  kind: CategoryKind;
  /** False for the built-in set, true for anything the user created. */
  isCustom: boolean;
  /** Marks the read-only sink used when money moves into a savings goal. */
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  /** Original amount, in the currency below. Never overwritten. */
  amountMinor: Minor;
  currency: CurrencyCode;
  accountId: string;
  /** Transfers only: destination account. */
  toAccountId?: string;
  categoryId?: string;
  description: string;
  notes?: string;
  date: ISODate;

  /**
   * Optional user-authorised conversion for cross-currency REPORTING.
   * When present, `baseAmountMinor` is this transaction's value in
   * `baseCurrency` and `exchangeRate` is the rate that produced it.
   * The original `amountMinor`/`currency` pair stays untouched.
   */
  exchangeRate?: number;
  baseCurrency?: CurrencyCode;
  baseAmountMinor?: Minor;

  /** Optional link to a recurring schedule that produced this record. */
  recurringId?: string;

  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type Budget = {
  id: string;
  categoryId: string;
  currency: CurrencyCode;
  amountMinor: Minor;
  /** Recurring monthly cap. `startsOn` bounds when it began applying. */
  startsOn: MonthKey;
  /** Null = still active every month. */
  endsOn?: MonthKey | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmountMinor: Minor;
  currency: CurrencyCode;
  targetDate?: ISODate | null;
  description?: string;
  icon: string;
  hue: HueIndex;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type GoalContribution = {
  id: string;
  goalId: string;
  /** Signed: positive adds to the goal, negative withdraws from it. */
  amountMinor: Minor;
  currency: CurrencyCode;
  date: ISODate;
  note?: string;
  /** The transaction that moved the money, when one was recorded. */
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type RecurringTransaction = {
  id: string;
  label: string;
  type: TransactionType;
  amountMinor: Minor;
  currency: CurrencyCode;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  /** Day of month, 1–31. Clamped to month length when applied. */
  dayOfMonth: number;
  /** ISO date of the next expected occurrence. */
  nextDate: ISODate;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type PreferenceKey =
  | "reportingCurrency"
  | "enabledCurrencies"
  | "theme"
  | "hideAmounts"
  | "demoSeeded"
  | "rates"
  | "hasOpened";

export type PreferenceRow = {
  key: PreferenceKey;
  value: unknown;
  updatedAt: string;
};

export type SyncMetadataRow = {
  key: string;
  value: unknown;
  updatedAt: string;
};

export type DatabaseRecords = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  goalContributions: GoalContribution[];
  recurring: RecurringTransaction[];
  preferences: PreferenceRow[];
  syncMetadata: SyncMetadataRow[];
};
