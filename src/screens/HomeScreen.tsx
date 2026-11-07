import { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet,
  CalendarClock,
  ArrowRight,
  PiggyBank,
  Landmark,
} from "lucide-react";
import { AppShell } from "@/components/nav/Nav";
import { Button, Card, IconButton, ListGroup, ListRow, ProgressBar, SectionHeader, cn } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/feedback";
import { Money } from "@/components/Money";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { iconFor } from "@/design/icons";
import type { Account, Budget, Category, GoalContribution, SavingsGoal, Transaction } from "@/db/schema";
import {
  accountBalances,
  budgetPerformance,
  monthlyTotals,
  totalInCurrency,
} from "@/lib/finance";
import { currentMonthKey, daysRemainingInMonth, monthLabel, shiftMonth, dayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/currency";
import { navigate } from "@/state/router";
import { usePrivacyToggle } from "@/state/settings";
import { percentOf } from "@/lib/money";

export function HomeScreen({
  accounts,
  categories,
  transactions,
  budgets,
  goals,
  contributions,
  recurring,
  reportingCurrency,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  contributions: GoalContribution[];
  recurring: { id: string; label: string; nextDate: string; amountMinor: number; currency: string; type: string }[];
  reportingCurrency: string;
}) {
  const [hidden, setHidden] = usePrivacyToggle();
  const [sheet, setSheet] = useState<{ open: boolean; presetType?: "expense" | "income" | "transfer" }>({ open: false });

  const month = currentMonthKey();
  const daysLeft = daysRemainingInMonth(month);

  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions]);
  const total = useMemo(() => totalInCurrency(balances, reportingCurrency), [balances, reportingCurrency]);
  const totals = useMemo(() => monthlyTotals(transactions, reportingCurrency, month), [transactions, reportingCurrency, month]);
  const previous = useMemo(
    () => monthlyTotals(transactions, reportingCurrency, shiftMonth(month, -1)),
    [transactions, reportingCurrency, month],
  );

  const budgetsPerf = useMemo(
    () => budgetPerformance(budgets, categories, transactions, reportingCurrency, month, daysLeft),
    [budgets, categories, transactions, reportingCurrency, month, daysLeft],
  );

  const recent = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [transactions],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const spendChange = totals.expenseMinor !== 0 || previous.expenseMinor !== 0
    ? percentOf(totals.expenseMinor - previous.expenseMinor, Math.abs(previous.expenseMinor) || 1, 0)
    : null;

  const budgetAllocated = budgetsPerf.reduce((s, b) => s + b.allocatedMinor, 0);
  const budgetSpent = budgetsPerf.reduce((s, b) => s + b.spentMinor, 0);
  const budgetUsedPct = budgetAllocated > 0 ? percentOf(budgetSpent, budgetAllocated) : 0;

  const upcoming = useMemo(
    () => [...recurring].filter((r) => r.nextDate >= new Date().toISOString().slice(0, 10)).slice(0, 3),
    [recurring],
  );

  return (
    <>
      <AppShell
        active="home"
        title="Overview"
        subtitle={
          <span className="tnum">
            {monthLabel(month)} · {totals.transactionCount}{" "}
            {totals.transactionCount === 1 ? "transaction" : "transactions"} this month
          </span>
        }
        headerRight={
          <>
            <IconButton
              icon={hidden ? EyeOff : Eye}
              label={hidden ? "Show amounts" : "Hide amounts"}
              variant="secondary"
              onClick={() => setHidden(!hidden)}
            />
            <IconButton
              icon={Settings}
              label="Settings"
              variant="secondary"
              onClick={() => navigate("/settings")}
            />
          </>
        }
      >
        <div className="space-y-6">
          {/* ---- Balance --------------------------------------------------- */}
          <Card className="overflow-hidden !p-0">
            <div className="px-4 pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow text-ink-3">Available · {reportingCurrency}</p>
                  <div className="mt-1.5">
                    <Money
                      amountMinor={total.totalMinor}
                      currency={reportingCurrency}
                      size="xl"
                      tone={total.totalMinor < 0 ? "expense" : "neutral"}
                    />
                  </div>
                  <p className="mt-2 ts-footnote text-ink-3">
                    {total.includedCount > 0
                      ? `Across ${total.includedCount} ${total.includedCount === 1 ? "account" : "accounts"}`
                      : "No accounts yet"}
                    {total.excludedCount > 0
                      ? ` · ${total.excludedCount} in other ${total.excludedCount === 1 ? "currency" : "currencies"} shown separately`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHidden(!hidden)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition active:scale-[0.94]"
                  aria-label={hidden ? "Show amounts" : "Hide amounts"}
                >
                  {hidden ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-line border-t border-line bg-surface-2">
              <Stat label="Income" value={<Money amountMinor={totals.incomeMinor} currency={reportingCurrency} size="md" tone="income" />} />
              <Stat label="Spent" value={<Money amountMinor={totals.expenseMinor} currency={reportingCurrency} size="md" />} />
              <Stat
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
            </div>
          </Card>

          {/* ---- Foreign currency note ------------------------------------ */}
          {totals.skippedForeignCount > 0 ? (
            <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3.5 py-3">
              <Landmark size={16} strokeWidth={2} className="mt-px shrink-0 text-ink-3" />
              <p className="ts-footnote leading-snug text-ink-2">
                {totals.skippedForeignCount}{" "}
                {totals.skippedForeignCount === 1 ? "transaction is" : "transactions are"} in another currency without a
                rate, so {totals.skippedForeignCount === 1 ? "it is" : "they are"} left out of these totals. Add a rate on
                the record to include {totals.skippedForeignCount === 1 ? "it" : "them"}.
              </p>
            </div>
          ) : null}

          {/* ---- Quick actions -------------------------------------------- */}
          <div className="grid grid-cols-3 gap-2">
            <QuickAction
              icon={Plus}
              label="Add expense"
              onClick={() => setSheet({ open: true, presetType: "expense" })}
              primary
            />
            <QuickAction
              icon={TrendingUp}
              label="Add income"
              onClick={() => setSheet({ open: true, presetType: "income" })}
            />
            <QuickAction icon={Wallet} label="Accounts" onClick={() => navigate("/accounts")} />
          </div>

          {/* ---- Accounts -------------------------------------------------- */}
          <section>
            <SectionHeader
              title="Accounts"
              hint={accounts.length > 0 ? `${accounts.length} ${accounts.length === 1 ? "wallet" : "wallets"}` : undefined}
              action={<TextLink onClick={() => navigate("/accounts")}>All</TextLink>}
            />
            {accounts.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No accounts yet"
                body="Add where your money lives — cash, mobile money, a bank account — and your balances build themselves."
                action={
                  <Button size="sm" variant="secondary" onClick={() => navigate("/accounts")}>
                    Add an account
                  </Button>
                }
                compact
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {balances.slice(0, 4).map(({ account, balanceMinor }) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => navigate(`/account/${account.id}`)}
                    className="press flex items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-3 text-left transition"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2",
                        "text-ink-2",
                      )}
                    >
                      <AccountGlyph type={account.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate ts-callout font-medium">{account.name}</span>
                      <span className="block ts-caption-1 text-ink-3">{account.currency}</span>
                    </span>
                    <Money amountMinor={balanceMinor} currency={account.currency} size="md" tone={balanceMinor < 0 ? "expense" : "neutral"} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ---- Budget overview ------------------------------------------ */}
          <section>
            <SectionHeader
              title="Budgets"
              hint={
                budgetAllocated > 0
                  ? `${formatMoney(budgetAllocated - budgetSpent, reportingCurrency)} left with ${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go`
                  : undefined
              }
              action={<TextLink onClick={() => navigate("/budgets")}>Details</TextLink>}
            />
            {budgetsPerf.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title="No budgets set"
                body="A monthly cap on your biggest categories is the fastest way to see where money goes."
                action={
                  <Button size="sm" variant="secondary" onClick={() => navigate("/budgets")}>
                    Set a budget
                  </Button>
                }
                compact
              />
            ) : (
              <Card padded={false} className="!p-3.5">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="ts-footnote font-semibold text-ink-2">
                    {formatMoney(budgetSpent, reportingCurrency)} of {formatMoney(budgetAllocated, reportingCurrency)}
                  </p>
                  <span className="tnum ts-footnote text-ink-3">{budgetUsedPct}% used</span>
                </div>
                <ProgressBar
                  value={budgetUsedPct}
                  tone={budgetUsedPct >= 100 ? "expense" : budgetUsedPct >= 85 ? "warning" : "accent"}
                  height={8}
                />
                <div className="mt-3 space-y-2.5">
                  {budgetsPerf.slice(0, 3).map((b) => (
                    <div key={b.budget.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 ts-footnote font-medium text-ink">
                          <span aria-hidden>{iconFor(b.category?.icon) && <CategoryGlyph name={b.category?.icon} />}</span>
                          <span className="truncate">{b.category?.name ?? "Uncategorised"}</span>
                        </span>
                        <span
                          className={cn(
                            "tnum shrink-0 ts-caption-1 font-semibold",
                            b.status === "over" ? "text-expense" : b.status === "near" ? "text-warning" : "text-ink-3",
                          )}
                        >
                          {formatMoney(Math.abs(b.remainingMinor), reportingCurrency)}
                          {b.status === "over" ? " over" : " left"}
                        </span>
                      </div>
                      <ProgressBar
                        value={b.usedPercent}
                        height={5}
                        tone={b.status === "over" ? "expense" : b.status === "near" ? "warning" : b.status === "watch" ? "accent" : "accent"}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>

          {/* ---- Upcoming -------------------------------------------------- */}
          {upcoming.length > 0 ? (
            <section>
              <SectionHeader title="Upcoming" hint="Expected recurring movements" />
              <ListGroup>
                {upcoming.map((r) => (
                  <ListRow key={r.id} onClick={() => navigate("/activity")}>
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2"
                    >
                      <CalendarClock size={17} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate ts-callout font-medium">{r.label}</span>
                      <span className="block ts-caption-1 text-ink-3">{dayLabel(r.nextDate)}</span>
                    </span>
                    <Money
                      amountMinor={r.amountMinor}
                      currency={r.currency}
                      size="md"
                      tone={r.type === "income" ? "income" : "muted"}
                    />
                  </ListRow>
                ))}
              </ListGroup>
            </section>
          ) : null}

          {/* ---- Recent ---------------------------------------------------- */}
          <section>
            <SectionHeader
              title="Recent activity"
              action={<TextLink onClick={() => navigate("/activity")}>See all</TextLink>}
            />
            {recent.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="Nothing recorded yet"
                body="Add your first transaction and your balances, budgets and insights all start working."
                action={
                  <Button size="sm" onClick={() => setSheet({ open: true })}>
                    Add a transaction
                  </Button>
                }
                compact
              />
            ) : (
              <ListGroup>
                {recent.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={categoryById.get(t.categoryId ?? "")}
                    accounts={accounts}
                    onClick={() => navigate(`/activity?focus=${t.id}`)}
                    showDate
                  />
                ))}
              </ListGroup>
            )}
          </section>

          {/* ---- Goals teaser ---------------------------------------------- */}
          {goals.length > 0 ? (
            <section>
              <SectionHeader
                title="Saving goals"
                action={<TextLink onClick={() => navigate("/goals")}>All goals</TextLink>}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {goals.slice(0, 2).map((g) => {
                  const saved = contributions
                    .filter((c) => c.goalId === g.id)
                    .reduce((s, c) => s + c.amountMinor, 0);
                  const pct = percentOf(saved, g.targetAmountMinor);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => navigate(`/goal/${g.id}`)}
                      className="press rounded-md border border-line bg-surface p-3.5 text-left transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-[8px]",
                            `bg-hue${g.hue}-wash`,
                            `text-hue${g.hue}`,
                          )}
                        >
                          <CategoryGlyph name={g.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate ts-subhead-emph">{g.name}</span>
                          <span className="block ts-caption-1 text-ink-3">{pct}% funded</span>
                        </span>
                        <ArrowRight size={15} strokeWidth={2.1} className="shrink-0 text-ink-3" />
                      </div>
                      <div className="mt-2.5">
                        <ProgressBar value={pct} height={5} tone="income" />
                      </div>
                      <p className="mt-1.5 ts-caption-1 text-ink-3">
                        <Money amountMinor={saved} currency={g.currency} size="sm" tone="muted" /> of{" "}
                        <Money amountMinor={g.targetAmountMinor} currency={g.currency} size="sm" tone="muted" />
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {spendChange !== null && previous.expenseMinor > 0 ? (
            <div className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3.5 py-3">
              {spendChange > 0 ? (
                <TrendingDown size={16} strokeWidth={2.1} className="shrink-0 text-expense" />
              ) : (
                <TrendingUp size={16} strokeWidth={2.1} className="shrink-0 text-income" />
              )}
              <p className="ts-footnote text-ink-2">
                You {spendChange > 0 ? "spent" : "cut back"}{" "}
                <strong className="font-semibold text-ink">{Math.abs(spendChange)}%</strong>{" "}
                {spendChange > 0 ? "more" : "less"} than {monthLabel(shiftMonth(month, -1), "short")}.
              </p>
            </div>
          ) : null}
        </div>
      </AppShell>

      <TransactionSheet
        mode={{ open: sheet.open, presetType: sheet.presetType }}
        accounts={accounts}
        categories={categories}
        reportingCurrency={reportingCurrency}
        onClose={() => setSheet({ open: false })}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <p className="eyebrow text-ink-3">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press flex h-[58px] flex-col items-center justify-center gap-1 rounded-md border transition",
        primary
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-surface text-ink-2",
      )}
    >
      <Icon size={18} strokeWidth={2.2} />
      <span className="ts-caption-1 font-semibold">{label}</span>
    </button>
  );
}

function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 ts-footnote font-semibold text-accent transition active:opacity-60"
    >
      {children}
      <ArrowRight size={13} strokeWidth={2.4} />
    </button>
  );
}

function CategoryGlyph({ name }: { name?: string }) {
  const Icon = iconFor(name);
  return <Icon size={15} strokeWidth={2.2} />;
}

function AccountGlyph({ type }: { type: Account["type"] }) {
  const map: Record<Account["type"], typeof Wallet> = {
    cash: Wallet,
    mobile: Wallet,
    bank: Landmark,
    savings: PiggyBank,
    other: Wallet,
  };
  const Icon = map[type] ?? Wallet;
  return <Icon size={17} strokeWidth={2} />;
}

