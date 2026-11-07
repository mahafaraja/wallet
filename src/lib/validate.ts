/**
 * Input validation.
 *
 * Finance rules:
 *  - Never silently discard user-entered data. On failure we return the field
 *    and the reason; the caller keeps the form exactly as typed.
 *  - Never coerce a bad amount to zero — that would record a lie.
 */

import { decimalsOf } from "@/lib/currency";
import { parseAmountToMinor, type Minor } from "@/lib/money";
import { isISODate, type ISODate } from "@/lib/dates";

export type FieldErrors = Record<string, string>;

export function ok(): { ok: true } {
  return { ok: true };
}

export function invalid(errors: FieldErrors): { ok: false; errors: FieldErrors } {
  return { ok: false, errors };
}

export type ValidationResult = { ok: true } | { ok: false; errors: FieldErrors };

export type TransactionDraft = {
  type: "income" | "expense" | "transfer";
  amountText: string;
  currency: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  description: string;
  notes?: string;
  date: string;
};

export function validateTransaction(draft: TransactionDraft): ValidationResult {
  const errors: FieldErrors = {};

  if (!draft.accountId) errors.accountId = "Choose an account.";

  if (draft.type === "transfer") {
    if (!draft.toAccountId) errors.toAccountId = "Choose a destination account.";
    else if (draft.toAccountId === draft.accountId) {
      errors.toAccountId = "A transfer needs two different accounts.";
    }
  }

  if (!draft.description.trim()) errors.description = "Add a short description.";
  else if (draft.description.trim().length > 80) {
    errors.description = "Keep the description under 80 characters.";
  }

  if (!isISODate(draft.date)) errors.date = "Pick a valid date.";

  const decimals = decimalsOf(draft.currency);
  const amount = parseAmountToMinor(draft.amountText, decimals);
  if (amount === null) errors.amount = "Enter an amount.";
  else if (amount <= 0) errors.amount = "Amount must be greater than zero.";
  else if (draft.amountText.includes("-")) errors.amount = "Amounts cannot be negative.";

  if (draft.notes && draft.notes.length > 280) errors.notes = "Notes are limited to 280 characters.";

  if (draft.type !== "transfer" && !draft.categoryId) {
    errors.categoryId = "Choose a category.";
  }

  return Object.keys(errors).length ? invalid(errors) : ok();
}

export type AccountDraft = {
  name: string;
  type: string;
  currency: string;
  openingBalanceText: string;
  description?: string;
};

export function validateAccount(draft: AccountDraft): ValidationResult {
  const errors: FieldErrors = {};
  if (!draft.name.trim()) errors.name = "Give this account a name.";
  else if (draft.name.trim().length > 40) errors.name = "Keep the name under 40 characters.";

  const validTypes = ["cash", "mobile", "bank", "savings", "other"];
  if (!validTypes.includes(draft.type)) errors.type = "Choose an account type.";

  const opening = parseAmountToMinor(draft.openingBalanceText || "0", decimalsOf(draft.currency));
  if (opening === null) errors.openingBalance = "Enter a valid opening balance.";

  if (draft.description && draft.description.length > 120) {
    errors.description = "Keep the description under 120 characters.";
  }

  return Object.keys(errors).length ? invalid(errors) : ok();
}

export type GoalDraft = {
  name: string;
  targetText: string;
  currency: string;
  targetDate?: string;
  description?: string;
};

export function validateGoal(draft: GoalDraft): ValidationResult {
  const errors: FieldErrors = {};
  if (!draft.name.trim()) errors.name = "Give this goal a name.";
  else if (draft.name.trim().length > 48) errors.name = "Keep the name under 48 characters.";

  const target = parseAmountToMinor(draft.targetText, decimalsOf(draft.currency));
  if (target === null) errors.target = "Enter a target amount.";
  else if (target <= 0) errors.target = "Target must be greater than zero.";

  if (draft.targetDate && !isISODate(draft.targetDate)) {
    errors.targetDate = "Pick a valid date.";
  }

  return Object.keys(errors).length ? invalid(errors) : ok();
}

export type BudgetDraft = {
  categoryId: string;
  amountText: string;
  currency: string;
};

export function validateBudget(draft: BudgetDraft): ValidationResult {
  const errors: FieldErrors = {};
  if (!draft.categoryId) errors.categoryId = "Choose a category.";
  const amount = parseAmountToMinor(draft.amountText, decimalsOf(draft.currency));
  if (amount === null) errors.amount = "Enter a budget amount.";
  else if (amount <= 0) errors.amount = "Budget must be greater than zero.";
  return Object.keys(errors).length ? invalid(errors) : ok();
}

/** Guard used before destructive operations. */
export function confirmableLabel(count: number, noun: string): string {
  return count === 1 ? `this ${noun}` : `these ${count} ${noun}s`;
}

/** Parsed transaction payload ready for persistence. */
export type ParsedTransaction = {
  type: TransactionDraft["type"];
  amountMinor: Minor;
  currency: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  description: string;
  notes?: string;
  date: ISODate;
};

export function materializeTransaction(draft: TransactionDraft): ParsedTransaction {
  const check = validateTransaction(draft);
  if (!check.ok) {
    throw new Error(
      `Refusing to persist an invalid transaction: ${Object.values(check.errors).join(" ")}`,
    );
  }
  const amountMinor = parseAmountToMinor(draft.amountText, decimalsOf(draft.currency));
  if (amountMinor === null) throw new Error("Amount became unparseable during materialisation.");

  return {
    type: draft.type,
    amountMinor,
    currency: draft.currency,
    accountId: draft.accountId,
    toAccountId: draft.type === "transfer" ? draft.toAccountId : undefined,
    categoryId: draft.type === "transfer" ? undefined : draft.categoryId,
    description: draft.description.trim(),
    notes: draft.notes?.trim() ? draft.notes.trim() : undefined,
    date: draft.date as ISODate,
  };
}
