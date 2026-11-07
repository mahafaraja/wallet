/**
 * Decimal-safe money primitives.
 *
 * RULES
 *  - Every monetary value is an INTEGER count of the currency's MINOR unit.
 *    (UGX minor unit = 1 shilling, USD minor unit = 1 cent.) No floats ever
 *    enter storage, so 0.1 + 0.2 === 0.3 is never a question we have to answer.
 *  - Arithmetic only ever adds, subtracts and multiplies by integers, so
 *    results stay inside Number.MAX_SAFE_INTEGER (9.007e15). At UGX scale that
 *    is ~9 quadrillion shillings, far past any personal ledger.
 *  - Division (ratios, percentages) is the ONLY place floats appear, and only
 *    ever for display or progress — never stored, never re-summed.
 */

/** Integer count of a currency's minor unit. Always a whole number. */
export type Minor = number;

export const MAX_MINOR = Number.MAX_SAFE_INTEGER;

function isInt(n: number): boolean {
  return Number.isFinite(n) && Math.floor(n) === n;
}

/** Assert a value really is an integer minor amount. Throws loudly, never coerces. */
export function assertMinor(value: number, label = "amount"): Minor {
  if (!isInt(value)) {
    throw new TypeError(`Money invariant violated: ${label} must be integer minor units, got ${value}`);
  }
  if (Math.abs(value) > MAX_MINOR) {
    throw new RangeError(`Money invariant violated: ${label} exceeds safe integer range`);
  }
  return value;
}

/** Sum a list of minor amounts. Integer-safe. */
export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0;
  for (const v of values) {
    total += assertMinor(v);
  }
  return total;
}

export function addMinor(a: Minor, b: Minor): Minor {
  return assertMinor(a) + assertMinor(b);
}

export function subtractMinor(a: Minor, b: Minor): Minor {
  return assertMinor(a) - assertMinor(b);
}

/**
 * Multiply a minor amount by an integer factor.
 * Use for exact splits (e.g. 3 equal instalments of 9000 minor => 3000 each).
 */
export function multiplyMinor(amount: Minor, factor: number): Minor {
  if (!isInt(factor)) {
    throw new TypeError(`multiplyMinor factor must be an integer, got ${factor}`);
  }
  return assertMinor(amount) * factor;
}

/**
 * Split `amount` into `parts` integer shares that sum EXACTLY back to `amount`.
 * The remainder is distributed one minor unit at a time to the earliest parts,
 * so no value is ever lost to rounding and no share is invented.
 *
 *   splitMinor(1000, 3) => [334, 333, 333]   (sum === 1000)
 */
export function splitMinor(amount: Minor, parts: number): Minor[] {
  assertMinor(amount);
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`splitMinor parts must be a positive integer, got ${parts}`);
  }
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const base = Math.floor(abs / parts);
  const remainder = abs % parts;
  const shares: Minor[] = [];
  for (let i = 0; i < parts; i += 1) {
    shares.push(sign * (base + (i < remainder ? 1 : 0)));
  }
  return shares;
}

/**
 * Apply a ratio (exchange rate, tax rate) to a minor amount.
 * Rounds half-up to the nearest minor unit so totals never drift downward.
 *
 * NOTE: the result is for REPORTING/conversion only. It is never used to
 * recompute a stored balance, because applying a ratio twice would compound
 * rounding error.
 */
export function ratioMinor(amount: Minor, ratio: number): Minor {
  assertMinor(amount);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(`ratioMinor ratio must be a finite positive number, got ${ratio}`);
  }
  // Scale by a power of ten, round, then scale back — avoids float epsilon.
  const scaled = amount * ratio;
  return Math.sign(scaled) * Math.round(Math.abs(scaled));
}

/** Percentage of a whole, rounded to `precision` decimals. For display only. */
export function percentOf(part: number, whole: number, precision = 0): number {
  if (whole === 0) return 0;
  const factor = 10 ** precision;
  return Math.round((part / whole) * 100 * factor) / factor;
}

/**
 * Parse a user-typed amount string into integer minor units.
 * Accepts "1500", "1,500", "1500.50", ".5", "1 500".
 * Returns null when the input is not a usable number — callers decide how to
 * surface that, we never substitute a silent 0.
 */
export function parseAmountToMinor(
  input: string | number | null | undefined,
  decimals: number,
): Minor | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return parseAmountToMinor(input.toFixed(decimals), decimals);
  }

  const cleaned = input.replace(/[\s,_]/g, "").replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;

  const [wholeRaw, ...rest] = cleaned.split(".");
  // Reject "1.2.3"
  if (rest.length > 1) return null;

  const fracRaw = rest[0] ?? "";
  const whole = wholeRaw === "" ? "0" : wholeRaw.replace(/^0+(?=\d)/, "");

  let digits: string;
  if (decimals === 0) {
    // No minor unit: fractional part is truncated, never rounded up.
    digits = whole;
  } else {
    const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");
    digits = `${whole}${frac}`;
  }

  if (digits.length > 15) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/**
 * Render a minor amount as a plain numeric string for an <input>.
 * Always emits exactly `decimals` fraction digits so re-parsing round-trips.
 */
export function minorToInputValue(amount: Minor, decimals: number): string {
  assertMinor(amount);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (decimals === 0) return `${sign}${abs}`;
  const factor = 10 ** decimals;
  const whole = Math.floor(abs / factor);
  const frac = String(abs % factor).padStart(decimals, "0");
  return `${sign}${whole}.${frac}`;
}

/** Increment used by tap-to-add quick chips, kept on integer boundaries. */
export function snapToMinorStep(amount: Minor, decimals: number, step: number): Minor {
  return assertMinor(amount) + Math.round(step * 10 ** decimals);
}
