import { describe, expect, it } from "vitest";
import {
  addMinor,
  minorToInputValue,
  multiplyMinor,
  parseAmountToMinor,
  percentOf,
  ratioMinor,
  splitMinor,
  subtractMinor,
  sumMinor,
} from "@/lib/money";

describe("parseAmountToMinor", () => {
  it.each([
    ["1500", 0, 1500],
    ["1,500", 0, 1500],
    ["1 500", 0, 1500],
    ["1500.99", 0, 1500], // UGX has no minor unit: fraction truncated, never rounded
    ["0", 2, 0],
    [".5", 2, 50],
    ["0.5", 2, 50],
    ["1,234.5", 2, 123450],
    ["1,234.56", 2, 123456],
    ["1,234.567", 2, 123456], // extra precision truncated
    ["12", 2, 1200],
    ["007", 2, 700],
  ])("parses %j at %d decimals -> %d", (input, decimals, expected) => {
    expect(parseAmountToMinor(input, decimals)).toBe(expected);
  });

  it.each([
    ["", 2],
    ["   ", 2],
    [".", 2],
    ["abc", 2],
    ["1.2.3", 2],
    ["-", 2],
    [null, 2],
    [undefined, 2],
  ])("rejects unusable input %j instead of coercing to zero", (input, decimals) => {
    expect(parseAmountToMinor(input as string, decimals)).toBeNull();
  });

  it("accepts numbers and quantises them exactly", () => {
    expect(parseAmountToMinor(0.1, 2)).toBe(10);
    expect(parseAmountToMinor(1234.5, 2)).toBe(123450);
  });

  it("round-trips through minorToInputValue", () => {
    for (const [value, decimals] of [
      [123456, 2],
      [100, 0],
      [0, 2],
      [5, 0],
    ] as const) {
      const text = minorToInputValue(value, decimals);
      expect(parseAmountToMinor(text, decimals)).toBe(value);
    }
  });
});

describe("integer arithmetic", () => {
  it("never reproduces the 0.1 + 0.2 problem", () => {
    expect(addMinor(10, 20)).toBe(30); // 0.10 + 0.20 -> 0.30 exactly
    expect(subtractMinor(20, 10)).toBe(10);
    expect(sumMinor([10, 20, 30])).toBe(60);
  });

  it("sums a large ledger without drift", () => {
    // 1000 × 0.01 = exactly 10.00, where float accumulation famously gives 9.999999999999998
    const cents = Array.from({ length: 1000 }, () => 1);
    expect(sumMinor(cents)).toBe(1000);
  });

  it("handles negative balances", () => {
    expect(sumMinor([500, -700])).toBe(-200);
    expect(subtractMinor(-500, 300)).toBe(-800);
  });

  it("multiplies by integer factors exactly", () => {
    expect(multiplyMinor(3333, 3)).toBe(9999);
  });

  it("rejects non-integer factors rather than silently truncating", () => {
    expect(() => multiplyMinor(1000, 1.5)).toThrow(TypeError);
  });
});

describe("splitMinor", () => {
  it("distributes a remainder without losing a unit", () => {
    const shares = splitMinor(1000, 3);
    expect(shares).toEqual([334, 333, 333]);
    expect(sumMinor(shares)).toBe(1000);
  });

  it("splits evenly when divisible", () => {
    expect(splitMinor(900, 3)).toEqual([300, 300, 300]);
  });

  it("handles single-part and zero amounts", () => {
    expect(splitMinor(123, 1)).toEqual([123]);
    expect(splitMinor(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("preserves the sign of a negative amount", () => {
    const shares = splitMinor(-1000, 3);
    expect(shares).toEqual([-334, -333, -333]);
    expect(sumMinor(shares)).toBe(-1000);
  });

  it("always reconstitutes the original for arbitrary inputs", () => {
    for (let total = 1; total <= 60; total += 1) {
      for (const parts of [2, 3, 5, 7]) {
        expect(sumMinor(splitMinor(total, parts))).toBe(total);
      }
    }
  });
});

describe("ratioMinor", () => {
  it("applies an exchange rate deterministically", () => {
    // 100000 UGX at 0.00027 USD/UGX
    expect(ratioMinor(100_000, 0.00027)).toBe(27);
  });

  it("rounds half away from zero", () => {
    expect(ratioMinor(100, 0.125)).toBe(13); // 12.5 -> 13
    expect(ratioMinor(100, 0.115)).toBe(12); // 11.5 -> 12
  });

  it("returns the input unchanged for a rate of 1", () => {
    expect(ratioMinor(98_765, 1)).toBe(98_765);
  });

  it("rejects invalid rates", () => {
    expect(() => ratioMinor(100, 0)).toThrow(RangeError);
    expect(() => ratioMinor(100, Number.NaN)).toThrow(RangeError);
    expect(() => ratioMinor(100, -1)).toThrow(RangeError);
  });
});

describe("percentOf", () => {
  it("computes whole-number percentages", () => {
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(1, 3)).toBe(33);
  });

  it("supports fractional precision for display", () => {
    expect(percentOf(1, 3, 1)).toBe(33.3);
  });

  it("returns 0 for an empty whole rather than NaN", () => {
    expect(percentOf(50, 0)).toBe(0);
    expect(percentOf(0, 0)).toBe(0);
  });
});
