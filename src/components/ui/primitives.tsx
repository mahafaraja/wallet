/**
 * UI PRIMITIVES
 *
 * Every screen is assembled from these. No raw hex values, no one-off radii —
 * the design tokens in app.css are the only source of visual truth.
 */

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ==========================================================================
   Surfaces
   ========================================================================== */

export function Card({
  children,
  className,
  as: Tag = "div",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  padded?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg bg-surface border border-line",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h2 className="ts-headline">{title}</h2>
        {hint ? <p className="ts-footnote mt-0.5 text-ink-3">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

/* ==========================================================================
   Buttons
   ========================================================================== */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold select-none " +
  "disabled:opacity-45 disabled:pointer-events-none transition-[transform,background-color,opacity] duration-150 active:scale-[0.97]";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent",
  secondary: "bg-surface-2 text-ink border border-line",
  ghost: "text-accent",
  danger: "bg-danger-wash text-danger",
  quiet: "text-ink-2",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "ts-footnote-emph h-8 px-3",
  md: "ts-subhead-emph h-10 px-4",
  lg: "ts-callout h-12 px-5 font-semibold",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  full?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, full, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {/*
        Icon weight tracks the label weight it sits beside. A semibold label
        next to a regular-weight icon reads as a mistake, and so does the
        reverse, so the pairing is decided here once.
      */}
      {Icon ? (
        <Icon
          size={size === "sm" ? 14 : 17}
          strokeWidth={size === "sm" ? 2.2 : 2.4}
        />
      ) : null}
      {children}
    </button>
  );
});

/**
 * Square-ish icon-only button.
 *
 * `weight` follows the SF Symbols stroke scale, defaulting to medium because an
 * icon standing alone in a button has no label to lean on and needs the density.
 * Pass "semibold" for actions the user is about to take, such as close or add.
 */
export function IconButton({
  icon: Icon,
  label,
  variant = "secondary",
  size = 36,
  weight = 2,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  /** Icon diameter in px. */
  size?: number;
  /** SF Symbols stroke weight; a raw number matches Lucide's strokeWidth. */
  weight?: number;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid place-items-center rounded-full transition active:scale-[0.94]",
        variant === "secondary" && "bg-surface-2 text-ink border border-line",
        variant === "ghost" && "text-ink-2",
        variant === "primary" && "bg-accent text-on-accent",
        variant === "danger" && "bg-danger-wash text-danger",
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={weight} />
    </button>
  );
}

/* ==========================================================================
   Text
   ========================================================================== */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow text-ink-3", className)}>{children}</p>;
}

/* ==========================================================================
   Form fields
   ========================================================================== */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="ts-caption-1 mb-1.5 block font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="ts-footnote mt-1.5 flex items-start gap-1 text-danger">
          <span aria-hidden>•</span>
          {error}
        </p>
      ) : hint ? (
        <p className="ts-footnote mt-1.5 text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-sm bg-surface-2 border px-3 py-2.5 text-[16px] text-ink " +
  "placeholder:text-ink-3 transition-colors focus:bg-surface focus:outline-none " +
  "focus:border-accent";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(CONTROL, invalid ? "border-danger" : "border-line", className)}
        {...rest}
      />
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function TextArea({ className, invalid, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(CONTROL, "resize-none", invalid ? "border-danger" : "border-line", className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            CONTROL,
            "appearance-none pr-9",
            invalid ? "border-danger" : "border-line",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
    );
  },
);

/* ==========================================================================
   Segmented control
   ========================================================================== */

export type SegmentOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex gap-0.5 rounded-sm bg-surface-2 border border-line p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[6px] font-semibold transition-colors",
              size === "sm" ? "ts-footnote-emph h-8" : "ts-subhead-emph h-9",
              active ? "bg-surface text-ink shadow-card" : "text-ink-2",
            )}
          >
            {option.icon ? <option.icon size={14} strokeWidth={2.2} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Chips
   ========================================================================== */

export function Chip({
  children,
  active,
  onClick,
  className,
  tone,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  tone?: "neutral" | "income" | "expense" | "warning";
}) {
  const toneClass =
    tone === "income"
      ? "bg-income-wash text-income"
      : tone === "expense"
        ? "bg-expense-wash text-expense"
        : tone === "warning"
          ? "bg-warning-wash text-warning"
          : "";

  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "ts-footnote-emph inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
        active ? "bg-accent text-on-accent" : tone ? toneClass : "bg-surface-2 text-ink-2 border border-line",
        onClick && "active:scale-[0.97]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

/* ==========================================================================
   Progress
   ========================================================================== */

export type ProgressTone = "accent" | "income" | "warning" | "expense";

export function ProgressBar({
  value,
  tone = "accent",
  height = 6,
  track,
  className,
}: {
  /** 0–100. Values above 100 render a full bar; the label carries the truth. */
  value: number;
  tone?: ProgressTone;
  height?: number;
  track?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill =
    tone === "income"
      ? "bg-income"
      : tone === "warning"
        ? "bg-warning"
        : tone === "expense"
          ? "bg-expense"
          : "bg-accent";

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", track ?? "bg-surface-2", className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Compact inline meter used inside list rows. */
export function Meter({ value, tone = "accent" }: { value: number; tone?: ProgressTone }) {
  return <ProgressBar value={value} tone={tone} height={4} />;
}

/* ==========================================================================
   Category indicator
   ========================================================================== */

export function CategoryIndicator({
  icon,
  hue,
  size = 36,
  className,
}: {
  icon: LucideIcon;
  hue: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.min(Math.max(Math.round(hue), 1), 10) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-[10px]", `bg-hue${clamped}-wash`, `text-hue${clamped}`, className)}
      style={{ width: size, height: size }}
    >
      <Icon_ icon={icon} size={Math.round(size * 0.55)} strokeWidth={2} />
    </span>
  );
}

/** Local shim so the indicator stays a plain span, not a button. */
function Icon_({ icon, size, strokeWidth }: { icon: LucideIcon; size: number; strokeWidth: number }) {
  const Cmp = icon;
  return <Cmp size={size} strokeWidth={strokeWidth} />;
}

/* ==========================================================================
   Stats
   ========================================================================== */

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "income" | "expense" | "accent";
}) {
  const toneText =
    tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : tone === "accent" ? "text-accent" : "text-ink";
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon size={13} strokeWidth={2.2} className="text-ink-3" /> : null}
        <p className="eyebrow text-ink-3">{label}</p>
      </div>
      <p className={cn("figure-md tnum mt-1", toneText)}>{value}</p>
      {sub ? <p className="ts-caption-1 mt-0.5 text-ink-3">{sub}</p> : null}
    </div>
  );
}

/* ==========================================================================
   Search
   ========================================================================== */

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="relative"
    >
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13.5 13.5L17 17" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="ts-callout w-full rounded-sm border border-line bg-surface-2 py-2.5 pl-9 pr-9 text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-surface-2 text-ink-2"
        >
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      ) : null}
    </form>
  );
}

/* ==========================================================================
   Badges
   ========================================================================== */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "income" | "warning" | "expense";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-ink-2 border-line",
    accent: "bg-accent-wash text-accent",
    income: "bg-income-wash text-income",
    warning: "bg-warning-wash text-warning",
    expense: "bg-expense-wash text-expense",
  };
  return (
    <span
      className={cn(
        "ts-caption-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   Rows (iOS-style inset list)
   ========================================================================== */

export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      {children}
    </ul>
  );
}

export function ListRow({
  children,
  onClick,
  className,
  indent = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  indent?: boolean;
}) {
  const Comp = onClick ? "button" : "li";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "ts-body relative flex w-full items-center gap-3 px-3.5 py-3 text-left",
        indent && "hairline last:shadow-none",
        onClick && "transition-colors active:bg-surface-2",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
