import { useMemo, useState } from "react";
import { Plus, PieChart, Info, Check, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/nav/Nav";
import {
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  ProgressBar,
  SectionHeader,
  Select,
  cn,
} from "@/components/ui/primitives";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Sheet } from "@/components/ui/Sheet";
import { Money } from "@/components/Money";
import { iconFor } from "@/design/icons";
import type { Budget, Category, Transaction } from "@/db/schema";
import { deleteBudget, setBudget } from "@/data/repository";
import { budgetPerformance } from "@/lib/finance";
import { currentMonthKey, daysRemainingInMonth, monthLabel, shiftMonth } from "@/lib/dates";
import { decimalsOf, formatMoney } from "@/lib/currency";
import { parseAmountToMinor } from "@/lib/money";
import { IconButton } from "@/components/ui/primitives";

export function BudgetsScreen({
  accounts,
  categories,
  transactions,
  budgets,
  reportingCurrency,
}: {
  accounts: { id: string; currency: string }[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  reportingCurrency: string;
}) {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonthKey());
  const [editing, setEditing] = useState<{ open: boolean; categoryId?: string }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null);

  const daysLeft = daysRemainingInMonth(month);

  const performance = useMemo(
    () => budgetPerformance(budgets, categories, transactions, reportingCurrency, month, daysLeft),
    [budgets, categories, transactions, reportingCurrency, month, daysLeft],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const allocated = performance.reduce((s, b) => s + b.allocatedMinor, 0);
  const spent = performance.reduce((s, b) => s + b.spentMinor, 0);
  const usedPct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
  const remaining = allocated - spent;

  const budgetedIds = new Set(budgets.map((b) => b.categoryId));
  const unbudgeted = categories
    .filter((c) => c.kind === "expense" && !budgetedIds.has(c.id))
    .map((c) => ({
      category: c,
      spent: transactions
        .filter((t) => t.type === "expense" && t.categoryId === c.id && t.date.startsWith(month))
        .reduce((s, t) => s + t.amountMinor, 0),
    }))
    .filter((entry) => entry.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  return (
    <>
      <AppShell
        active="budgets"
        title="Budgets"
        subtitle={
          performance.length > 0 ? (
            <span className="tnum">
              {formatMoney(remaining, reportingCurrency)} {remaining >= 0 ? "remaining" : "over"} ·{" "}
              {performance.length} {performance.length === 1 ? "category" : "categories"}
            </span>
          ) : (
            "Monthly caps by category"
          )
        }
        headerRight={
          <Button size="sm" icon={Plus} onClick={() => setEditing({ open: true })}>
            New
          </Button>
        }
      >
        <div className="space-y-5">
          {/* Month stepper */}
          <div className="flex items-center justify-between rounded-md border border-line bg-surface px-1.5 py-1">
            <IconButton
              icon={ChevronLeft}
              label="Previous month"
              variant="ghost"
              size={34}
              className="text-accent"
              onClick={() => setMonth(shiftMonth(month, -1))}
            />
            <button
              type="button"
              onClick={() => setMonth(currentMonthKey())}
              className="ts-callout font-semibold tracking-[-0.01em]"
            >
              {monthLabel(month)}
            </button>
            <IconButton
              icon={ChevronRight}
              label="Next month"
              variant="ghost"
              size={34}
              className="text-accent"
              onClick={() => setMonth(shiftMonth(month, 1))}
            />
          </div>

          {performance.length === 0 ? (
            <EmptyState
              icon={PieChart}
              title="No budgets yet"
              body="Set a monthly cap on the categories that matter most. Start with groceries or transport — usually the easiest to steer."
              action={
                <Button size="sm" onClick={() => setEditing({ open: true })}>
                  Set your first budget
                </Button>
              }
            />
          ) : (
            <>
              {/* Overview */}
              <Card>
                <div className="flex items-baseline justify-between">
                  <p className="eyebrow text-ink-3">Total allocated</p>
                  <span className="tnum ts-caption-1 font-semibold text-ink-3">{usedPct}% used</span>
                </div>
                <p className="figure-lg tnum mt-1">
                  <Money amountMinor={allocated} currency={reportingCurrency} size="lg" />
                </p>
                <div className="mt-3">
                  <ProgressBar
                    value={usedPct}
                    height={8}
                    tone={usedPct >= 100 ? "expense" : usedPct >= 85 ? "warning" : "accent"}
                  />
                </div>
                <div className="ts-footnote mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-ink-2">
                    Spent <Money amountMinor={spent} currency={reportingCurrency} size="sm" tone="muted" />
                  </span>
                  <span className={remaining >= 0 ? "text-income" : "text-expense"}>
                    {remaining >= 0 ? "Left" : "Over"}{" "}
                    <Money amountMinor={Math.abs(remaining)} currency={reportingCurrency} size="sm" />
                  </span>
                  {remaining > 0 && daysLeft > 0 ? (
                    <span className="text-ink-3">
                      ≈ {formatMoney(Math.floor(remaining / daysLeft), reportingCurrency)} a day for {daysLeft}{" "}
                      {daysLeft === 1 ? "day" : "days"}
                    </span>
                  ) : null}
                </div>
              </Card>

              {/* Per-category */}
              <section>
                <SectionHeader title="By category" hint="Tap to adjust a cap" />
                <ListGroup>
                  {performance.map((p) => {
                    const Icon = iconFor(p.category?.icon);
                    const tone =
                      p.status === "over"
                        ? "expense"
                        : p.status === "near"
                          ? "warning"
                          : p.status === "watch"
                            ? "accent"
                            : "accent";
                    return (
                      <ListRow key={p.budget.id} onClick={() => setEditing({ open: true, categoryId: p.budget.categoryId })}>
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
                            `bg-hue${p.category?.hue ?? 7}-wash`,
                            `text-hue${p.category?.hue ?? 7}`,
                          )}
                        >
                          <Icon size={17} strokeWidth={2} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate ts-subheadline font-medium">{p.category?.name ?? "Uncategorised"}</span>
                            <span className="tnum shrink-0 ts-footnote font-semibold">
                              {formatMoney(p.spentMinor, reportingCurrency)}
                              <span className="font-normal text-ink-3"> / {formatMoney(p.allocatedMinor, reportingCurrency)}</span>
                            </span>
                          </span>

                          <span className="mt-1.5 block">
                            <ProgressBar value={p.usedPercent} height={5} tone={tone} />
                          </span>

                          <span
                            className={cn(
                              "tnum mt-1 block ts-caption-1",
                              p.status === "over" ? "text-expense" : p.status === "near" ? "text-warning" : "text-ink-3",
                            )}
                          >
                            {p.status === "over"
                              ? `${formatMoney(-p.remainingMinor, reportingCurrency)} over cap`
                              : `${formatMoney(p.remainingMinor, reportingCurrency)} left · ${p.usedPercent}%`}
                            {p.transactionCount > 0 ? ` · ${p.transactionCount} ${p.transactionCount === 1 ? "record" : "records"}` : ""}
                          </span>

                          {p.status !== "ok" && p.status !== "over" ? (
                            <span className="mt-1 block ts-caption-1 text-ink-3">
                              {p.dailyAllowanceMinor > 0
                                ? `Spend about ${formatMoney(p.dailyAllowanceMinor, reportingCurrency)} a day to land on target.`
                                : "Nothing left to spend in this category."}
                            </span>
                          ) : null}
                        </span>
                      </ListRow>
                    );
                  })}
                </ListGroup>
              </section>

              {/* How thresholds work */}
              <div className="flex items-start gap-2.5 rounded-md bg-surface-2 px-3.5 py-3">
                <Info size={15} strokeWidth={2} className="mt-px shrink-0 text-ink-3" />
                <p className="ts-footnote leading-snug text-ink-2">
                  Bars shift from accent to amber at 85% and to red only once a cap is exceeded. Transfers never count
                  towards any budget.
                </p>
              </div>
            </>
          )}

          {/* Suggested new budgets */}
          {unbudgeted.length > 0 ? (
            <section>
              <SectionHeader
                title="Categories without a cap"
                hint="You have spending here this month"
              />
              <ListGroup>
                {unbudgeted.map(({ category, spent }) => {
                  const Icon = iconFor(category.icon);
                  return (
                    <ListRow
                      key={category.id}
                      onClick={() => setEditing({ open: true, categoryId: category.id })}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
                          `bg-hue${category.hue}-wash`,
                          `text-hue${category.hue}`,
                        )}
                      >
                        <Icon size={17} strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate ts-subheadline font-medium">{category.name}</span>
                        <span className="block ts-caption-1 text-ink-3">
                          <Money amountMinor={spent} currency={reportingCurrency} size="sm" tone="muted" /> spent this month
                        </span>
                      </span>
                      <Plus size={17} strokeWidth={2.4} className="shrink-0 text-accent" />
                    </ListRow>
                  );
                })}
              </ListGroup>
            </section>
          ) : null}
        </div>
      </AppShell>

      <BudgetSheet
        mode={editing}
        categories={categories}
        reportingCurrency={reportingCurrency}
        suggestedCurrency={accounts[0]?.currency ?? reportingCurrency}
        onClose={() => setEditing({ open: false })}
        onSaved={(label) => toast("Budget saved", { tone: "success", detail: label })}
        onDelete={(budget) => setPendingDelete(budget)}
        budgets={budgets}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this budget?"
        body={
          <>
            The cap for <strong className="font-semibold text-ink">{categoryById.get(pendingDelete?.categoryId ?? "")?.name}</strong>{" "}
            will be removed. Your transactions are kept — only the cap disappears.
          </>
        }
        confirmLabel="Remove cap"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteBudget(pendingDelete.id);
          toast("Budget removed", { tone: "success", detail: "Transactions were not affected." });
          setPendingDelete(null);
        }}
      />
    </>
  );
}

function BudgetSheet({
  mode,
  categories,
  budgets,
  reportingCurrency,
  suggestedCurrency,
  onClose,
  onSaved,
  onDelete,
}: {
  mode: { open: boolean; categoryId?: string };
  categories: Category[];
  budgets: Budget[];
  reportingCurrency: string;
  suggestedCurrency: string;
  onClose: () => void;
  onSaved: (label: string) => void;
  onDelete: (budget: Budget) => void;
}) {
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const existing = mode.categoryId ? budgets.find((b) => b.categoryId === mode.categoryId) : undefined;
  const currency = existing?.currency ?? suggestedCurrency ?? reportingCurrency;
  const decimals = decimalsOf(currency);

  const [categoryId, setCategoryId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync state when the sheet opens for a different category.
  const key = `${mode.open}-${mode.categoryId ?? ""}`;
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    setCategoryId(mode.categoryId ?? expenseCategories[0]?.id ?? "");
    setAmountText(existing ? (existing.amountMinor / 10 ** decimals).toString() : "");
    setError(null);
  }

  const selected = categories.find((c) => c.id === categoryId);

  const submit = async () => {
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    const amount = parseAmountToMinor(amountText, decimals);
    if (amount === null || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    await setBudget({ categoryId, amountMinor: amount, currency });
    onSaved(selected?.name ?? "Budget updated");
    onClose();
  };

  return (
    <Sheet
      open={mode.open}
      onClose={onClose}
      title={existing ? "Edit budget" : "New budget"}
      subtitle="A monthly cap for one category"
      footer={
        <div className="flex gap-2">
          {existing ? (
            <Button variant="danger" size="lg" onClick={() => onDelete(existing)}>
              Remove
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" icon={Check} onClick={submit}>
            Save budget
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Category">
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={Boolean(existing)}
          >
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={`Monthly amount (${currency})`} error={error ?? undefined}>
          <Input
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value.replace(/[^\d.]/g, ""));
              setError(null);
            }}
            placeholder={decimals > 0 ? "0.00" : "0"}
            invalid={Boolean(error)}
            className="tnum text-center !text-[26px] !font-semibold"
          />
        </Field>

        <div className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {[50_000, 100_000, 250_000, 500_000, 1_000_000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountText(String(preset / 10 ** decimals))}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 ts-footnote-emph text-ink-2"
            >
              {formatMoney(preset, currency)}
            </button>
          ))}
        </div>

        {existing ? (
          <div className="flex items-start gap-2.5 rounded-sm bg-surface-2 px-3 py-2.5">
            <AlertTriangle size={15} strokeWidth={2} className="mt-px shrink-0 text-ink-3" />
            <p className="ts-footnote leading-snug text-ink-2">
              Changing this cap applies from {monthLabel(existing.startsOn)} onwards. Past months are not recalculated.
            </p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
