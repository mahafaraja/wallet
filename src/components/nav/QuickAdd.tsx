import { useState } from "react";
import { Plus, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import { cn } from "@/components/ui/primitives";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Account, Category } from "@/db/schema";

/**
 * Floating quick-add action. Raised above the bottom navigation on mobile,
 * docked into the corner on desktop. Always reachable, never in the way.
 */
export function QuickAddFab({ hidden }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false);

  const accounts = useLiveQuery(() => db.accounts.toArray(), [], undefined as Account[] | undefined);
  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined as Category[] | undefined);
  const reportingCurrency = useLiveQuery(
    async () => {
      const row = await db.preferences.get("reportingCurrency");
      return (row?.value as string | undefined) ?? "UGX";
    },
    [],
    "UGX",
  );

  if (hidden) return null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-[calc(max(env(safe-area-inset-bottom,0px),10px)+66px)] right-[calc(env(safe-area-inset-right,0px)+1rem)] z-40 flex flex-col items-end gap-2 md:bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] md:right-[calc(env(safe-area-inset-right,0px)+1.5rem)] lg:bottom-8 lg:right-8">
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Add a transaction"
            className={cn(
              "grid h-14 w-14 place-items-center rounded-full bg-accent text-on-accent",
              "shadow-[var(--shadow-float)] transition active:scale-[0.94] md:h-13 md:w-13",
            )}
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {accounts && categories ? (
        <TransactionSheet
          mode={{ open }}
          accounts={accounts}
          categories={categories}
          reportingCurrency={reportingCurrency}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Compact action pair, used where a full FAB would be too heavy. */
export function QuickAddPair({ onExpense, onIncome }: { onExpense: () => void; onIncome: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onExpense}
        className="ts-subhead-emph flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-surface text-ink transition active:scale-[0.97]"
      >
        <ArrowUpFromLine size={17} strokeWidth={2.4} /> Expense
      </button>
      <button
        type="button"
        onClick={onIncome}
        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-surface ts-footnote-emph text-ink transition active:scale-[0.97]"
      >
        <ArrowDownToLine size={17} strokeWidth={2.4} /> Income
      </button>
    </div>
  );
}
