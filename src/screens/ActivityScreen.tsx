import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/nav/Nav";
import {
  Button,
  Chip,
  IconButton,
  ListGroup,
  SearchField,
  Segmented,
  Select,
  Field,
  Input,
} from "@/components/ui/primitives";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Sheet } from "@/components/ui/Sheet";
import { Money } from "@/components/Money";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import type { Account, Category, Transaction } from "@/db/schema";
import { deleteTransaction } from "@/data/repository";
import { applyFilter } from "@/data/repository";
import { monthlyTotals } from "@/lib/finance";
import { currentMonthKey, dayLabel, monthKeyOf, monthLabel, monthRange, shiftMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/currency";

type TypeFilter = "all" | "income" | "expense" | "transfer";
type SortOrder = "newest" | "oldest";

export function ActivityScreen({
  accounts,
  categories,
  transactions,
  reportingCurrency,
  focusId,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  reportingCurrency: string;
  /** Deep-link target from the Home screen; scrolls the list into view. */
  focusId?: string;
}) {
  const focusRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [accountId, setAccountId] = useState<string>("all");
  const [month, setMonth] = useState(currentMonthKey());
  const [sort, setSort] = useState<SortOrder>("newest");
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sheet, setSheet] = useState<{ open: boolean; transaction?: Transaction }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const range_ = monthRange(month);

  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthKeyOf(t.date) === month),
    [transactions, month],
  );

  const filtered = useMemo(
    () =>
      applyFilter(monthTransactions, {
        type,
        categoryId,
        accountId,
        query,
        sort,
        from: range.from || range_.from,
        to: range.to || range_.to,
      }),
    [monthTransactions, type, categoryId, accountId, query, sort, range, range_],
  );

  const totals = useMemo(
    () => monthlyTotals(filtered, reportingCurrency, month),
    [filtered, reportingCurrency, month],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    if (!focusId) return;
    const frame = requestAnimationFrame(() => focusRef.current?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [focusId, filtered.length]);

  const grouped = useMemo(() => {
    const groups: { label: string; rows: Transaction[] }[] = [];
    const ordered = sort === "newest" ? filtered : filtered;
    for (const tx of ordered) {
      const label = dayLabel(tx.date);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.rows.push(tx);
      else groups.push({ label, rows: [tx] });
    }
    return groups;
  }, [filtered, sort]);

  const isFiltered = type !== "all" || categoryId !== "all" || accountId !== "all" || query !== "" || range.from !== "" || range.to !== "";

  return (
    <>
      <AppShell
        active="activity"
        title="Activity"
        subtitle={
          <span className="tnum">
            {filtered.length} {filtered.length === 1 ? "record" : "records"} ·{" "}
            {formatMoney(totals.incomeMinor, reportingCurrency)} in ·{" "}
            {formatMoney(totals.expenseMinor, reportingCurrency)} out
          </span>
        }
        headerRight={
          <>
            <IconButton
              icon={SlidersHorizontal}
              label="Filters"
              variant={isFiltered ? "primary" : "secondary"}
              onClick={() => setFiltersOpen(true)}
            />
            <IconButton icon={Plus} label="Add transaction" variant="primary" onClick={() => setSheet({ open: true })} />
          </>
        }
      >
        <div className="space-y-4">
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
              className="text-[14.5px] font-semibold tracking-[-0.01em]"
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

          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search descriptions and notes"
          />

          {/* Active filter chips */}
          {isFiltered ? (
            <div className="no-bar -mx-4 flex gap-1.5 overflow-x-auto px-4">
              <Chip active>{type === "all" ? "All types" : type}</Chip>
              {categoryId !== "all" ? <Chip active>{categoryById.get(categoryId)?.name ?? "Category"}</Chip> : null}
              {accountId !== "all" ? <Chip active>{accounts.find((a) => a.id === accountId)?.name ?? "Account"}</Chip> : null}
              <button
                type="button"
                onClick={() => {
                  setType("all");
                  setCategoryId("all");
                  setAccountId("all");
                  setQuery("");
                  setRange({ from: "", to: "" });
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-ink-2"
              >
                <X size={12} strokeWidth={2.6} /> Clear
              </button>
            </div>
          ) : null}

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="In"
              icon={ArrowDownLeft}
              value={<Money amountMinor={totals.incomeMinor} currency={reportingCurrency} size="md" tone="income" />}
            />
            <MiniStat
              label="Out"
              icon={ArrowUpRight}
              value={<Money amountMinor={totals.expenseMinor} currency={reportingCurrency} size="md" />}
            />
            <MiniStat
              label="Net"
              icon={ArrowLeftRight}
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

          {totals.skippedForeignCount > 0 ? (
            <p className="px-1 text-[12px] text-ink-3">
              {totals.skippedForeignCount} {totals.skippedForeignCount === 1 ? "record is" : "records are"} in another
              currency and excluded from these totals.
            </p>
          ) : null}

          {/* List */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={isFiltered ? SlidersHorizontal : Plus}
              title={isFiltered ? "Nothing matches these filters" : "No activity this month"}
              body={
                isFiltered
                  ? "Try widening the date range or clearing a filter."
                  : "Record an expense or income and it will appear here, grouped by day."
              }
              action={
                isFiltered ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setType("all");
                      setCategoryId("all");
                      setAccountId("all");
                      setQuery("");
                      setRange({ from: "", to: "" });
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setSheet({ open: true })}>
                    Add a transaction
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => {
                const dayNet = group.rows.reduce(
                  (sum, t) => sum + (t.type === "income" ? 1 : t.type === "expense" ? -1 : 0) * t.amountMinor,
                  0,
                );
                return (
                  <section key={group.label}>
                    <div className="mb-1.5 flex items-baseline justify-between px-1">
                      <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-3">
                        {group.label}
                      </h3>
                      <span className="tnum text-[12px] font-medium text-ink-3">
                        {group.rows.some((t) => t.type !== "transfer")
                          ? formatMoney(dayNet, group.rows[0].currency)
                          : "Transfers only"}
                      </span>
                    </div>
                    <ListGroup>
                      {group.rows.map((t) => (
                        <div key={t.id} ref={t.id === focusId ? focusRef : undefined}>
                        <TransactionRow
                          transaction={t}
                          category={categoryById.get(t.categoryId ?? "")}
                          accounts={accounts}
                          onClick={() => setSheet({ open: true, transaction: t })}
                        />
                        </div>
                      ))}
                    </ListGroup>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>

      {/* Filters sheet */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        subtitle="Narrow this month's records"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setType("all");
                setCategoryId("all");
                setAccountId("all");
                setRange({ from: "", to: "" });
                setQuery("");
              }}
            >
              Reset
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setFiltersOpen(false)}>
              Apply
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Type">
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: "All" },
                { value: "income", label: "Income" },
                { value: "expense", label: "Expense" },
                { value: "transfer", label: "Transfer" },
              ]}
            />
          </Field>

          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="from">
              <Input id="from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            </Field>
            <Field label="To" htmlFor="to">
              <Input id="to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </Field>
          </div>

          <Field label="Sort">
            <Segmented
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ]}
            />
          </Field>
        </div>
      </Sheet>

      <TransactionSheet
        mode={{ open: sheet.open, transaction: sheet.transaction }}
        accounts={accounts}
        categories={categories}
        reportingCurrency={reportingCurrency}
        onClose={() => setSheet({ open: false })}
        footerExtra={
          sheet.transaction ? (
            <DeleteAffordance
              transaction={sheet.transaction}
              onDelete={() => {
                setPendingDelete(sheet.transaction ?? null);
                setSheet({ open: false });
              }}
            />
          ) : undefined
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this transaction?"
        body={
          pendingDelete ? (
            <>
              <strong className="font-semibold text-ink">{pendingDelete.description}</strong> for{" "}
              {formatMoney(pendingDelete.amountMinor, pendingDelete.currency)} will be removed. Your account balances and
              budgets will recalculate. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteTransaction(pendingDelete.id);
          toast("Transaction deleted", { tone: "success", detail: "Balances recalculated." });
          setPendingDelete(null);
        }}
      />
    </>
  );
}

function MiniStat({
  label,
  icon: Icon,
  value,
}: {
  label: string;
  icon: typeof Plus;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon size={13} strokeWidth={2.2} className="text-ink-3" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">{label}</p>
      </div>
      <p className="mt-1">{value}</p>
    </div>
  );
}

/**
 * Rendered inside the transaction sheet's footer when a record is being edited,
 * giving a discoverable delete path. Kept separate so the create flow stays clean.
 */
function DeleteAffordance({ transaction, onDelete }: { transaction: Transaction; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="mt-3">
      {armed ? (
        <div className="flex items-center gap-2 rounded-sm bg-danger-wash px-3 py-2.5">
          <p className="flex-1 text-[12.5px] text-danger">Delete this record permanently?</p>
          <Button size="sm" variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setArmed(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-sm border border-line px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-ink-2">{transaction.description}</p>
            <p className="text-[11.5px] text-ink-3">
              Recorded {dayLabel(transaction.date)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <IconButton icon={Trash2} label="Delete transaction" variant="danger" size={32} onClick={() => setArmed(true)} />
          </div>
        </div>
      )}
    </div>
  );
}
