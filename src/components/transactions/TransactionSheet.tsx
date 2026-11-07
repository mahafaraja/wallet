import { useEffect, useMemo, useState } from "react";
import { Delete, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Check } from "lucide-react";
import { Button, Field, Input, Select, TextArea, cn } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/feedback";
import { Money } from "@/components/Money";
import { iconFor } from "@/design/icons";
import { createTransaction, updateTransaction } from "@/data/repository";
import type { Account, Category, Transaction } from "@/db/schema";
import { convertMinor, decimalsOf, formatMoney } from "@/lib/currency";
import { parseAmountToMinor, type Minor } from "@/lib/money";
import { todayISO, type ISODate } from "@/lib/dates";
import { materializeTransaction, validateTransaction, type FieldErrors } from "@/lib/validate";

/**
 * Numeric keypad for amount entry.
 * Digits are appended as text and parsed to minor units on every keystroke, so
 * no intermediate float ever exists.
 */
function Keypad({ onDigit, onBack, onClear }: { onDigit: (d: string) => void; onBack: () => void; onClear: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];
  return (
    <div className="grid grid-cols-3 gap-2 select-none">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onDigit(key)}
          className="figure-keypad grid h-[52px] place-items-center rounded-md bg-surface-2 text-ink transition active:scale-[0.96] active:bg-surface"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={onBack}
        aria-label="Delete last digit"
        className="grid h-[52px] place-items-center rounded-md bg-surface-2 text-ink transition active:scale-[0.96]"
      >
        <Delete size={21} strokeWidth={1.9} />
      </button>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Delete"
          className="sr-only"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onClear}
          className="h-[52px] rounded-md bg-surface-2 text-[12px] font-semibold text-ink-2 transition active:scale-[0.96]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export type TransactionSheetMode = {
  open: boolean;
  /** Present when editing an existing record. */
  transaction?: Transaction;
  /** Preset type when the user came from a quick action. */
  presetType?: Transaction["type"];
};

const TYPE_OPTIONS = [
  { value: "expense" as const, label: "Expense", icon: ArrowUpFromLine },
  { value: "income" as const, label: "Income", icon: ArrowDownToLine },
  { value: "transfer" as const, label: "Transfer", icon: ArrowLeftRight },
];

export function TransactionSheet({
  mode,
  accounts,
  categories,
  reportingCurrency,
  onClose,
  footerExtra,
}: {
  mode: TransactionSheetMode;
  accounts: Account[];
  categories: Category[];
  reportingCurrency: string;
  onClose: () => void;
  /** Optional extra footer content — used for the delete affordance on edit. */
  footerExtra?: React.ReactNode;
}) {
  const { toast } = useToast();
  const editing = mode.transaction;

  const [type, setType] = useState<Transaction["type"]>("expense");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<ISODate>(todayISO());
  const [rateText, setRateText] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  // Reset whenever the sheet opens for a different record.
  useEffect(() => {
    if (!mode.open) return;
    const source = mode.transaction;
    const fallbackAccount = accounts[0]?.id ?? "";
    setType(source?.type ?? mode.presetType ?? "expense");
    setAmountText(source ? (source.amountMinor / 10 ** decimalsOf(source.currency)).toString() : "");
    setAccountId(source?.accountId ?? fallbackAccount);
    setToAccountId(source?.toAccountId ?? accounts.find((a) => a.id !== (source?.accountId ?? fallbackAccount))?.id ?? "");
    setCategoryId(source?.categoryId ?? "");
    setDescription(source?.description ?? "");
    setNotes(source?.notes ?? "");
    setDate(source?.date ?? todayISO());
    setRateText(source?.exchangeRate ? String(source.exchangeRate) : "");
    setErrors({});
  }, [mode.open, mode.transaction, mode.presetType, accounts]);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? reportingCurrency;
  const decimals = decimalsOf(currency);

  const amountMinor = parseAmountToMinor(amountText, decimals) ?? 0;

  const usableCategories = useMemo(
    () => categories.filter((c) => (type === "income" ? c.kind === "income" : c.kind === "expense")),
    [categories, type],
  );

  const needsRate = type !== "transfer" && currency !== reportingCurrency;
  const rate = Number(rateText);
  const rateValid = !needsRate || (Number.isFinite(rate) && rate > 0);

  const convertedMinor: Minor | null = useMemo(() => {
    if (!needsRate || !rateValid || amountMinor <= 0) return null;
    try {
      return convertMinor(amountMinor, { from: currency, to: reportingCurrency, rate });
    } catch {
      return null;
    }
  }, [needsRate, rateValid, amountMinor, currency, reportingCurrency, rate]);

  const submit = async () => {
    const draft = {
      type,
      amountText,
      currency,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      categoryId: type === "transfer" ? undefined : categoryId,
      description,
      notes,
      date,
    };

    const result = validateTransaction(draft);
    if (!result.ok) {
      setErrors(result.errors);
      toast("Check the highlighted fields", { tone: "error", detail: Object.values(result.errors)[0] });
      return;
    }
    if (!rateValid) {
      setErrors({ rate: "Enter the rate you want to use." });
      return;
    }

    // Validation passed — nothing is discarded, the user's text is preserved.
    const parsed = materializeTransaction(draft);

    setBusy(true);
    try {
      const payload = {
        ...parsed,
        exchangeRate: needsRate ? rate : undefined,
        baseCurrency: needsRate ? reportingCurrency : undefined,
        baseAmountMinor: convertedMinor ?? undefined,
      };

      if (editing) {
        await updateTransaction(editing.id, payload);
        toast("Transaction updated", { tone: "success" });
      } else {
        await createTransaction(payload);
        toast(
          type === "transfer" ? "Transfer recorded" : type === "income" ? "Income recorded" : "Expense recorded",
          { tone: "success", detail: formatMoney(amountMinor, currency) },
        );
      }
      onClose();
    } catch (error) {
      toast("Could not save that", { tone: "error", detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const activeType = TYPE_OPTIONS.find((t) => t.value === type)!;

  return (
    <Sheet
      open={mode.open}
      onClose={onClose}
      title={editing ? "Edit transaction" : "New transaction"}
      subtitle={editing ? "Changes recalculate your balances immediately." : undefined}
      size="md"
      footer={
        <div className="space-y-2">
        {footerExtra}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button size="lg" onClick={submit} disabled={busy} className="flex-[1.6]" icon={Check}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save"}
          </Button>
        </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Type */}
        <div className="flex gap-0.5 rounded-sm border border-line bg-surface-2 p-0.5">
          {TYPE_OPTIONS.map((option) => {
            const active = option.value === type;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setType(option.value);
                  setCategoryId("");
                }}
                aria-pressed={active}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[6px] h-9 text-[13px] font-semibold transition-colors",
                  active ? "bg-surface text-ink shadow-card" : "text-ink-2",
                )}
              >
                <option.icon size={14} strokeWidth={2.2} />
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div className="rounded-md border border-line bg-surface-2 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-ink-3">{activeType.label} amount</p>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              {currency}
            </span>
          </div>

          <div className="mt-1.5 flex items-baseline justify-center gap-1">
            <span className={cn("text-[22px] font-medium", amountMinor > 0 ? "text-ink-2" : "text-ink-3")}>
              {decimals > 0 ? formatMoney(0, currency).replace(/[\d.,\s]/g, "") || "·" : ""}
            </span>
            <input
              // A plain text input with a numeric pattern: avoids the iOS
              // number keypad's absent decimal point on some locales.
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.]/g, "");
                setAmountText(next);
                setErrors((prev) => ({ ...prev, amount: "" }));
              }}
              placeholder={decimals > 0 ? "0.00" : "0"}
              aria-label={`Amount in ${currency}`}
              className={cn(
                "tnum w-full min-w-0 flex-1 border-0 bg-transparent text-center text-[40px] font-semibold tracking-[-0.03em] outline-none placeholder:text-ink-3",
                errors.amount ? "text-danger" : "text-ink",
              )}
              style={{ fontSize: "clamp(32px, 11vw, 42px)" }}
            />
          </div>

          {needsRate ? (
            <div className="mt-3 rounded-sm bg-surface p-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="rate" className="text-[11.5px] font-semibold text-ink-2">
                  Rate · 1 {currency} =
                </label>
                <input
                  id="rate"
                  type="text"
                  inputMode="decimal"
                  value={rateText}
                  onChange={(e) => {
                    setRateText(e.target.value.replace(/[^\d.]/g, ""));
                    setErrors((prev) => ({ ...prev, rate: "" }));
                  }}
                  placeholder="0.0000"
                  className="tnum w-[110px] rounded-[6px] border border-line bg-surface-2 px-2 py-1 text-right text-[14px] outline-none focus:border-accent"
                />
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
                {convertedMinor !== null ? (
                  <>
                    Counts as <strong className="font-semibold text-ink-2">{formatMoney(convertedMinor, reportingCurrency)}</strong> in{" "}
                    {reportingCurrency} reports. The original {formatMoney(amountMinor, currency)} is kept unchanged.
                  </>
                ) : (
                  <>
                    Enter your own rate to include this in {reportingCurrency} reports. It is left out otherwise — never
                    converted automatically.
                  </>
                )}
              </p>
            </div>
          ) : null}
        </div>

        {/* Keypad */}
        <Keypad
          onDigit={(d) => {
            setAmountText((prev) => {
              if (d === ".") return prev.includes(".") ? prev : prev === "" ? "0." : `${prev}.`;
              if (prev.includes(".")) {
                const [, frac = ""] = prev.split(".");
                if (frac.length >= decimals) return prev;
              }
              return `${prev}${d}`;
            });
            setErrors((prev) => ({ ...prev, amount: "" }));
          }}
          onBack={() => setAmountText((prev) => prev.slice(0, -1))}
          onClear={() => setAmountText("")}
        />

        {/* Description */}
        <Field label="Description" htmlFor="description" error={errors.description || undefined}>
          <Input
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: "" }));
            }}
            placeholder={type === "transfer" ? "Moved to savings" : "Market shopping"}
            invalid={Boolean(errors.description)}
            autoComplete="off"
            maxLength={80}
          />
        </Field>

        {/* Account */}
        <div className={cn("grid gap-3", type === "transfer" && "sm:grid-cols-2")}>
          <Field
            label={type === "transfer" ? "From account" : "Account"}
            htmlFor="account"
            error={errors.accountId || undefined}
          >
            <Select
              id="account"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setErrors((prev) => ({ ...prev, accountId: "" }));
              }}
              invalid={Boolean(errors.accountId)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </Select>
          </Field>

          {type === "transfer" ? (
            <Field label="To account" htmlFor="toAccount" error={errors.toAccountId || undefined}>
              <Select
                id="toAccount"
                value={toAccountId}
                onChange={(e) => {
                  setToAccountId(e.target.value);
                  setErrors((prev) => ({ ...prev, toAccountId: "" }));
                }}
                invalid={Boolean(errors.toAccountId)}
              >
                <option value="">Choose…</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : null}
        </div>

        {type === "transfer" ? (
          <div className="flex items-start gap-2 rounded-sm bg-accent-wash px-3 py-2.5">
            <ArrowLeftRight size={15} strokeWidth={2.1} className="mt-px shrink-0 text-accent" />
            <p className="text-[12.5px] leading-snug text-ink-2">
              Transfers move money between your accounts. They are never counted as income or spending, so your
              reports stay honest.
            </p>
          </div>
        ) : (
          <Field label="Category" error={errors.categoryId || undefined}>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {usableCategories.map((c) => {
                const Icon = iconFor(c.icon);
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(c.id);
                      setErrors((prev) => ({ ...prev, categoryId: "" }));
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-sm border px-1 py-2 transition",
                      active
                        ? "border-accent bg-accent-wash"
                        : "border-line bg-surface-2 hover:border-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-[8px]",
                        active ? "bg-accent text-on-accent" : `bg-hue${c.hue}-wash text-hue${c.hue}`,
                      )}
                    >
                      <Icon size={16} strokeWidth={2.05} />
                    </span>
                    <span
                      className={cn(
                        "w-full truncate text-center text-[10.5px] font-medium",
                        active ? "text-accent" : "text-ink-2",
                      )}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="date" error={errors.date || undefined}>
            <Input
              id="date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value as ISODate)}
              invalid={Boolean(errors.date)}
            />
          </Field>
          <Field label="Opening balance preview">
            <div className="flex h-[46px] items-center rounded-sm border border-line bg-surface-2 px-3">
              {account ? (
                <Money amountMinor={account.openingBalanceMinor} currency={account.currency} tone="muted" />
              ) : (
                <span className="text-[13px] text-ink-3">—</span>
              )}
            </div>
          </Field>
        </div>

        <Field label="Notes" htmlFor="notes" hint="Optional. Kept with the record and included in backups.">
          <TextArea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering later"
            maxLength={280}
          />
        </Field>
      </div>
    </Sheet>
  );
}
