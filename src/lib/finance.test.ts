import { describe, expect, it } from "vitest";
import type { Account, Budget, Category, GoalContribution, SavingsGoal, Transaction } from "@/db/schema";
import { convertMinor, formatMoney } from "@/lib/currency";
import { monthKeyOf, shiftMonth, currentMonthKey } from "@/lib/dates";
import {
  accountBalance,
  budgetPerformance,
  changePercent,
  goalProgress,
  monthlyTotals,
  reportableMinor,
  spendingByCategory,
  totalInCurrency,
} from "@/lib/finance";

const M = "2026-04";

function tx(partial: Partial<Transaction> & { id: string }): Transaction {
  return {
    type: "expense",
    amountMinor: 1000,
    currency: "UGX",
    accountId: "a1",
    description: "Test",
    date: "2026-04-10",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
    revision: 1,
    ...partial,
  };
}

function acc(partial: Partial<Account> & { id: string }): Account {
  return {
    name: "Cash",
    type: "cash",
    currency: "UGX",
    openingBalanceMinor: 0,
    archived: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    revision: 1,
    ...partial,
  };
}

function cat(partial: Partial<Category> & { id: string }): Category {
  return {
    name: "Food",
    icon: "Utensils",
    hue: 3,
    kind: "expense",
    isCustom: false,
    createdAt: "",
    updatedAt: "",
    revision: 1,
    ...partial,
  };
}

describe("monthlyTotals — transfers must never be income or expense", () => {
  it("excludes transfers from both sides", () => {
    const list = [
      tx({ id: "1", type: "income", amountMinor: 500_000 }),
      tx({ id: "2", type: "expense", amountMinor: 100_000 }),
      tx({ id: "3", type: "transfer", amountMinor: 250_000, accountId: "a1", toAccountId: "a2" }),
    ];
    const t = monthlyTotals(list, "UGX", M);
    expect(t.incomeMinor).toBe(500_000);
    expect(t.expenseMinor).toBe(100_000);
    expect(t.netMinor).toBe(400_000);
    expect(t.transactionCount).toBe(2);
  });

  it("ignores transactions from other months", () => {
    const list = [
      tx({ id: "1", type: "income", amountMinor: 500_000, date: "2026-04-05" }),
      tx({ id: "2", type: "income", amountMinor: 999_999, date: "2026-03-31" }),
    ];
    expect(monthlyTotals(list, "UGX", M).incomeMinor).toBe(500_000);
  });

  it("reports net as negative when spending exceeds income", () => {
    const list = [
      tx({ id: "1", type: "income", amountMinor: 100_000 }),
      tx({ id: "2", type: "expense", amountMinor: 250_000 }),
    ];
    expect(monthlyTotals(list, "UGX", M).netMinor).toBe(-150_000);
  });
});

describe("multi-currency discipline", () => {
  it("never silently merges a foreign transaction into the report", () => {
    const list = [
      tx({ id: "1", type: "income", amountMinor: 500_000, currency: "UGX" }),
      tx({ id: "2", type: "income", amountMinor: 10_000, currency: "USD" }), // no rate supplied
    ];
    const t = monthlyTotals(list, "UGX", M);
    expect(t.incomeMinor).toBe(500_000);
    expect(t.skippedForeignCount).toBe(1);
  });

  it("uses a user-supplied base amount when one exists", () => {
    const list = [
      tx({
        id: "1",
        type: "expense",
        amountMinor: 10_000, // USD 100.00
        currency: "USD",
        baseCurrency: "UGX",
        baseAmountMinor: 370_000,
        exchangeRate: 3700,
      }),
    ];
    const t = monthlyTotals(list, "UGX", M);
    expect(t.expenseMinor).toBe(370_000);
    expect(t.skippedForeignCount).toBe(0);
  });

  it("reportableMinor prefers the stored base amount over the original", () => {
    const t = tx({
      id: "x",
      amountMinor: 5_000,
      currency: "KES",
      baseCurrency: "UGX",
      baseAmountMinor: 140_000,
    });
    expect(reportableMinor(t, "UGX")).toBe(140_000);
    expect(reportableMinor(t, "KES")).toBe(5_000);
    expect(reportableMinor(t, "USD")).toBeNull();
  });

  it("convertMinor quantises to the target currency's minor unit", () => {
    // USD 25.00 -> UGX at 3,700 (UGX has 0 minor units, so minor === major)
    expect(convertMinor(2_500, { from: "USD", to: "UGX", rate: 3700 })).toBe(92_500);
    // UGX 100,000 -> USD at 1/3,700 => $27.027 => 2,703 cents
    expect(convertMinor(100_000, { from: "UGX", to: "USD", rate: 1 / 3700 })).toBe(2_703);
  });

  it("convertMinor round-trips without compounding error", () => {
    const there = convertMinor(10_000, { from: "USD", to: "UGX", rate: 3700 });
    expect(convertMinor(there, { from: "UGX", to: "USD", rate: 1 / 3700 })).toBe(10_000);
  });

  it("is a no-op when both sides share a currency", () => {
    expect(convertMinor(1_234, { from: "UGX", to: "UGX", rate: 5 })).toBe(1_234);
  });

  it("never mutates the original amount through conversion", () => {
    const original = 10_000;
    convertMinor(original, { from: "USD", to: "UGX", rate: 3700 });
    expect(original).toBe(10_000);
  });

  it("rejects a non-positive rate", () => {
    expect(() => convertMinor(100, { from: "USD", to: "UGX", rate: 0 })).toThrow(RangeError);
  });
});

describe("accountBalance", () => {
  it("derives a balance from opening balance plus transactions", () => {
    const account = acc({ id: "a1", openingBalanceMinor: 50_000 });
    const list = [
      tx({ id: "1", type: "income", amountMinor: 200_000, accountId: "a1" }),
      tx({ id: "2", type: "expense", amountMinor: 75_000, accountId: "a1" }),
    ];
    expect(accountBalance(account, list).balanceMinor).toBe(175_000);
  });

  it("moves money out on a transfer and in at the destination", () => {
    const from = acc({ id: "a1" });
    const to = acc({ id: "a2" });
    const transfer = tx({ id: "t", type: "transfer", amountMinor: 80_000, accountId: "a1", toAccountId: "a2" });
    expect(accountBalance(from, [transfer]).balanceMinor).toBe(-80_000);
    expect(accountBalance(to, [transfer]).balanceMinor).toBe(80_000);
  });

  it("corrects itself after a transaction is edited or removed", () => {
    const account = acc({ id: "a1" });
    const before = accountBalance(account, [tx({ id: "1", type: "expense", amountMinor: 30_000 })]);
    expect(before.balanceMinor).toBe(-30_000);

    const after = accountBalance(account, [tx({ id: "1", type: "expense", amountMinor: 12_000 })]);
    expect(after.balanceMinor).toBe(-12_000);

    expect(accountBalance(account, []).balanceMinor).toBe(0);
  });

  it("ignores transactions recorded in a different currency than the account", () => {
    const account = acc({ id: "a1", currency: "UGX" });
    const list = [
      tx({ id: "1", type: "income", amountMinor: 100_000, currency: "UGX", accountId: "a1" }),
      tx({ id: "2", type: "income", amountMinor: 5_000, currency: "USD", accountId: "a1" }),
    ];
    expect(accountBalance(account, list).balanceMinor).toBe(100_000);
  });

  it("totals only accounts sharing the reporting currency", () => {
    const balances = [
      accountBalance(acc({ id: "a1", currency: "UGX", openingBalanceMinor: 100 }), []),
      accountBalance(acc({ id: "a2", currency: "UGX", openingBalanceMinor: 200 }), []),
      accountBalance(acc({ id: "a3", currency: "USD", openingBalanceMinor: 500 }), []),
    ];
    const total = totalInCurrency(balances, "UGX");
    expect(total.totalMinor).toBe(300);
    expect(total.includedCount).toBe(2);
    expect(total.excludedCount).toBe(1);
  });
});

describe("spendingByCategory", () => {
  it("aggregates expenses only, sorted by size", () => {
    const categories = [cat({ id: "c1", name: "Food" }), cat({ id: "c2", name: "Transport" })];
    const list = [
      tx({ id: "1", type: "expense", amountMinor: 30_000, categoryId: "c1" }),
      tx({ id: "2", type: "expense", amountMinor: 20_000, categoryId: "c1" }),
      tx({ id: "3", type: "expense", amountMinor: 10_000, categoryId: "c2" }),
      tx({ id: "4", type: "income", amountMinor: 999_999, categoryId: "c1" }),
    ];
    const { slices } = spendingByCategory(list, categories, "UGX", M);
    expect(slices).toHaveLength(2);
    expect(slices[0].categoryId).toBe("c1");
    expect(slices[0].totalMinor).toBe(50_000);
    expect(slices[0].count).toBe(2);
    expect(slices[0].share).toBe(83); // 50k of 60k
  });
});

describe("budgetPerformance", () => {
  const categories = [cat({ id: "c1" })];
  const budget: Budget = {
    id: "b1",
    categoryId: "c1",
    currency: "UGX",
    amountMinor: 200_000,
    startsOn: "2026-01",
    createdAt: "",
    updatedAt: "",
    revision: 1,
  };

  it("reports spent, remaining and a daily allowance", () => {
    const list = [tx({ id: "1", type: "expense", amountMinor: 150_000, categoryId: "c1" })];
    const [perf] = budgetPerformance([budget], categories, list, "UGX", M, 10);
    expect(perf.spentMinor).toBe(150_000);
    expect(perf.remainingMinor).toBe(50_000);
    expect(perf.usedPercent).toBe(75);
    expect(perf.status).toBe("watch"); // 75% sits between the 60% and 85% thresholds
    expect(perf.dailyAllowanceMinor).toBe(5_000); // 50k across 10 days
  });

  it.each([
    [100_000, "ok"],
    [130_000, "watch"],
    [175_000, "near"],
    [210_000, "over"],
  ])("marks %d spent as %s", (spent, expected) => {
    const list = [tx({ id: "1", type: "expense", amountMinor: spent, categoryId: "c1" })];
    expect(budgetPerformance([budget], categories, list, "UGX", M, 10)[0].status).toBe(expected);
  });

  it("ignores transfers and other categories", () => {
    const list = [
      tx({ id: "1", type: "transfer", amountMinor: 500_000, categoryId: "c1", toAccountId: "a2" }),
      tx({ id: "2", type: "expense", amountMinor: 40_000, categoryId: "other" }),
    ];
    expect(budgetPerformance([budget], categories, list, "UGX", M, 10)[0].spentMinor).toBe(0);
  });

  it("does not apply a budget before its start month", () => {
    const future = { ...budget, startsOn: "2026-06" };
    expect(budgetPerformance([future], categories, [], "UGX", M, 10)).toHaveLength(0);
  });

  it("offers no allowance once the budget is exceeded", () => {
    const list = [tx({ id: "1", type: "expense", amountMinor: 300_000, categoryId: "c1" })];
    expect(budgetPerformance([budget], categories, list, "UGX", M, 10)[0].dailyAllowanceMinor).toBe(0);
  });
});

describe("goalProgress", () => {
  const goal: SavingsGoal = {
    id: "g1",
    name: "Emergency fund",
    targetAmountMinor: 1_000_000,
    currency: "UGX",
    icon: "Shield",
    hue: 1,
    archived: false,
    createdAt: "",
    updatedAt: "",
    revision: 1,
  };

  function contribution(id: string, amountMinor: number, date = "2026-04-01"): GoalContribution {
    return {
      id,
      goalId: "g1",
      amountMinor,
      currency: "UGX",
      date,
      createdAt: "",
      updatedAt: "",
      revision: 1,
    };
  }

  it("sums signed contributions", () => {
    const p = goalProgress(goal, [
      contribution("1", 400_000),
      contribution("2", 300_000),
      contribution("3", -50_000),
    ]);
    expect(p.savedMinor).toBe(650_000);
    expect(p.remainingMinor).toBe(350_000);
    expect(p.progressPercent).toBe(65);
    expect(p.isComplete).toBe(false);
  });

  it("caps displayed progress at 100 while keeping the true total", () => {
    const p = goalProgress(goal, [contribution("1", 1_400_000)]);
    expect(p.savedMinor).toBe(1_400_000);
    expect(p.progressPercent).toBe(100);
    expect(p.remainingMinor).toBe(0);
    expect(p.isComplete).toBe(true);
  });

  it("computes the required monthly contribution from a target date", () => {
    const target = new Date();
    target.setMonth(target.getMonth() + 10);
    const iso = target.toISOString().slice(0, 10);
    const p = goalProgress({ ...goal, targetDate: iso }, [contribution("1", 200_000)]);
    expect(p.monthsRemaining).toBe(10);
    expect(p.requiredMonthlyMinor).toBe(80_000); // 800k over 10 months
  });

  it("isolates contributions to the goal being measured", () => {
    const other = { ...contribution("z", 999_999), goalId: "g2" };
    expect(goalProgress(goal, [other]).savedMinor).toBe(0);
  });

  it("reports the most recent contribution date", () => {
    const p = goalProgress(goal, [contribution("1", 100, "2026-04-01"), contribution("2", 100, "2026-04-20")]);
    expect(p.lastContributionDate).toBe("2026-04-20");
  });
});

describe("changePercent", () => {
  it("computes a signed change", () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(75, 100)).toBe(-25);
  });

  it("returns null when there is no baseline", () => {
    expect(changePercent(100, 0)).toBeNull();
  });

  it("returns 0 when both periods are empty", () => {
    expect(changePercent(0, 0)).toBe(0);
  });
});

describe("date helpers", () => {
  it("groups by local calendar month, not UTC", () => {
    // 2026-04-30 23:30 local would be 2026-05-01 in UTC
    expect(monthKeyOf("2026-04-30")).toBe("2026-04");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("produces a contiguous, ordered window", () => {
    const keys = ["2026-02", "2026-03", "2026-04"];
    keys.forEach((k, i) => {
      if (i > 0) expect(shiftMonth(keys[i - 1], 1)).toBe(k);
    });
  });

  it("accepts the current month key shape", () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});

describe("formatMoney", () => {
  it("renders UGX with no minor units, since its ISO precision is 0", () => {
    expect(formatMoney(150_000, "UGX")).toBe("USh 150,000");
  });

  it("renders two-decimal currencies in cents", () => {
    expect(formatMoney(1_234, "USD")).toBe("$12.34");
    expect(formatMoney(250_000, "USD")).toBe("$2,500.00");
  });

  it("groups thousands in every locale", () => {
    expect(formatMoney(12_345_678, "UGX")).toBe("USh 12,345,678");
  });

  it("applies an explicit sign only when requested", () => {
    expect(formatMoney(1_000, "UGX")).toBe("USh 1,000");
    expect(formatMoney(1_000, "UGX", { signed: true })).toBe("+USh 1,000");
  });

  it("uses a true minus sign (U+2212) for negative amounts", () => {
    expect(formatMoney(-2_500, "UGX")).toBe("\u2212USh 2,500");
  });

  it("compacts very large figures without losing the currency", () => {
    expect(formatMoney(2_500_000_000, "UGX", { compact: true })).toBe("USh 2.5B");
  });

  it("leaves sub-million amounts un-compacted", () => {
    expect(formatMoney(900_000, "UGX", { compact: true })).toBe("USh 900,000");
  });
});
