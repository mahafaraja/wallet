/**
 * Identifier generation.
 *
 * Records are created offline with no server, so IDs must be:
 *  - globally unique without coordination (crypto.randomUUID),
 *  - lexicographically sortable so backups can be diffed deterministically,
 *    which UUIDv4 is not — so we ALSO keep a monotonic `revision` clock.
 */

export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : fallbackUuid();
  return `${prefix}_${uuid}`;
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/** Prefixed table IDs keep debugging and backup inspection obvious. */
export const ID_PREFIX = {
  account: "acc",
  transaction: "txn",
  category: "cat",
  budget: "bud",
  goal: "goal",
  contribution: "gco",
} as const;

export function newAccountId() {
  return newId(ID_PREFIX.account);
}
export function newTransactionId() {
  return newId(ID_PREFIX.transaction);
}
export function newCategoryId() {
  return newId(ID_PREFIX.category);
}
export function newBudgetId() {
  return newId(ID_PREFIX.budget);
}
export function newGoalId() {
  return newId(ID_PREFIX.goal);
}
export function newContributionId() {
  return newId(ID_PREFIX.contribution);
}

/** Deterministic ISO timestamp, used for `revision` conflict detection. */
export function nowISO(): string {
  return new Date().toISOString();
}
