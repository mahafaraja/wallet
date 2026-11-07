import { useMemo, useState } from "react";
import { Plus, Wallet, Landmark, PiggyBank, Smartphone, CreditCard, Check, ArrowLeftRight, Building2 } from "lucide-react";
import { AppShell } from "@/components/nav/Nav";
import {
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  SectionHeader,
  Select,
  TextArea,
  cn,
} from "@/components/ui/primitives";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Sheet } from "@/components/ui/Sheet";
import { Money } from "@/components/Money";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionSheet } from "@/components/transactions/TransactionSheet";
import type { Account, Category, Transaction, AccountType } from "@/db/schema";
import { createAccount, deleteAccount, updateAccount } from "@/data/repository";
import { accountBalance, accountBalances, totalInCurrency } from "@/lib/finance";
import { formatMoney, decimalsOf } from "@/lib/currency";
import { parseAmountToMinor } from "@/lib/money";
import { navigate } from "@/state/router";

const TYPE_OPTIONS: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: "cash", label: "Cash", icon: Wallet },
  { value: "mobile", label: "Mobile money", icon: Smartphone },
  { value: "bank", label: "Bank account", icon: Landmark },
  { value: "savings", label: "Savings account", icon: PiggyBank },
  { value: "other", label: "Other", icon: CreditCard },
];

function TypeGlyph({ type }: { type: AccountType }) {
  const found = TYPE_OPTIONS.find((t) => t.value === type);
  const Icon = found?.icon ?? CreditCard;
  return <Icon size={17} strokeWidth={2} />;
}

export function AccountsScreen({
  accounts,
  transactions,
  categories,
  reportingCurrency,
  enabledCurrencies,
}: {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  reportingCurrency: string;
  enabledCurrencies: string[];
}) {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [confirm, setConfirm] = useState<{ account: Account; reason: string } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions]);
  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const b of balances) {
      byCurrency.set(b.account.currency, (byCurrency.get(b.account.currency) ?? 0) + b.balanceMinor);
    }
    return [...byCurrency.entries()].sort((a, b) => (a[0] === reportingCurrency ? -1 : b[0] === reportingCurrency ? 1 : 0));
  }, [balances, reportingCurrency]);

  const primary = useMemo(() => totalInCurrency(balances, reportingCurrency), [balances, reportingCurrency]);

  return (
    <>
      <AppShell
        active="accounts"
        title="Accounts"
        subtitle={
          accounts.length > 0
            ? `${accounts.length} ${accounts.length === 1 ? "wallet" : "wallets"} · grouped by currency`
            : "Where your money lives"
        }
        headerRight={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={ArrowLeftRight}
              onClick={() => setTransferOpen(true)}
              disabled={accounts.length < 2}
            >
              Transfer
            </Button>
            <Button
              size="sm"
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              New
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {accounts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No accounts yet"
              body="Add cash, mobile money, a bank account or a savings wallet. Every transaction belongs to one."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                >
                  Add your first account
                </Button>
              }
            />
          ) : (
            <>
              {/* Totals per currency — never merged across currencies */}
              <div className="grid gap-2 sm:grid-cols-2">
                {totals.map(([code, amount]) => (
                  <Card key={code} className="!p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow text-ink-3">
                        {code === reportingCurrency ? "Total · reporting currency" : `Total · ${code}`}
                      </p>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 ts-caption-2 font-semibold text-ink-2">
                        {code}
                      </span>
                    </div>
                    <p className="figure-lg tnum mt-1">
                      <Money amountMinor={amount} currency={code} size="lg" tone={amount < 0 ? "expense" : "neutral"} />
                    </p>
                    <p className="ts-caption-1 mt-1 text-ink-3">
                      {balances.filter((b) => b.account.currency === code).length}{" "}
                      {balances.filter((b) => b.account.currency === code).length === 1 ? "account" : "accounts"}
                    </p>
                  </Card>
                ))}
              </div>

              {primary.excludedCount > 0 ? (
                <p className="px-1 ts-caption-1 text-ink-3">
                  {primary.excludedCount} {primary.excludedCount === 1 ? "account is" : "accounts are"} held in another
                  currency. Totals are shown per currency and never converted automatically.
                </p>
              ) : null}

              <section>
                <SectionHeader title="Your accounts" hint="Tap for detail" />
                <ListGroup>
                  {balances.map(({ account, balanceMinor, transactionCount }) => (
                    <ListRow
                      key={account.id}
                      onClick={() => navigate(`/account/${account.id}`)}
                      className={cn(account.archived && "opacity-55")}
                    >
                      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-surface-2 text-ink-2">
                        <TypeGlyph type={account.type} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate ts-subheadline font-medium">{account.name}</span>
                          {account.archived ? (
                            <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 ts-caption-2 font-semibold text-ink-3">
                              Archived
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate ts-caption-1 text-ink-3">
                          {TYPE_OPTIONS.find((t) => t.value === account.type)?.label} ·{" "}
                          {transactionCount} {transactionCount === 1 ? "record" : "records"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <Money amountMinor={balanceMinor} currency={account.currency} size="md" tone={balanceMinor < 0 ? "expense" : "neutral"} />
                        <span className="mt-0.5 block ts-caption-2 text-ink-3">{account.currency}</span>
                      </span>
                    </ListRow>
                  ))}
                </ListGroup>
              </section>
            </>
          )}
        </div>
      </AppShell>

      <AccountSheet
        open={editorOpen}
        account={editing}
        enabledCurrencies={enabledCurrencies}
        reportingCurrency={reportingCurrency}
        onClose={() => setEditorOpen(false)}
        onSaved={(name, isNew) =>
          toast(isNew ? "Account created" : "Account updated", { tone: "success", detail: name })
        }
        onDelete={(account, reason) => {
          setEditorOpen(false);
          setConfirm({ account, reason });
        }}
      />

      <TransactionSheet
        mode={{ open: transferOpen, presetType: "transfer" }}
        accounts={accounts}
        categories={categories}
        reportingCurrency={reportingCurrency}
        onClose={() => setTransferOpen(false)}
      />

      <ConfirmDialog
        open={confirm !== null}
        title="Delete this account?"
        body={
          confirm ? (
            <>
              <strong className="font-semibold text-ink">{confirm.account.name}</strong> cannot be deleted while it still
              has transactions, because that would corrupt your history. {confirm.reason}
            </>
          ) : null
        }
        confirmLabel="Archive instead"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          await updateAccount(confirm.account.id, { archived: true });
          toast("Account archived", { tone: "success", detail: "Its history is preserved." });
          setConfirm(null);
        }}
      />
    </>
  );
}

function AccountSheet({
  open,
  account,
  enabledCurrencies,
  reportingCurrency,
  onClose,
  onSaved,
  onDelete,
}: {
  open: boolean;
  account: Account | null;
  enabledCurrencies: string[];
  reportingCurrency: string;
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
  onDelete: (account: Account, reason: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState(reportingCurrency);
  const [openingText, setOpeningText] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const key = `${open}-${account?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    setName(account?.name ?? "");
    setType(account?.type ?? "cash");
    setCurrency(account?.currency ?? reportingCurrency);
    setOpeningText(
      account ? String(account.openingBalanceMinor / 10 ** decimalsOf(account.currency)) : "0",
    );
    setDescription(account?.description ?? "");
    setErrors({});
  }

  const decimals = decimalsOf(currency);

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Give this account a name.";
    const opening = parseAmountToMinor(openingText || "0", decimals);
    if (opening === null) nextErrors.openingBalance = "Enter a valid opening balance.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || opening === null) return;

    if (account) {
      await updateAccount(account.id, {
        name: name.trim(),
        type,
        currency,
        openingBalanceMinor: opening,
        description: description.trim() || undefined,
      });
      onSaved(name.trim(), false);
    } else {
      await createAccount({
        name: name.trim(),
        type,
        currency,
        openingBalanceMinor: opening,
        description: description.trim() || undefined,
      });
      onSaved(name.trim(), true);
    }
    onClose();
  };

  const tryDelete = async () => {
    if (!account) return;
    const result = await deleteAccount(account.id);
    if (result.ok) {
      onSaved(account.name, false);
      onClose();
      return;
    }
    onDelete(account, result.reason);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={account ? "Edit account" : "New account"}
      subtitle={account ? undefined : "A place your money lives"}
      footer={
        <div className="flex gap-2">
          {account ? (
            <Button variant="danger" size="lg" onClick={tryDelete}>
              Delete
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" icon={Check} onClick={submit}>
            {account ? "Save changes" : "Create account"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Account name" htmlFor="acc-name" error={errors.name}>
          <Input
            id="acc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cash on hand"
            invalid={Boolean(errors.name)}
            maxLength={40}
          />
        </Field>

        <Field label="Type">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => {
              const active = option.value === type;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-sm border px-1 py-2.5 transition",
                    active ? "border-accent bg-accent-wash text-accent" : "border-line bg-surface-2 text-ink-2",
                  )}
                >
                  <option.icon size={18} strokeWidth={2} />
                  <span className="ts-caption-1 font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Currency" htmlFor="acc-currency" hint="Cannot be silently converted later.">
            <Select
              id="acc-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={Boolean(account)}
            >
              {[...new Set([...enabledCurrencies, ...(account ? [account.currency] : [])])].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={`Opening balance (${currency})`}
            htmlFor="acc-opening"
            error={errors.openingBalance}
            hint={account ? "Changing this recalculates the balance." : "What was in it when you started."}
          >
            <Input
              id="acc-opening"
              type="text"
              inputMode="decimal"
              value={openingText}
              onChange={(e) => {
                setOpeningText(e.target.value.replace(/[^\d.]/g, ""));
                setErrors((p) => ({ ...p, openingBalance: "" }));
              }}
              placeholder={decimals > 0 ? "0.00" : "0"}
              invalid={Boolean(errors.openingBalance)}
              className="tnum"
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="acc-notes">
          <TextArea
            id="acc-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            maxLength={120}
          />
        </Field>
      </div>
    </Sheet>
  );
}

/* ==========================================================================
   Account detail
   ========================================================================== */

export function AccountDetailScreen({
  account,
  accounts,
  transactions,
  categories,
  reportingCurrency,
  onBack,
}: {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  reportingCurrency: string;
  onBack: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const own = useMemo(
    () => transactions.filter((t) => t.accountId === account.id || t.toAccountId === account.id),
    [transactions, account.id],
  );
  const sorted = useMemo(() => [...own].sort((a, b) => (a.date < b.date ? 1 : -1)), [own]);
  const balance = useMemo(() => accountBalance(account, transactions), [account, transactions]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const inflow = own
    .filter((t) => t.type === "income" || (t.type === "transfer" && t.toAccountId === account.id))
    .reduce((s, t) => s + t.amountMinor, 0);
  const outflow = own
    .filter((t) => t.type === "expense" || (t.type === "transfer" && t.accountId === account.id))
    .reduce((s, t) => s + t.amountMinor, 0);

  return (
    <>
      <AppShell
        active="accounts"
        title={account.name}
        subtitle={`${TYPE_OPTIONS.find((t) => t.value === account.type)?.label} · ${account.currency}`}
        headerRight={
          <Button size="sm" variant="secondary" onClick={onBack}>
            Back
          </Button>
        }
      >
        <div className="space-y-5">
          <Card>
            <p className="eyebrow text-ink-3">Current balance</p>
            <p className="figure-xl tnum mt-1">
              <Money amountMinor={balance.balanceMinor} currency={account.currency} size="xl" />
            </p>
            <p className="ts-footnote mt-2 text-ink-3">
              From an opening balance of {formatMoney(account.openingBalanceMinor, account.currency)} plus{" "}
              {balance.transactionCount} {balance.transactionCount === 1 ? "record" : "records"} — always recalculated,
              never stored.
            </p>

            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="eyebrow text-ink-3">In</p>
                <p className="mt-0.5">
                  <Money amountMinor={inflow} currency={account.currency} size="md" tone="income" />
                </p>
              </div>
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="eyebrow text-ink-3">Out</p>
                <p className="mt-0.5">
                  <Money amountMinor={outflow} currency={account.currency} size="md" />
                </p>
              </div>
            </div>

            {account.description ? (
              <p className="mt-3 rounded-sm bg-surface-2 px-3 py-2.5 ts-footnote leading-relaxed text-ink-2">
                {account.description}
              </p>
            ) : null}
          </Card>

          <Button size="lg" full icon={Plus} onClick={() => setSheetOpen(true)}>
            Record a transaction here
          </Button>

          <section>
            <SectionHeader title="Activity" hint={`${sorted.length} ${sorted.length === 1 ? "record" : "records"}`} />
            {sorted.length === 0 ? (
              <EmptyState icon={Building2} title="No activity" body="Transactions on this account will appear here." compact />
            ) : (
              <ListGroup>
                {sorted.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={categoryById.get(t.categoryId ?? "")}
                    accounts={accounts}
                    showDate
                  />
                ))}
              </ListGroup>
            )}
          </section>
        </div>
      </AppShell>

      <TransactionSheet
        mode={{ open: sheetOpen }}
        accounts={accounts}
        categories={categories}
        reportingCurrency={reportingCurrency}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
