/**
 * DEMO DATA
 *
 * Realistic but clearly labelled. Seeded once, on first launch only, and never
 * mixed into real records without the user agreeing to reset.
 *
 * All amounts are integer minor units in UGX unless noted, and are internally
 * consistent: account balances in the UI are derived from these transactions,
 * so the numbers you see are the numbers that were written.
 */

import { db } from "@/db/database";
import type {
  Account,
  Budget,
  Category,
  GoalContribution,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from "@/db/schema";
import { currentMonthKey, shiftMonth, todayISO, type ISODate } from "@/lib/dates";
import { getPreference, setPreference } from "@/data/repository";

const DEMO_FLAG = "demoSeeded";

/** Lucide icon names — resolved through the registry in src/design/icons.ts. */
export const BUILTIN_CATEGORIES: Category[] = [
  cat("cat_salary", "Salary", "Banknote", 3, "income"),
  cat("cat_freelance", "Freelance", "Laptop", 9, "income"),
  cat("cat_gift_in", "Gift received", "Gift", 4, "income"),
  cat("cat_refund", "Refund", "RotateCcw", 8, "income"),
  cat("cat_other_in", "Other income", "PlusCircle", 7, "income"),
  cat("cat_food", "Groceries", "ShoppingBasket", 3, "expense"),
  cat("cat_dining", "Eating out", "Utensils", 4, "expense"),
  cat("cat_transport", "Transport", "Bus", 2, "expense"),
  cat("cat_airtime", "Airtime & data", "Smartphone", 6, "expense"),
  cat("cat_rent", "Rent", "Home", 1, "expense"),
  cat("cat_utilities", "Utilities", "PlugZap", 9, "expense"),
  cat("cat_health", "Health", "HeartPulse", 5, "expense"),
  cat("cat_education", "Education", "BookOpen", 10, "expense"),
  cat("cat_household", "Household", "Sofa", 7, "expense"),
  cat("cat_clothing", "Clothing", "Shirt", 6, "expense"),
  cat("cat_entertainment", "Entertainment", "Tv", 2, "expense"),
  cat("cat_savings", "Savings", "PiggyBank", 8, "expense", true),
  cat("cat_family", "Family support", "Users", 10, "expense"),
  cat("cat_misc", "Other", "CircleEllipsis", 7, "expense"),
];

function cat(
  id: string,
  name: string,
  icon: string,
  hue: Category["hue"],
  kind: Category["kind"],
  isSystem = false,
): Category {
  return {
    id,
    name,
    icon,
    hue,
    kind,
    isCustom: false,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    revision: 1,
  };
}

function iso(daysAgo: number): ISODate {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function stamp(daysAgo: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

let seq = 0;
function txn(p: {
  type: Transaction["type"];
  amountMinor: number;
  accountId: string;
  categoryId?: string;
  description: string;
  daysAgo: number;
  toAccountId?: string;
  currency?: string;
  base?: { currency: string; amountMinor: number; rate: number };
  notes?: string;
}): Transaction {
  seq += 1;
  return {
    id: `txn_demo_${String(seq).padStart(4, "0")}`,
    type: p.type,
    amountMinor: p.amountMinor,
    currency: p.currency ?? "UGX",
    accountId: p.accountId,
    toAccountId: p.toAccountId,
    categoryId: p.categoryId,
    description: p.description,
    notes: p.notes,
    date: iso(p.daysAgo),
    exchangeRate: p.base?.rate,
    baseCurrency: p.base?.currency,
    baseAmountMinor: p.base?.amountMinor,
    createdAt: stamp(p.daysAgo),
    updatedAt: stamp(p.daysAgo),
    revision: 1_000 + seq,
  };
}

function contribution(
  n: number,
  goalId: string,
  amountMinor: number,
  daysAgo: number,
  note: string,
  transactionId?: string,
): GoalContribution {
  return {
    id: `gco_demo_${String(n).padStart(3, "0")}`,
    goalId,
    amountMinor,
    currency: "UGX",
    date: iso(daysAgo),
    note,
    transactionId,
    createdAt: stamp(daysAgo, 8),
    updatedAt: stamp(daysAgo, 8),
    revision: 1_000 + n,
  };
}

const ACCOUNTS: Account[] = [
  {
    id: "acc_demo_cash",
    name: "Cash on hand",
    type: "cash",
    currency: "UGX",
    openingBalanceMinor: 150_000,
    description: "Everyday spending money",
    archived: false,
    sortOrder: 1,
    createdAt: stamp(90),
    updatedAt: stamp(90),
    revision: 1,
  },
  {
    id: "acc_demo_momo",
    name: "Mobile Money",
    type: "mobile",
    currency: "UGX",
    openingBalanceMinor: 60_000,
    description: "MTN MoMo",
    archived: false,
    sortOrder: 2,
    createdAt: stamp(90),
    updatedAt: stamp(90),
    revision: 1,
  },
  {
    id: "acc_demo_bank",
    name: "Bank account",
    type: "bank",
    currency: "UGX",
    openingBalanceMinor: 1_200_000,
    description: "Salary is paid here",
    archived: false,
    sortOrder: 3,
    createdAt: stamp(90),
    updatedAt: stamp(90),
    revision: 1,
  },
  {
    id: "acc_demo_savings",
    name: "Savings account",
    type: "savings",
    currency: "UGX",
    openingBalanceMinor: 800_000,
    description: "Emergency fund lives here",
    archived: false,
    sortOrder: 4,
    createdAt: stamp(90),
    updatedAt: stamp(90),
    revision: 1,
  },
  {
    id: "acc_demo_usd",
    name: "Dollar card",
    type: "bank",
    currency: "USD",
    openingBalanceMinor: 15_000, // $150.00
    description: "For online subscriptions",
    archived: false,
    sortOrder: 5,
    createdAt: stamp(90),
    updatedAt: stamp(90),
    revision: 1,
  },
];

const GOALS: SavingsGoal[] = [
  {
    id: "goal_demo_emergency",
    name: "Emergency fund",
    targetAmountMinor: 3_000_000,
    currency: "UGX",
    targetDate: iso(-365),
    description: "Three months of essential costs",
    icon: "ShieldCheck",
    hue: 8,
    archived: false,
    createdAt: stamp(120),
    updatedAt: stamp(120),
    revision: 1,
  },
  {
    id: "goal_demo_household",
    name: "Household setup",
    targetAmountMinor: 1_500_000,
    currency: "UGX",
    targetDate: iso(-150),
    description: "Sofa, fridge and kitchen essentials",
    icon: "Sofa",
    hue: 7,
    archived: false,
    createdAt: stamp(100),
    updatedAt: stamp(100),
    revision: 1,
  },
  {
    id: "goal_demo_education",
    name: "Course fees",
    targetAmountMinor: 900_000,
    currency: "UGX",
    targetDate: iso(-90),
    description: "Six-month programme starting next term",
    icon: "BookOpen",
    hue: 10,
    archived: false,
    createdAt: stamp(70),
    updatedAt: stamp(70),
    revision: 1,
  },
];

const BUDGETS: Budget[] = [
  { id: "bud_demo_food", categoryId: "cat_food", currency: "UGX", amountMinor: 500_000, startsOn: shiftMonth(currentMonthKey(), -2), endsOn: null, createdAt: stamp(60), updatedAt: stamp(60), revision: 1 },
  { id: "bud_demo_dining", categoryId: "cat_dining", currency: "UGX", amountMinor: 180_000, startsOn: shiftMonth(currentMonthKey(), -2), endsOn: null, createdAt: stamp(60), updatedAt: stamp(60), revision: 1 },
  { id: "bud_demo_transport", categoryId: "cat_transport", currency: "UGX", amountMinor: 150_000, startsOn: shiftMonth(currentMonthKey(), -1), endsOn: null, createdAt: stamp(40), updatedAt: stamp(40), revision: 1 },
  { id: "bud_demo_airtime", categoryId: "cat_airtime", currency: "UGX", amountMinor: 80_000, startsOn: shiftMonth(currentMonthKey(), -1), endsOn: null, createdAt: stamp(40), updatedAt: stamp(40), revision: 1 },
  { id: "bud_demo_household", categoryId: "cat_household", currency: "UGX", amountMinor: 250_000, startsOn: currentMonthKey(), endsOn: null, createdAt: stamp(20), updatedAt: stamp(20), revision: 1 },
];

const RECURRING: RecurringTransaction[] = [
  {
    id: "rec_demo_rent",
    label: "Monthly rent",
    type: "expense",
    amountMinor: 650_000,
    currency: "UGX",
    accountId: "acc_demo_bank",
    categoryId: "cat_rent",
    dayOfMonth: 1,
    nextDate: iso(-6),
    active: true,
    createdAt: stamp(80),
    updatedAt: stamp(80),
    revision: 1,
  },
  {
    id: "rec_demo_salary",
    label: "Monthly salary",
    type: "income",
    amountMinor: 2_800_000,
    currency: "UGX",
    accountId: "acc_demo_bank",
    categoryId: "cat_salary",
    dayOfMonth: 28,
    nextDate: iso(-14),
    active: true,
    createdAt: stamp(80),
    updatedAt: stamp(80),
    revision: 1,
  },
  {
    id: "rec_demo_internet",
    label: "Home internet",
    type: "expense",
    amountMinor: 120_000,
    currency: "UGX",
    accountId: "acc_demo_momo",
    categoryId: "cat_utilities",
    dayOfMonth: 5,
    nextDate: iso(-2),
    active: true,
    createdAt: stamp(70),
    updatedAt: stamp(70),
    revision: 1,
  },
];

function buildTransactions(): Transaction[] {
  const list: Transaction[] = [
    // --- Salary, three months running -------------------------------------
    txn({ type: "income", amountMinor: 2_800_000, accountId: "acc_demo_bank", categoryId: "cat_salary", description: "Monthly salary", daysAgo: 2 }),
    txn({ type: "income", amountMinor: 2_800_000, accountId: "acc_demo_bank", categoryId: "cat_salary", description: "Monthly salary", daysAgo: 32 }),
    txn({ type: "income", amountMinor: 2_800_000, accountId: "acc_demo_bank", categoryId: "cat_salary", description: "Monthly salary", daysAgo: 62 }),

    // --- Rent --------------------------------------------------------------
    txn({ type: "expense", amountMinor: 650_000, accountId: "acc_demo_bank", categoryId: "cat_rent", description: "Monthly rent", daysAgo: 4 }),
    txn({ type: "expense", amountMinor: 650_000, accountId: "acc_demo_bank", categoryId: "cat_rent", description: "Monthly rent", daysAgo: 34 }),
    txn({ type: "expense", amountMinor: 650_000, accountId: "acc_demo_bank", categoryId: "cat_rent", description: "Monthly rent", daysAgo: 64 }),

    // --- Groceries ---------------------------------------------------------
    txn({ type: "expense", amountMinor: 96_500, accountId: "acc_demo_cash", categoryId: "cat_food", description: "Market — vegetables & beans", daysAgo: 1 }),
    txn({ type: "expense", amountMinor: 143_000, accountId: "acc_demo_momo", categoryId: "cat_food", description: "Supermarket weekly shop", daysAgo: 3 }),
    txn({ type: "expense", amountMinor: 78_000, accountId: "acc_demo_cash", categoryId: "cat_food", description: "Market — maize flour & rice", daysAgo: 6 }),
    txn({ type: "expense", amountMinor: 121_500, accountId: "acc_demo_momo", categoryId: "cat_food", description: "Supermarket weekly shop", daysAgo: 8 }),
    txn({ type: "expense", amountMinor: 88_000, accountId: "acc_demo_cash", categoryId: "cat_food", description: "Butcher — meat for the week", daysAgo: 11 }),
    txn({ type: "expense", amountMinor: 132_000, accountId: "acc_demo_momo", categoryId: "cat_food", description: "Supermarket weekly shop", daysAgo: 14 }),
    txn({ type: "expense", amountMinor: 104_000, accountId: "acc_demo_cash", categoryId: "cat_food", description: "Market — cooking oil & spices", daysAgo: 18 }),
    txn({ type: "expense", amountMinor: 149_000, accountId: "acc_demo_momo", categoryId: "cat_food", description: "Supermarket weekly shop", daysAgo: 22 }),
    txn({ type: "expense", amountMinor: 91_000, accountId: "acc_demo_cash", categoryId: "cat_food", description: "Market — greens & fruit", daysAgo: 26 }),

    // --- Eating out --------------------------------------------------------
    txn({ type: "expense", amountMinor: 28_000, accountId: "acc_demo_cash", categoryId: "cat_dining", description: "Lunch with colleagues", daysAgo: 1 }),
    txn({ type: "expense", amountMinor: 45_000, accountId: "acc_demo_momo", categoryId: "cat_dining", description: "Dinner, family treat", daysAgo: 5 }),
    txn({ type: "expense", amountMinor: 18_500, accountId: "acc_demo_cash", categoryId: "cat_dining", description: "Rolex on the way home", daysAgo: 9 }),
    txn({ type: "expense", amountMinor: 62_000, accountId: "acc_demo_momo", categoryId: "cat_dining", description: "Sunday brunch", daysAgo: 13 }),
    txn({ type: "expense", amountMinor: 22_000, accountId: "acc_demo_cash", categoryId: "cat_dining", description: "Coffee & pastry", daysAgo: 17 }),

    // --- Transport ---------------------------------------------------------
    txn({ type: "expense", amountMinor: 12_000, accountId: "acc_demo_cash", categoryId: "cat_transport", description: "Boda to town", daysAgo: 1 }),
    txn({ type: "expense", amountMinor: 35_000, accountId: "acc_demo_cash", categoryId: "cat_transport", description: "Taxi to Jinja", daysAgo: 7 }),
    txn({ type: "expense", amountMinor: 15_000, accountId: "acc_demo_cash", categoryId: "cat_transport", description: "Boda, two trips", daysAgo: 12 }),
    txn({ type: "expense", amountMinor: 48_000, accountId: "acc_demo_momo", categoryId: "cat_transport", description: "Fuel top-up", daysAgo: 19 }),
    txn({ type: "expense", amountMinor: 14_000, accountId: "acc_demo_cash", categoryId: "cat_transport", description: "Boda to town", daysAgo: 24 }),

    // --- Airtime & data ----------------------------------------------------
    txn({ type: "expense", amountMinor: 30_000, accountId: "acc_demo_momo", categoryId: "cat_airtime", description: "Weekly data bundle", daysAgo: 2 }),
    txn({ type: "expense", amountMinor: 25_000, accountId: "acc_demo_momo", categoryId: "cat_airtime", description: "Airtime", daysAgo: 9 }),
    txn({ type: "expense", amountMinor: 30_000, accountId: "acc_demo_momo", categoryId: "cat_airtime", description: "Weekly data bundle", daysAgo: 16 }),
    txn({ type: "expense", amountMinor: 20_000, accountId: "acc_demo_momo", categoryId: "cat_airtime", description: "Airtime for calls", daysAgo: 23 }),

    // --- Utilities ---------------------------------------------------------
    txn({ type: "expense", amountMinor: 120_000, accountId: "acc_demo_momo", categoryId: "cat_utilities", description: "Home internet", daysAgo: 3 }),
    txn({ type: "expense", amountMinor: 58_000, accountId: "acc_demo_momo", categoryId: "cat_utilities", description: "Electricity tokens", daysAgo: 10 }),
    txn({ type: "expense", amountMinor: 44_000, accountId: "acc_demo_momo", categoryId: "cat_utilities", description: "Water bill", daysAgo: 21 }),

    // --- Health, education, household, clothing ---------------------------
    txn({ type: "expense", amountMinor: 85_000, accountId: "acc_demo_cash", categoryId: "cat_health", description: "Pharmacy — malaria treatment", daysAgo: 15 }),
    txn({ type: "expense", amountMinor: 210_000, accountId: "acc_demo_bank", categoryId: "cat_education", description: "Term fees, second instalment", daysAgo: 28 }),
    txn({ type: "expense", amountMinor: 165_000, accountId: "acc_demo_momo", categoryId: "cat_household", description: "Plates, pots and utensils", daysAgo: 7 }),
    txn({ type: "expense", amountMinor: 96_000, accountId: "acc_demo_cash", categoryId: "cat_clothing", description: "Two shirts and shoes", daysAgo: 20 }),
    txn({ type: "expense", amountMinor: 120_000, accountId: "acc_demo_cash", categoryId: "cat_entertainment", description: "Family cinema trip", daysAgo: 25 }),
    txn({ type: "expense", amountMinor: 200_000, accountId: "acc_demo_momo", categoryId: "cat_family", description: "Support for parents", daysAgo: 5 }),

    // --- Freelance & refund ------------------------------------------------
    txn({ type: "income", amountMinor: 450_000, accountId: "acc_demo_momo", categoryId: "cat_freelance", description: "Website design deposit", daysAgo: 12 }),
    txn({ type: "income", amountMinor: 60_000, accountId: "acc_demo_momo", categoryId: "cat_refund", description: "Refund — double-charged airtime", daysAgo: 8 }),

    // --- A foreign-currency record, correctly kept separate ---------------
    txn({
      type: "expense",
      amountMinor: 1_200, // $12.00
      currency: "USD",
      accountId: "acc_demo_usd",
      categoryId: "cat_entertainment",
      description: "Streaming subscription",
      daysAgo: 6,
      base: { currency: "UGX", amountMinor: 44_400, rate: 3700 },
    }),

    // --- Transfers (never income or expense) ------------------------------
    txn({ type: "transfer", amountMinor: 400_000, accountId: "acc_demo_bank", toAccountId: "acc_demo_savings", description: "Monthly savings set-aside", daysAgo: 2 }),
    txn({ type: "transfer", amountMinor: 400_000, accountId: "acc_demo_bank", toAccountId: "acc_demo_savings", description: "Monthly savings set-aside", daysAgo: 32 }),
    txn({ type: "transfer", amountMinor: 400_000, accountId: "acc_demo_bank", toAccountId: "acc_demo_savings", description: "Monthly savings set-aside", daysAgo: 62 }),
    txn({ type: "transfer", amountMinor: 250_000, accountId: "acc_demo_bank", toAccountId: "acc_demo_momo", description: "Topped up Mobile Money", daysAgo: 4 }),
    txn({ type: "transfer", amountMinor: 200_000, accountId: "acc_demo_bank", toAccountId: "acc_demo_cash", description: "Cash withdrawal", daysAgo: 9 }),
  ];

  return list;
}

const CONTRIBUTIONS: GoalContribution[] = [
  contribution(1, "goal_demo_emergency", 300_000, 62, "Monthly set-aside"),
  contribution(2, "goal_demo_emergency", 300_000, 32, "Monthly set-aside"),
  contribution(3, "goal_demo_emergency", 350_000, 12, "Bonus from freelance work"),
  contribution(4, "goal_demo_household", 200_000, 45, "Initial deposit"),
  contribution(5, "goal_demo_household", 180_000, 20, "Saved from groceries budget"),
  contribution(6, "goal_demo_education", 150_000, 30, "First instalment"),
  contribution(7, "goal_demo_education", 120_000, 10, "Second instalment"),
];

export async function isDemoSeeded(): Promise<boolean> {
  return (await getPreference<boolean>(DEMO_FLAG as "demoSeeded", false)) === true;
}

export async function hasAnyData(): Promise<boolean> {
  const count = await db.transactions.count();
  if (count > 0) return true;
  return (await db.accounts.count()) > 0;
}

/**
 * Seed demo data on a genuinely empty database.
 * If the user already has records, nothing is written — the app opens on their
 * real ledger instead.
 */
export async function seedDemoData(force = false): Promise<{ seeded: boolean }> {
  if (!force) {
    if (await isDemoSeeded()) return { seeded: false };
    if (await hasAnyData()) return { seeded: false };
  }

  await db.transaction(
    "rw",
    [db.accounts, db.categories, db.transactions, db.budgets, db.goals, db.goalContributions, db.recurring],
    async () => {
      await db.categories.bulkPut(BUILTIN_CATEGORIES);
      await db.accounts.bulkPut(ACCOUNTS);
      await db.goals.bulkPut(GOALS);
      await db.budgets.bulkPut(BUDGETS);
      await db.recurring.bulkPut(RECURRING);
      await db.transactions.bulkPut(buildTransactions());
      await db.goalContributions.bulkPut(CONTRIBUTIONS);
    },
  );

  await setPreference(DEMO_FLAG as "demoSeeded", true);
  return { seeded: true };
}

/**
 * Remove demo records only. Custom categories the user added are preserved,
 * because those are their own work, not sample content.
 */
export async function clearDemoData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.accounts, db.categories, db.transactions, db.budgets, db.goals, db.goalContributions, db.recurring],
    async () => {
      await db.transactions.where("id").startsWith("txn_demo_").delete();
      await db.goalContributions.where("id").startsWith("gco_demo_").delete();
      await db.accounts.where("id").startsWith("acc_demo_").delete();
      await db.goals.where("id").startsWith("goal_demo_").delete();
      await db.budgets.where("id").startsWith("bud_demo_").delete();
      await db.recurring.where("id").startsWith("rec_demo_").delete();
      await db.categories.where("id").startsWith("cat_").delete();
      await db.categories.bulkPut(
        BUILTIN_CATEGORIES.filter((c) => c.isCustom === false).map((c) => ({ ...c, isCustom: false })),
      );
    },
  );
  await setPreference(DEMO_FLAG as "demoSeeded", false);
}

/** Are the records currently on screen sample data? */
export function looksLikeDemoTransaction(id: string): boolean {
  return id.startsWith("txn_demo_");
}

export const DEMO_IDS = {
  accounts: ACCOUNTS.map((a) => a.id),
  goals: GOALS.map((g) => g.id),
};

export const DEMO_TODAY = todayISO();
