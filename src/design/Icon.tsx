/**
 * ICON — SF Symbols semantics on Lucide.
 * ============================================================================
 *
 * Apple's SF Symbols cannot legally be shipped to the web, so symbols render
 * from Lucide (ISC licence) — drawn on the same 24px grid with round caps and
 * joins, which is the geometry SF Symbols are built on.
 *
 * What this component reproduces is the two things that make SF Symbols feel
 * coherent rather than decorative:
 *
 *  1. STROKE WEIGHTS. The real SF Symbols weight scale, mapped onto Lucide's
 *     strokeWidth. Because Lucide is a 24px grid like SF Symbols, the same
 *     numeric weight produces visually equivalent optical density.
 *
 *         ultralight  1
 *         thin        1.25
 *         light       1.5
 *         regular     1.7
 *         medium      2
 *         semibold    2.4
 *         bold        2.8
 *
 *  2. POINT SIZES. The canonical SF Symbols sizes, not arbitrary pixels. A
 *     symbol that shares a row with body text is 17pt, not "whatever looks
 *     about right".
 *
 * Weight guidance used throughout the app:
 *
 *   regular   static inline symbols, list-row glyphs
 *   medium    navigation, where the icon must hold its own
 *   semibold  actions the user is about to take (add, confirm, close)
 *   bold      reserved for the single primary action on a screen
 *
 * Weight should track the *weight of the text beside it*. Pairing a semibold
 * label with a regular icon reads as a mistake, and so does the reverse.
 */

import type { CSSProperties, ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

export const SF_WEIGHTS = {
  ultralight: 1,
  thin: 1.25,
  light: 1.5,
  regular: 1.7,
  medium: 2,
  semibold: 2.4,
  bold: 2.8,
} as const;

export type SFWeight = keyof typeof SF_WEIGHTS;

/** Canonical SF Symbols point sizes. */
export const SF_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const;

export type SFSize = keyof typeof SF_SIZES;

export const SF_WEIGHT_LABELS: Record<SFWeight, string> = {
  ultralight: "Ultralight",
  thin: "Thin",
  light: "Light",
  regular: "Regular",
  medium: "Medium",
  semibold: "Semibold",
  bold: "Bold",
};

/** The size that optically matches each text style. */
export const SF_TEXT_SIZE: Record<string, SFSize> = {
  "ts-large-title": "xxl",
  "ts-title-1": "xxl",
  "ts-title-2": "xl",
  "ts-title-3": "xl",
  "ts-headline": "lg",
  "ts-body": "lg",
  "ts-body-emph": "lg",
  "ts-callout": "lg",
  "ts-subheadline": "md",
  "ts-subhead-emph": "md",
  "ts-footnote": "sm",
  "ts-footnote-emph": "sm",
  "ts-caption-1": "xs",
  "ts-caption-2": "xs",
};

export type IconProps = {
  icon: LucideIcon;
  weight?: SFWeight;
  /** A named SF point size, or an explicit pixel value. */
  size?: SFSize | number;
  className?: string;
  style?: CSSProperties;
  /** Override the preset weight. Use sparingly. */
  strokeWidth?: number;
  /** Scale the stroke with the icon rather than using an absolute value. */
  absoluteStrokeWidth?: boolean;
} & Omit<ComponentProps<"svg">, "ref" | "strokeWidth" | "className" | "style">;

export default function Icon({
  icon: Component,
  weight = "regular",
  size,
  className,
  strokeWidth,
  absoluteStrokeWidth,
  ...rest
}: IconProps) {
  const resolvedStroke = strokeWidth ?? SF_WEIGHTS[weight];
  const dimension =
    typeof size === "number" ? size : size === undefined ? undefined : SF_SIZES[size];

  return (
    <Component
      className={className ? `icon-base ${className}` : "icon-base"}
      width={dimension}
      height={dimension}
      strokeWidth={resolvedStroke}
      absoluteStrokeWidth={absoluteStrokeWidth}
      aria-hidden
      {...rest}
    />
  );
}

/**
 * Build a pre-configured icon component. The preferred API for app code, because
 * it fixes the weight at the call site that decided it belongs there:
 *
 *   const WalletIcon = sfIcon(Wallet, { weight: "medium" });
 */
export function sfIcon(
  icon: LucideIcon,
  config: { weight?: SFWeight; size?: SFSize } = {},
) {
  const { weight = "regular", size } = config;
  function Preconfigured(props: Omit<IconProps, "icon" | "weight" | "size">) {
    return <Icon icon={icon} weight={weight} size={size} {...props} />;
  }
  Preconfigured.displayName = `Icon(${icon.displayName ?? "LucideIcon"})`;
  return Preconfigured;
}
