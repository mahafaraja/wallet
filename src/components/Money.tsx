/**
 * Money display components.
 *
 * The privacy toggle is global: when amounts are hidden, every figure in the
 * app is masked consistently, so a screenshot never leaks a balance.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { formatMoneyParts } from "@/lib/currency";
import type { Minor } from "@/lib/money";
import { cn } from "@/components/ui/primitives";

type Privacy = { hidden: boolean };

const PrivacyContext = createContext<Privacy>({ hidden: false });

export function PrivacyProvider({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ hidden }), [hidden]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): Privacy {
  return useContext(PrivacyContext);
}

/** Mask used when amounts are hidden. Same width class so layout does not jump. */
const MASK = "••••";

type MoneyProps = {
  amountMinor: Minor;
  currency: string;
  className?: string;
  /** Show an explicit + or − for deltas. */
  signed?: boolean;
  /** Small unit label for compact contexts. */
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "neutral" | "income" | "expense" | "muted" | "onAccent";
};

const SIZE_CLASS: Record<NonNullable<MoneyProps["size"]>, string> = {
  sm: "text-[13px] font-semibold",
  md: "text-[15px] font-semibold",
  lg: "figure-lg",
  xl: "figure-xl",
};

const TONE_CLASS: Record<NonNullable<MoneyProps["tone"]>, string> = {
  neutral: "text-ink",
  muted: "text-ink-2",
  income: "text-income",
  expense: "text-expense",
  onAccent: "text-on-accent",
};

export function Money({ amountMinor, currency, className, signed, size = "md", tone = "neutral" }: MoneyProps) {
  const { hidden } = usePrivacy();

  if (hidden) {
    return (
      <span className={cn("tnum inline-flex items-center gap-1", SIZE_CLASS[size], TONE_CLASS[tone], className)}>
        {signed ? <span aria-hidden>±</span> : null}
        <span aria-hidden>{MASK}</span>
        <EyeOff size={size === "xl" ? 15 : 11} strokeWidth={2.2} className="opacity-45" />
        <span className="sr-only">Amount hidden</span>
      </span>
    );
  }

  const parts = formatMoneyParts(amountMinor, currency);
  const sign = signed ? (amountMinor > 0 ? "+" : amountMinor < 0 ? "−" : "") : "";

  return (
    <span className={cn("tnum", SIZE_CLASS[size], TONE_CLASS[tone], className)}>
      {sign}
      {parts.symbol.length > 1 ? (
        <>
          <span className="mr-[0.15em] text-[0.72em] font-semibold opacity-70">{parts.symbol}</span>
          {parts.value}
        </>
      ) : (
        <>
          <span className="text-[0.78em] opacity-85">{parts.symbol}</span>
          {parts.value}
        </>
      )}
    </span>
  );
}

/** Raw formatted string, for contexts that cannot render a component. */
export function moneyText(amountMinor: Minor, currency: string, signed?: boolean): string {
  const parts = formatMoneyParts(amountMinor, currency);
  const sign = signed ? (amountMinor > 0 ? "+" : amountMinor < 0 ? "−" : "") : "";
  const spacer = parts.symbol.length > 1 ? " " : "";
  return `${sign}${parts.symbol}${spacer}${parts.value}`;
}

/** Currency label for grouping headers and pickers. */
export function CurrencyLabel({ code }: { code: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{code}</span>
    </span>
  );
}
