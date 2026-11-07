/**
 * Deterministic date handling.
 *
 * RULE: a transaction's date is a plain local calendar day, stored as
 * "YYYY-MM-DD". Never a timestamp, never UTC-normalised — otherwise a purchase
 * made at 22:00 in Kampala lands on the wrong day in a UTC bucket.
 */

import { format, parse, startOfMonth, endOfMonth, addMonths, differenceInCalendarDays } from "date-fns";

export type ISODate = string; // "YYYY-MM-DD"

const PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !PATTERN.test(value)) return false;
  const parsed = parse(value, "yyyy-MM-dd", new Date(2000, 0, 1));
  return format(parsed, "yyyy-MM-dd") === value;
}

export function toISODate(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

/** Today in the user's local timezone. Never computed from UTC. */
export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function fromISODate(iso: ISODate): Date {
  return parse(iso, "yyyy-MM-dd", new Date(2000, 0, 1));
}

/** Month key "YYYY-MM" — the canonical grouping key for reports and budgets. */
export type MonthKey = string;

export function monthKeyOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(todayISO());
}

export function monthKeyToDate(key: MonthKey): Date {
  return parse(`${key}-01`, "yyyy-MM-dd", new Date(2000, 0, 1));
}

export function isValidMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  return format(addMonths(monthKeyToDate(key), delta), "yyyy-MM");
}

export function monthRange(key: MonthKey): { from: ISODate; to: ISODate } {
  const d = monthKeyToDate(key);
  return { from: toISODate(startOfMonth(d)), to: toISODate(endOfMonth(d)) };
}

/** Inclusive list of month keys from `start` to `end` (or just `count` of them). */
export function recentMonthKeys(count: number, endKey = currentMonthKey()): MonthKey[] {
  const keys: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i -= 1) keys.push(shiftMonth(endKey, -i));
  return keys;
}

export function isSameMonth(iso: ISODate, key: MonthKey): boolean {
  return monthKeyOf(iso) === key;
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(fromISODate(to), fromISODate(from));
}

export function daysInMonth(key: MonthKey): number {
  const { to } = monthRange(key);
  const d = fromISODate(to);
  return d.getDate();
}

export function daysRemainingInMonth(key: MonthKey = currentMonthKey()): number {
  const { to } = monthRange(key);
  return Math.max(daysBetween(todayISO(), to), 0);
}

export function monthLabel(key: MonthKey, style: "long" | "short" = "long"): string {
  const d = monthKeyToDate(key);
  return format(d, style === "long" ? "MMMM yyyy" : "MMM yyyy");
}

export function monthLabelShort(key: MonthKey): string {
  return format(monthKeyToDate(key), "MMM");
}

export function dayLabel(iso: ISODate): string {
  const diff = daysBetween(iso, todayISO());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  return format(fromISODate(iso), "EEE d MMM");
}

export function fullDateLabel(iso: ISODate): string {
  return format(fromISODate(iso), "EEEE, d MMMM yyyy");
}

export function shortDateLabel(iso: ISODate): string {
  return format(fromISODate(iso), "d MMM yyyy");
}

/** Clamp a user-chosen date so it is always a real, representable day. */
export function clampDate(iso: string): ISODate | null {
  if (!isISODate(iso)) return null;
  return iso;
}
