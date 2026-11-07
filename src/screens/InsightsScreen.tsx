import { useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/nav/Nav";
import { Card, ProgressBar, SectionHeader, cn } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/feedback";
import { Money } from "@/components/Money";
import { iconFor } from "@/design/icons";
import type { Budget, Category, GoalContribution, SavingsGoal, Transaction } from "@/db/schema";
import { allGoalProgress, budgetPerformance, changePercent, monthlyTotals, monthlyTrend, spendingByCategory } from "@/lib/finance";
import { currentMonthKey, daysRemainingInMonth, monthLabel, monthLabelShort, recentMonthKeys, shiftMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/currency";
import { percentOf } from "@/lib/money";

/** Recharts needs concrete pixel sizes but colours come from our tokens. */
const C = {
  ink: "var(--p-ink-2)",
  muted: "var(--p-ink-3)",
  line: "var(--p-line)",
  surface: "var(--p-surface)",
  accent: "var(--p-accent)",
  income: "var(--p-income)",
  expense: "var(--p-expense)",
  warning: "var(--p-warning)",
};

const HUES = Array.from({ length: 10 }, (_, i) => `var(--p-hue${i + 1})`);

function TooltipCard({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-line bg-elevated px-2.5 py-2 shadow-[var(--shadow-card)]">
      <p className="mb-1 ts-caption-2 font-semibold text-ink-3">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.name)} className="flex items-center gap-1.5 ts-footnote">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-ink-2">{entry.name}</span>
          <span className="tnum ml-auto font-semibold text-ink">
            {formatMoney(Number(entry.value ?? 0), currency)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function InsightsScreen({
  transactions,
  categories,
  budgets,
  goals,
  contributions,
  reportingCurrency,
}: {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: SavingsGoal[];
  contributions: GoalContribution[];
  reportingCurrency: string;
}) {
  const month = currentMonthKey();
  const daysLeft = daysRemainingInMonth(month);
  const months = useMemo(() => recentMonthKeys(6, month), [month]);

  const totals = useMemo(() => monthlyTotals(transactions, reportingCurrency, month), [transactions, reportingCurrency, month]);
  const previous = useMemo(
    () => monthlyTotals(transactions, reportingCurrency, shiftMonth(month, -1)),
    [transactions, reportingCurrency, month],
  );

  const trend = useMemo(
    () => monthlyTrend(transactions, reportingCurrency, months),
    [transactions, reportingCurrency, months],
  );

  const breakdown = useMemo(
    () => spendingByCategory(transactions, categories, reportingCurrency, month),
    [transactions, categories, reportingCurrency, month],
  );

  const budgetsPerf = useMemo(
    () => budgetPerformance(budgets, categories, transactions, reportingCurrency, month, daysLeft),
    [budgets, categories, transactions, reportingCurrency, month, daysLeft],
  );

  const goalProgress = useMemo(() => allGoalProgress(goals, contributions), [goals, contributions]);

  const hasData = transactions.length > 0;
  const hasTrend = trend.some((p) => p.incomeMinor !== 0 || p.expenseMinor !== 0);

  const savingsRate =
    totals.incomeMinor > 0 ? percentOf(totals.incomeMinor - totals.expenseMinor, totals.incomeMinor) : null;

  const expenseChange = changePercent(totals.expenseMinor, previous.expenseMinor);
  const incomeChange = changePercent(totals.incomeMinor, previous.incomeMinor);

  const chartData = trend.map((p) => ({
    label: monthLabelShort(p.month),
    Income: p.incomeMinor,
    Spending: p.expenseMinor,
  }));

  const pieData = breakdown.slices
    .slice(0, 6)
    .map((s) => ({ name: breakdown.byId.get(s.categoryId)?.name ?? "Other", value: s.totalMinor, id: s.categoryId }));

  return (
    <AppShell
      active="insights"
      title="Insights"
      subtitle={
        <span className="tnum">
          {monthLabel(month)} · derived from {transactions.length} stored{" "}
          {transactions.length === 1 ? "record" : "records"}
        </span>
      }
      wide
    >
      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Not enough data yet"
          body="Charts appear once you have recorded a few transactions. Everything here is calculated from your own records — nothing is estimated."
        />
      ) : (
        <div className="space-y-6">
          {/* ---- Headline -------------------------------------------------- */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Headline
              label="Income"
              value={<Money amountMinor={totals.incomeMinor} currency={reportingCurrency} size="md" tone="income" />}
              change={incomeChange}
            />
            <Headline
              label="Spending"
              value={<Money amountMinor={totals.expenseMinor} currency={reportingCurrency} size="md" />}
              change={expenseChange}
              invert
            />
            <Headline
              label="Net"
              value={
                <Money
                  amountMinor={totals.netMinor}
                  currency={reportingCurrency}
                  size="md"
                  signed
                  tone={totals.netMinor < 0 ? "expense" : "income"}
                />
              }
            />
            <Headline
              label="Saved"
              value={
                savingsRate !== null ? (
                  <>
                    <span className="tnum text-[19px] font-semibold">{savingsRate}%</span>
                    <span className="mt-0.5 block ts-caption-1 text-ink-3">of income</span>
                  </>
                ) : (
                  <span className="ts-subheadline text-ink-3">No income yet</span>
                )
              }
            />
          </div>

          {totals.skippedForeignCount > 0 ? (
            <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3.5 py-3">
              <Info size={15} strokeWidth={2} className="mt-px shrink-0 text-ink-3" />
              <p className="ts-footnote leading-snug text-ink-2">
                {totals.skippedForeignCount}{" "}
                {totals.skippedForeignCount === 1 ? "record is" : "records are"} in another currency without a rate and
                {totals.skippedForeignCount === 1 ? " is" : " are"} excluded from every chart on this screen.
              </p>
            </div>
          ) : null}

          {/* ---- Income vs spending --------------------------------------- */}
          <section>
            <SectionHeader title="Income versus spending" hint="Last six months" />
            <Card padded={false} className="!p-3">
              {hasTrend ? (
                <div className="h-[220px] w-full sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.income} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={C.income} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.accent} stopOpacity={0.26} />
                          <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={C.line} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} dy={6} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickFormatter={(v: number) => {
                          const major = v / 10 ** 0;
                          return Math.abs(major) >= 1_000_000
                            ? `${(major / 1_000_000).toFixed(1)}M`
                            : Math.abs(major) >= 1000
                              ? `${Math.round(major / 1000)}k`
                              : String(major);
                        }}
                      />
                      <Tooltip
                        content={<TooltipCard currency={reportingCurrency} />}
                        cursor={{ stroke: C.line, strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Income"
                        stroke={C.income}
                        strokeWidth={2}
                        fill="url(#fillIncome)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="Spending"
                        stroke={C.accent}
                        strokeWidth={2}
                        fill="url(#fillExpense)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No comparable history yet"
                  body="Once you have a month or two of records, this shows the shape of your income against your spending."
                  compact
                />
              )}
            </Card>
          </section>

          {/* ---- Spending by category -------------------------------------- */}
          <section>
            <SectionHeader
              title="Where money went"
              hint={`${monthLabel(month)} · ${breakdown.slices.length} ${
                breakdown.slices.length === 1 ? "category" : "categories"
              }`}
            />
            {breakdown.slices.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No spending this month"
                body="Record an expense and the breakdown appears here."
                compact
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <Card padded={false} className="!p-3">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="58%"
                          outerRadius="86%"
                          paddingAngle={1.5}
                          stroke="none"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={entry.id} fill={HUES[i % HUES.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<TooltipCard currency={reportingCurrency} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card padded={false} className="!p-3.5">
                  <ul className="space-y-2.5">
                    {breakdown.slices.map((slice, i) => {
                      const meta = breakdown.byId.get(slice.categoryId);
                      const Icon = iconFor(meta?.icon);
                      return (
                        <li key={slice.categoryId} className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "grid h-7 w-7 shrink-0 place-items-center rounded-[8px]",
                              `bg-hue${meta?.hue ?? 7}-wash`,
                              `text-hue${meta?.hue ?? 7}`,
                            )}
                          >
                            <Icon size={14} strokeWidth={2.2} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate ts-footnote font-medium">{meta?.name ?? "Other"}</span>
                              <span className="tnum shrink-0 ts-footnote-emph">
                                {formatMoney(slice.totalMinor, reportingCurrency)}
                              </span>
                            </span>
                            <span className="mt-1 block">
                              <ProgressBar
                                value={slice.share}
                                height={4}
                                track="bg-surface-2"
                                className=""
                              />
                            </span>
                          </span>
                          <span className="tnum w-9 shrink-0 text-right ts-caption-1 text-ink-3">{slice.share}%</span>
                          <span aria-hidden className="w-2 shrink-0 rounded-full" style={{ background: HUES[i % HUES.length], height: 8 }} />
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>
            )}
          </section>

          {/* ---- Budget performance ---------------------------------------- */}
          {budgetsPerf.length > 0 ? (
            <section>
              <SectionHeader title="Budget performance" hint={monthLabel(month)} />
              <Card padded={false} className="!p-3">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={budgetsPerf.map((b) => ({
                        name: (b.category?.name ?? "Other").slice(0, 9),
                        Spent: b.spentMinor,
                        Cap: b.allocatedMinor,
                      }))}
                      margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                      barGap={2}
                    >
                      <CartesianGrid vertical={false} stroke={C.line} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} dy={6} interval={0} angle={-18} height={40} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickFormatter={(v: number) =>
                          Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`
                        }
                      />
                      <Tooltip content={<TooltipCard currency={reportingCurrency} />} cursor={{ fill: "var(--p-surface-2)" }} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: C.muted, paddingTop: 4 }}
                        iconType="circle"
                        iconSize={7}
                      />
                      <Bar dataKey="Spent" radius={[3, 3, 0, 0]} maxBarSize={26}>
                        {budgetsPerf.map((b) => (
                          <Cell
                            key={b.budget.id}
                            fill={b.status === "over" ? C.expense : b.status === "near" ? C.warning : C.accent}
                          />
                        ))}
                      </Bar>
                      <Bar dataKey="Cap" fill={C.line} radius={[3, 3, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>
          ) : null}

          {/* ---- Savings progress ----------------------------------------- */}
          {goalProgress.length > 0 ? (
            <section>
              <SectionHeader title="Savings progress" hint="Across every goal" />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {goalProgress.map((p) => {
                  const Icon = iconFor(p.goal.icon);
                  return (
                    <Card key={p.goal.id} className="!p-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-[9px]",
                            `bg-hue${p.goal.hue}-wash`,
                            `text-hue${p.goal.hue}`,
                          )}
                        >
                          <Icon size={16} strokeWidth={2.1} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate ts-footnote-emph">{p.goal.name}</p>
                          <p className="ts-caption-1 text-ink-3">{p.progressPercent}% funded</p>
                        </div>
                      </div>
                      <div className="mt-2.5">
                        <ProgressBar value={p.progressPercent} height={5} tone="income" />
                      </div>
                      <p className="mt-1.5 ts-caption-1 text-ink-3">
                        <Money amountMinor={p.savedMinor} currency={p.goal.currency} size="sm" tone="muted" /> of{" "}
                        <Money amountMinor={p.goal.targetAmountMinor} currency={p.goal.currency} size="sm" tone="muted" />
                      </p>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function Headline({
  label,
  value,
  change,
  invert,
}: {
  label: string;
  value: React.ReactNode;
  change?: number | null;
  invert?: boolean;
}) {
  const hasChange = change !== null && change !== undefined;
  const improved = hasChange ? (invert ? change < 0 : change > 0) : false;
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2.5">
      <p className="eyebrow text-ink-3">{label}</p>
      <p className="mt-1">{value}</p>
      {hasChange ? (
        <p
          className={cn(
            "mt-1 inline-flex items-center gap-1 ts-caption-1 font-medium",
            improved ? "text-income" : change === 0 ? "text-ink-3" : "text-expense",
          )}
        >
          {change > 0 ? <TrendingUp size={12} strokeWidth={2.4} /> : <TrendingDown size={12} strokeWidth={2.4} />}
          {change > 0 ? "+" : ""}
          {change}% vs last month
        </p>
      ) : (
        <p className="mt-1 ts-caption-1 text-ink-3">No comparison yet</p>
      )}
    </div>
  );
}
