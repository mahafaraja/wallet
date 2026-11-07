/**
 * Currency catalogue and formatting.
 *
 * Multi-currency is a first-class concern, not an afterthought:
 *  - Every record carries its own currency code.
 *  - Nothing is ever silently converted or merged across currencies.
 *  - Conversion happens ONLY when the user supplies an exchange rate, and the
 *    converted figure is stored alongside (never instead of) the original.
 */

import { assertMinor, minorToInputValue, type Minor } from "@/lib/money";

export type CurrencyCode = string;

export type CurrencyMeta = {
  code: CurrencyCode;
  /** ISO 4217 minor-unit precision. Drives all integer money maths. */
  decimals: number;
  /** Canonical symbol, used in compact UI. */
  symbol: string;
  /** Wider label used in pickers and full-form rendering. */
  name: string;
  /** BCP-47 locale that renders this currency sensibly. */
  locale: string;
  /** True when the code is user-defined rather than a known ISO currency. */
  custom?: boolean;
};

/**
 * ISO 4217 subset with correct minor-unit precision.
 * UGX, RWF, TZS, BIF, CLP, JPY and KRW all have ZERO minor units — treating
 * them as 2-decimal currencies is the single most common money bug in
 * East-African fintech, so it is encoded here rather than assumed.
 */
const CATALOGUE: Record<CurrencyCode, CurrencyMeta> = {
  UGX: { code: "UGX", decimals: 0, symbol: "USh", name: "Ugandan Shilling", locale: "en-UG" },
  USD: { code: "USD", decimals: 2, symbol: "$", name: "US Dollar", locale: "en-US" },
  KES: { code: "KES", decimals: 2, symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE" },
  EUR: { code: "EUR", decimals: 2, symbol: "€", name: "Euro", locale: "de-DE" },
  GBP: { code: "GBP", decimals: 2, symbol: "£", name: "British Pound", locale: "en-GB" },
  RWF: { code: "RWF", decimals: 0, symbol: "FRw", name: "Rwandan Franc", locale: "en-RW" },
  TZS: { code: "TZS", decimals: 0, symbol: "TSh", name: "Tanzanian Shilling", locale: "en-TZ" },
  ZAR: { code: "ZAR", decimals: 2, symbol: "R", name: "South African Rand", locale: "en-ZA" },
  NGN: { code: "NGN", decimals: 2, symbol: "₦", name: "Nigerian Naira", locale: "en-NG" },
  JPY: { code: "JPY", decimals: 0, symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "UGX";

/** Currencies surfaced in the picker by default. Others remain available. */
export const DEFAULT_ENABLED: CurrencyCode[] = ["UGX", "USD", "KES", "EUR"];

export const CATALOGUE_ORDER: CurrencyCode[] = [
  "UGX",
  "USD",
  "KES",
  "EUR",
  "GBP",
  "RWF",
  "TZS",
  "ZAR",
  "NGN",
  "JPY",
];

export function isKnown(code: string): code is keyof typeof CATALOGUE {
  return Object.prototype.hasOwnProperty.call(CATALOGUE, code);
}

/** Look up metadata, registering unknown codes as 2-decimal by default. */
export function currency(code: CurrencyCode | null | undefined): CurrencyMeta {
  const key = (code ?? DEFAULT_CURRENCY).toUpperCase();
  if (isKnown(key)) return CATALOGUE[key];
  return {
    code: key,
    decimals: 2,
    symbol: key,
    name: key,
    locale: "en",
    custom: true,
  };
}

export function decimalsOf(code: CurrencyCode): number {
  return currency(code).decimals;
}

/**
 * Register (or redefine) a user-defined currency. Only permitted for codes that
 * are not already in the catalogue — ISO precision always wins.
 */
export function defineCustomCurrency(meta: {
  code: string;
  symbol: string;
  decimals: number;
  name?: string;
}): CurrencyMeta {
  const code = meta.code.trim().toUpperCase();
  if (code.length < 3 || code.length > 5 || !/^[A-Z]+$/.test(code)) {
    throw new Error("Currency code must be 3–5 letters.");
  }
  if (isKnown(code)) {
    throw new Error(`${code} already exists with fixed ISO precision.`);
  }
  if (!Number.isInteger(meta.decimals) || meta.decimals < 0 || meta.decimals > 4) {
    throw new Error("Decimals must be a whole number from 0 to 4.");
  }
  const entry: CurrencyMeta = {
    code,
    decimals: meta.decimals,
    symbol: (meta.symbol || code).slice(0, 4),
    name: (meta.name || code).slice(0, 32),
    locale: "en",
    custom: true,
  };
  CATALOGUE[code] = entry;
  return entry;
}

/* ---------------------------------------------------------------------------
   Formatting
   --------------------------------------------------------------------------- */

/**
 * Render an integer minor amount as a currency string.
 *
 * Deliberately NOT `Intl.NumberFormat({ style: "currency" })`: ICU inserts a
 * non-breaking space for some locales (USh/U+00A0/1,000) and places the symbol
 * after the figure for others. For a finance UI we need symbol-first, single
 * regular space, and a predictable minus sign — every time — so the string is
 * assembled from `Intl` grouping plus our own symbol. Fraction count still
 * comes from the currency's ISO minor-unit precision.
 */
export function formatMoney(
  amount: Minor,
  code: CurrencyCode,
  opts?: { signed?: boolean; compact?: boolean },
): string {
  assertMinor(amount);
  const meta = currency(code);
  const major = amount / 10 ** meta.decimals;
  const sign = amount < 0 ? "−" : opts?.signed && amount > 0 ? "+" : "";

  const num = new Intl.NumberFormat("en", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(Math.abs(major));

  if (opts?.compact && Math.abs(major) >= 1_000_000) {
    const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
    return `${sign}${symbolPrefix(meta.symbol)}${compact.format(Math.abs(major))}`;
  }

  return `${sign}${symbolPrefix(meta.symbol)}${num}`;
}

/**
 * Alphabetic currency codes ("USh", "KSh", "FRw") take a thin space; single
 * glyph prefix symbols ("$", "€", "¥") do not. Getting this wrong is the
 * difference between "$12.34" and "$ 12.34".
 */
function symbolPrefix(symbol: string): string {
  return symbol.length > 1 ? `${symbol} ` : symbol;
}

/** Symbol and formatted figure as separate parts, for tighter layout control. */
export function formatMoneyParts(
  amount: Minor,
  code: CurrencyCode,
): { symbol: string; value: string } {
  assertMinor(amount);
  const meta = currency(code);
  const major = Math.abs(amount) / 10 ** meta.decimals;
  const text = new Intl.NumberFormat("en", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(major);
  return { symbol: meta.symbol, value: `${amount < 0 ? "−" : ""}${text}` };
}

/** Input-ready value for a currency. */
export function toInputValue(amount: Minor, code: CurrencyCode): string {
  return minorToInputValue(amount, decimalsOf(code));
}

/* ---------------------------------------------------------------------------
   Conversion
   --------------------------------------------------------------------------- */

export type Conversion = {
  /** Rate expressed as 1 unit of `from` = `rate` units of `to`. */
  rate: number;
  from: CurrencyCode;
  to: CurrencyCode;
};

/**
 * Convert using a user-supplied rate. Returns the integer minor amount in the
 * TARGET currency. The ORIGINAL amount is never mutated by this call.
 */
export function convertMinor(amount: Minor, conversion: Conversion): Minor {
  assertMinor(amount);
  const { rate, from, to } = conversion;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`Exchange rate must be a positive number, got ${rate}`);
  }
  if (from === to) return amount;

  const fromDecimals = decimalsOf(from);
  const toDecimals = decimalsOf(to);

  // Work in major units, then re-quantize to the target's minor unit.
  // Scale via strings to keep float epsilon out of the integer boundary.
  const major = amount / 10 ** fromDecimals;
  const converted = major * rate;
  const scaled = converted * 10 ** toDecimals;

  // Round half-away-from-zero on the exact decimal string to avoid 0.5 float bias.
  const fixed = scaled.toFixed(6);
  const [intPart, fracPart = ""] = fixed.split(".");
  const roundUp = Number(fracPart[0] ?? 0) >= 5;
  const magnitude = Number(intPart) + (roundUp ? 1 : 0);
  const signed = converted < 0 ? -magnitude : magnitude;

  if (!Number.isSafeInteger(signed)) {
    throw new RangeError("Converted amount exceeds safe integer range");
  }
  return signed;
}

/** True when two currencies can be directly compared or summed. */
export function sameCurrency(a: CurrencyCode, b: CurrencyCode): boolean {
  return a === b;
}
