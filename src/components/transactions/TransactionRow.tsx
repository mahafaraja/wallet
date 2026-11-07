import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronRight } from "lucide-react";
import { ListRow, cn } from "@/components/ui/primitives";
import { Money } from "@/components/Money";
import { iconFor } from "@/design/icons";
import type { Account, Category, Transaction } from "@/db/schema";
import { dayLabel } from "@/lib/dates";

const TYPE_ICON = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
} as const;

/**
 * A single transaction row. Reused by Home, Activity, Account detail and the
 * goal screen so the visual language stays identical everywhere.
 */
export function TransactionRow({
  transaction,
  category,
  accounts,
  onClick,
  showDate,
  dense,
}: {
  transaction: Transaction;
  category?: Category;
  accounts: Account[];
  onClick?: () => void;
  showDate?: boolean;
  dense?: boolean;
}) {
  const Icon = TYPE_ICON[transaction.type];
  const CatIcon = iconFor(category?.icon);
  const from = accounts.find((a) => a.id === transaction.accountId);
  const to = accounts.find((a) => a.id === transaction.toAccountId);

  const isIncome = transaction.type === "income";
  const isTransfer = transaction.type === "transfer";

  const secondary = isTransfer
    ? `${from?.name ?? "Account"} → ${to?.name ?? "Account"}`
    : [category?.name ?? "Uncategorised", from?.name].filter(Boolean).join(" · ");

  return (
    <ListRow onClick={onClick} className={cn(dense && "py-2.5")}>
      {category && !isTransfer ? (
        <span
          aria-hidden
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
            `bg-hue${category.hue}-wash`,
            `text-hue${category.hue}`,
          )}
        >
          <CatIcon size={17} strokeWidth={2} />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
            isTransfer ? "bg-surface-2 text-ink-2" : isIncome ? "bg-income-wash text-income" : "bg-expense-wash text-expense",
          )}
        >
          <Icon size={17} strokeWidth={2.2} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="ts-subheadline block truncate font-medium leading-tight text-ink">
          {transaction.description}
        </span>
        <span className="ts-footnote mt-0.5 block truncate text-ink-3">
          {showDate ? `${dayLabel(transaction.date)} · ` : ""}
          {secondary}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <Money
          amountMinor={transaction.amountMinor}
          currency={transaction.currency}
          size={dense ? "sm" : "md"}
          tone={isIncome ? "income" : isTransfer ? "muted" : "neutral"}
        />
        {transaction.baseAmountMinor !== undefined && transaction.currency !== transaction.baseCurrency ? (
          <span className="mt-0.5 block ts-caption-2 text-ink-3">
            ≈ <Money amountMinor={transaction.baseAmountMinor} currency={transaction.baseCurrency!} size="sm" tone="muted" />
          </span>
        ) : null}
      </span>

      {onClick ? <ChevronRight size={16} strokeWidth={2.1} className="shrink-0 text-ink-3" /> : null}
    </ListRow>
  );
}

export function TransactionGroup({
  label,
  children,
  trailing,
}: {
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <h3 className="eyebrow text-ink-3">{label}</h3>
        {trailing}
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">{children}</div>
    </section>
  );
}
