/**
 * FINANCIAL CALCULATIONS
 *
 * Pure functions over in-memory records. No I/O, no Dexie, no React — which is
 * what makes them testable (see src/lib/finance.test.ts).
 *
 * INVARIANTS
 *  1. Transfers are NEVER income and NEVER expense. They only move money
 *     between accounts.
 *  2. Account balances are always RECOMPUTED from the opening balance plus
 *     transactions — never read from a cached column. That guarantees an edit
 *     or delete immediately corrects every derived figure.
 *  3. Records in a foreign currency are never silently merged into a report.
 *     They are either converted by a user-supplied rate or excluded and
 *     counted, so the UI can say "3 records not included".
 */

import type {
  Account,
  Budget,
  Category,
  GoalContribution,
  SavingsGoal,
  Transaction,
} from "@/db/schema";
import { sameCurrency, type CurrencyCode } from "@/lib/currency";
import { monthKeyOf, type MonthKey } from "@/lib/dates";
import { percentOf, sumMinor, type Minor } from "@/lib/money";

/** A transaction's reportable value in `reporting`, or null when unconvertible. */
export function reportableMinor(tx: Transaction, reporting: CurrencyCode): Minor | null {
  // User-authorised conversion takes priority and is already quantised.
  if (tx.baseCurrency === reporting && typeof tx.baseAmountMinor === "number") {
    return tx.baseAmountMinor;
  }
  if (sameCurrency(tx.currency, reporting)) return tx.amountMinor;
  return null;
}

/** Split a month's transactions into reportable / skipped-because-foreign. */
function partition(
  transactions: readonly Transaction[],
  reporting: CurrencyCode,
  month: MonthKey,
): { included: Transaction[]; skipped: Transaction[] } {
  const included: Transaction[] = [];
  const skipped: Transaction[] = [];
  for (const tx of transactions) {
    if (monthKeyOf(tx.date) !== month) continue;
    if (tx.type === "transfer") continue; // invariant 1
    if (reportableMinor(tx, reporting) === null) skipped.push(tx);
    else included.push(tx);
  }
  return { included, skipped };
}

export type MonthlyTotals = {
  incomeMinor: Minor;
  expenseMinor: Minor;
  /** income − expense. Transfers excluded on both sides. */
  netMinor: Minor;
  transactionCount: number;
  skippedForeignCount: number;
};

export function monthlyTotals(
  transactions: readonly Transaction[],
  reporting: CurrencyCode,
  month: MonthKey,
): MonthlyTotals {
  const { included, skipped } = partition(transactions, reporting, month);
  const income = sumMinor(
    included.filter((t) => t.type === "income").map((t) => reportableMinor(t, reporting) ?? 0),
  );
  const expense = sumMinor(
    included.filter((t) => t.type === "expense").map((t) => reportableMinor(t, reporting) ?? 0),
  );
  return {
    incomeMinor: income,
    expenseMinor: expense,
    netMinor: income - expense,
    transactionCount: included.length,
    skippedForeignCount: skipped.length,
  };
}

/* ---------------------------------------------------------------------------
   Account balances
   --------------------------------------------------------------------------- */

export type AccountBalance = {
  account: Account;
  /** opening + inflows − outflows, in the ACCOUNT's own currency. */
  balanceMinor: Minor;
  transactionCount: number;
};

/**
 * Recompute an account's balance from first principles.
 * A transfer out of the account reduces it; a transfer in increases it.
 */
export function accountBalance(account: Account, all: readonly Transaction[]): AccountBalance {
  let balance = account.openingBalanceMinor;
  let count = 0;

  for (const tx of all) {
    if (tx.type === "transfer") {
      if (tx.accountId === account.id) balance -= tx.amountMinor;
      if (tx.toAccountId === account.id) balance += tx.amountMinor;
      if (tx.accountId === account.id || tx.toAccountId === account.id) count += 1;
      continue;
    }
    if (tx.accountId !== account.id) continue;
    if (!sameCurrency(tx.currency, account.currency)) continue; // never silently convert
    balance += tx.type === "income" ? tx.amountMinor : -tx.amountMinor;
    count += 1;
  }

  return { account, balanceMinor: balance, transactionCount: count };
}

export function accountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
): AccountBalance[] {
  return accounts.map((a) => accountBalance(a, transactions));
}

/**
 * Total available across accounts that share `reporting`.
 * Accounts in other currencies are excluded, never estimated.
 */
export function totalInCurrency(
  balances: readonly AccountBalance[],
  reporting: CurrencyCode,
): { totalMinor: Minor; includedCount: number; excludedCount: number } {
  const matching = balances.filter((b) => sameCurrency(b.account.currency, reporting));
  return {
    totalMinor: sumMinor(matching.map((b) => b.balanceMinor)),
    includedCount: matching.length,
    excludedCount: balances.length - matching.length,
  };
}

/* ---------------------------------------------------------------------------
   Category breakdown
   --------------------------------------------------------------------------- */

export type CategorySlice = {
  categoryId: string;
  totalMinor: Minor;
  count: number;
  /** 0–100 share of the month's spending. */
  share: number;
};

export function spendingByCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  reporting: CurrencyCode,
  month: MonthKey,
): { slices: CategorySlice[]; byId: Map<string, Category>; skippedForeignCount: number } {
  const { included, skipped } = partition(transactions, reporting, month);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const totals = new Map<string, Minor>();
  const counts = new Map<string, number>();
  for (const tx of included) {
    if (tx.type !== "expense") continue;
    const key = tx.categoryId ?? "uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + (reportableMinor(tx, reporting) ?? 0));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const grand = sumMinor([...totals.values()]);
  const slices: CategorySlice[] = [...totals.entries()]
    .map(([categoryId, totalMinor]) => ({
      categoryId,
      totalMinor,
      count: counts.get(categoryId) ?? 0,
      share: percentOf(totalMinor, grand),
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);

  return { slices, byId, skippedForeignCount: skipped.length };
}

/* ---------------------------------------------------------------------------
   Budgets
   --------------------------------------------------------------------------- */

export type BudgetStatus = "ok" | "watch" | "near" | "over";

export type BudgetPerformance = {
  budget: Budget;
  category?: Category;
  allocatedMinor: Minor;
  spentMinor: Minor;
  remainingMinor: Minor;
  /** 0–100+ percent consumed. */
  usedPercent: number;
  status: BudgetStatus;
  /** Suggested daily allowance to land exactly on budget. */
  dailyAllowanceMinor: Minor;
  daysLeft: number;
  transactionCount: number;
};

const WATCH_THRESHOLD = 0.6;
const NEAR_THRESHOLD = 0.85;

function statusFor(ratio: number): BudgetStatus {
  if (ratio >= 1) return "over";
  if (ratio >= NEAR_THRESHOLD) return "near";
  if (ratio >= WATCH_THRESHOLD) return "watch";
  return "ok";
}

/** Is a recurring monthly budget active during `month`? */
export function budgetIsActive(budget: Budget, month: MonthKey): boolean {
  if (budget.startsOn > month) return false;
  if (budget.endsOn && budget.endsOn < month) return false;
  return true;
}

export function budgetPerformance(
  budgets: readonly Budget[],
  categories: readonly Category[],
  transactions: readonly Transaction[],
  reporting: CurrencyCode,
  month: MonthKey,
  daysLeft: number,
): BudgetPerformance[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const days = Math.max(daysLeft, 0);

  return budgets
    .filter((b) => budgetIsActive(b, month))
    .map((budget) => {
      const spent = sumMinor(
        transactions
          .filter(
            (t) =>
              t.type === "expense" &&
              t.categoryId === budget.categoryId &&
              monthKeyOf(t.date) === month &&
              reportableMinor(t, reporting) !== null,
          )
          .map((t) => reportableMinor(t, reporting) ?? 0),
      );

      const ratio = budget.amountMinor > 0 ? spent / budget.amountMinor : 0;
      return {
        budget,
        category: byId.get(budget.categoryId),
        allocatedMinor: budget.amountMinor,
        spentMinor: spent,
        remainingMinor: budget.amountMinor - spent,
        usedPercent: percentOf(spent, budget.amountMinor),
        status: statusFor(ratio),
        dailyAllowanceMinor:
          budget.amountMinor > spent && days > 0 ? Math.floor((budget.amountMinor - spent) / days) : 0,
        daysLeft: days,
        transactionCount: transactions.filter(
          (t) =>
            t.type === "expense" &&
            t.categoryId === budget.categoryId &&
            monthKeyOf(t.date) === month,
        ).length,
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);
}

/* ---------------------------------------------------------------------------
   Goals
   --------------------------------------------------------------------------- */

export type GoalProgress = {
  goal: SavingsGoal;
  savedMinor: Minor;
  remainingMinor: Minor;
  progressPercent: number;
  isComplete: boolean;
  /** Required per-month contribution to hit the target date. Null when no date. */
  requiredMonthlyMinor: Minor | null;
  monthsRemaining: number | null;
  lastContributionDate: string | null;
  contributionCount: number;
};

export function goalProgress(
  goal: SavingsGoal,
  contributions: readonly GoalContribution[],
): GoalProgress {
  const own = contributions.filter((c) => c.goalId === goal.id);
  const saved = sumMinor(own.map((c) => c.amountMinor));
  const sorted = [...own].sort((a, b) => (a.date < b.date ? 1 : -1));

  let monthsRemaining: number | null = null;
  let requiredMonthlyMinor: Minor | null = null;
  if (goal.targetDate) {
    const end = new Date(`${goal.targetDate}T00:00:00`);
    const now = new Date();
    const months =
      (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    monthsRemaining = Math.max(months, 0);
    const remaining = Math.max(goal.targetAmountMinor - saved, 0);
    requiredMonthlyMinor =
      monthsRemaining > 0 ? Math.ceil(remaining / monthsRemaining) : remaining;
  }

  return {
    goal,
    savedMinor: saved,
    remainingMinor: Math.max(goal.targetAmountMinor - saved, 0),
    progressPercent: Math.min(percentOf(saved, goal.targetAmountMinor), 100),
    isComplete: saved >= goal.targetAmountMinor && goal.targetAmountMinor > 0,
    requiredMonthlyMinor,
    monthsRemaining,
    lastContributionDate: sorted[0]?.date ?? null,
    contributionCount: own.length,
  };
}

export function allGoalProgress(
  goals: readonly SavingsGoal[],
  contributions: readonly GoalContribution[],
): GoalProgress[] {
  return goals.map((g) => goalProgress(g, contributions));
}

/* ---------------------------------------------------------------------------
   Trends
   --------------------------------------------------------------------------- */

export type TrendPoint = {
  month: MonthKey;
  incomeMinor: Minor;
  expenseMinor: Minor;
  netMinor: Minor;
}

export function monthlyTrend(
  transactions: readonly Transaction[],
  reporting: CurrencyCode,
  months: readonly MonthKey[],
): TrendPoint[] {
  return months.map((month) => {
    const t = monthlyTotals(transactions, reporting, month);
    return {
      month,
      incomeMinor: t.incomeMinor,
      expenseMinor: t.expenseMinor,
      netMinor: t.netMinor,
    };
  });
}

/**
 * Month-over-month change as a signed percentage. Returns null when there is
 * no previous value to compare against — we never invent a statistic.
 */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return percentOf(current - previous, Math.abs(previous), 1);
}
