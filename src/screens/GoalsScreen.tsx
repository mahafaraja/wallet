import { useMemo, useState } from "react";
import { Plus, Target, Check, Minus, CalendarDays, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/nav/Nav";
import {
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  ProgressBar,
  SectionHeader,
  Select,
  TextArea,
  cn,
} from "@/components/ui/primitives";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { ConfirmDialog, Sheet } from "@/components/ui/Sheet";
import { Money } from "@/components/Money";
import { iconFor, PICKER_ICONS } from "@/design/icons";
import type { Account, GoalContribution, SavingsGoal } from "@/db/schema";
import { contributeToGoal, createGoal, deleteGoal, updateGoal } from "@/data/repository";
import { allGoalProgress } from "@/lib/finance";
import { todayISO, dayLabel } from "@/lib/dates";
import { decimalsOf, formatMoney } from "@/lib/currency";
import { parseAmountToMinor } from "@/lib/money";
import { navigate } from "@/state/router";

const HUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function GoalsScreen({
  goals,
  contributions,
  accounts,
  reportingCurrency,
}: {
  goals: SavingsGoal[];
  contributions: GoalContribution[];
  accounts: Account[];
  reportingCurrency: string;
}) {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [funding, setFunding] = useState<{ goal: SavingsGoal; mode: "add" | "withdraw" } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);

  const progress = useMemo(() => allGoalProgress(goals, contributions), [goals, contributions]);
  const totalSaved = progress.reduce((s, p) => s + p.savedMinor, 0);
  const totalTarget = progress.reduce((s, p) => s + p.goal.targetAmountMinor, 0);
  const complete = progress.filter((p) => p.isComplete).length;

  return (
    <>
      <AppShell
        active="goals"
        title="Saving goals"
        subtitle={
          goals.length > 0
            ? `${goals.length} ${goals.length === 1 ? "goal" : "goals"} · ${complete} funded`
            : "Set something aside, on purpose"
        }
        headerRight={
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              setEditingGoal(null);
              setEditorOpen(true);
            }}
          >
            New
          </Button>
        }
      >
        <div className="space-y-5">
          {goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              body="Name the thing you are saving towards — an emergency fund, school fees, a sofa — and give it a target."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGoal(null);
                    setEditorOpen(true);
                  }}
                >
                  Create your first goal
                </Button>
              }
            />
          ) : (
            <>
              <Card>
                <p className="eyebrow text-ink-3">Saved across all goals</p>
                <p className="figure-lg tnum mt-1">
                  <Money amountMinor={totalSaved} currency={goals[0]?.currency ?? reportingCurrency} size="lg" />
                </p>
                <div className="mt-3">
                  <ProgressBar
                    value={totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0}
                    height={8}
                    tone="income"
                  />
                </div>
                <p className="mt-2 text-[12.5px] text-ink-3">
                  {totalTarget > 0 ? (
                    <>
                      <Money amountMinor={totalTarget - totalSaved} currency={goals[0]?.currency ?? reportingCurrency} size="sm" tone="muted" />{" "}
                      still to go across {goals.length} {goals.length === 1 ? "goal" : "goals"}
                    </>
                  ) : (
                    "Open-ended goals with no target"
                  )}
                </p>
              </Card>

              <section>
                <SectionHeader title="Your goals" hint="Tap a card to add money" />
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {progress.map((p) => {
                    const Icon = iconFor(p.goal.icon);
                    return (
                      <button
                        key={p.goal.id}
                        type="button"
                        onClick={() => navigate(`/goal/${p.goal.id}`)}
                        className="press rounded-lg border border-line bg-surface p-4 text-left transition"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-[11px]",
                              `bg-hue${p.goal.hue}-wash`,
                              `text-hue${p.goal.hue}`,
                            )}
                          >
                            <Icon size={19} strokeWidth={2.05} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-[15.5px] font-semibold">{p.goal.name}</p>
                              {p.isComplete ? (
                                <span className="shrink-0 rounded-full bg-income-wash px-2 py-0.5 text-[10.5px] font-semibold text-income">
                                  Funded
                                </span>
                              ) : (
                                <span className="tnum shrink-0 text-[12.5px] font-semibold text-ink-2">
                                  {p.progressPercent}%
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[12px] text-ink-3">
                              <Money amountMinor={p.savedMinor} currency={p.goal.currency} size="sm" tone="muted" /> of{" "}
                              <Money amountMinor={p.goal.targetAmountMinor} currency={p.goal.currency} size="sm" tone="muted" />
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <ProgressBar value={p.progressPercent} height={6} tone="income" />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
                          {p.monthsRemaining !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={12} strokeWidth={2.1} />
                              {p.goal.targetDate ? dayLabel(p.goal.targetDate) : null}
                            </span>
                          ) : null}
                          {p.requiredMonthlyMinor !== null && !p.isComplete ? (
                            <span>{formatMoney(p.requiredMonthlyMinor, p.goal.currency)} / month</span>
                          ) : null}
                          {p.contributionCount > 0 ? (
                            <span>
                              {p.contributionCount} {p.contributionCount === 1 ? "deposit" : "deposits"}
                            </span>
                          ) : null}
                          <ChevronRight size={13} strokeWidth={2.2} className="ml-auto" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </AppShell>

      <GoalEditorSheet
        open={editorOpen}
        goal={editingGoal}
        reportingCurrency={reportingCurrency}
        onClose={() => setEditorOpen(false)}
        onCreated={(name) => toast("Goal created", { tone: "success", detail: name })}
        onUpdated={(name) => toast("Goal updated", { tone: "success", detail: name })}
        onDelete={(goal) => {
          setEditorOpen(false);
          setPendingDelete(goal);
        }}
      />

      <FundingSheet
        target={funding}
        accounts={accounts}
        onClose={() => setFunding(null)}
        onDone={(message, detail) => toast(message, { tone: "success", detail })}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this goal?"
        body={
          <>
            <strong className="font-semibold text-ink">{pendingDelete?.name}</strong> and its{" "}
            {contributions.filter((c) => c.goalId === pendingDelete?.id).length} contribution
            {contributions.filter((c) => c.goalId === pendingDelete?.id).length === 1 ? "" : "s"} will be removed. Any
            transactions you recorded against it stay in your activity.
          </>
        }
        confirmLabel="Delete goal"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteGoal(pendingDelete.id);
          toast("Goal deleted", { tone: "success" });
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* ==========================================================================
   Goal editor
   ========================================================================== */

function GoalEditorSheet({
  open,
  goal,
  reportingCurrency,
  onClose,
  onCreated,
  onUpdated,
  onDelete,
}: {
  open: boolean;
  goal: SavingsGoal | null;
  reportingCurrency: string;
  onClose: () => void;
  onCreated: (name: string) => void;
  onUpdated: (name: string) => void;
  onDelete: (goal: SavingsGoal) => void;
}) {
  const currency = goal?.currency ?? reportingCurrency;
  const decimals = decimalsOf(currency);

  const [name, setName] = useState("");
  const [targetText, setTargetText] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("Target");
  const [hue, setHue] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const key = `${open}-${goal?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    setName(goal?.name ?? "");
    setTargetText(goal ? String(goal.targetAmountMinor / 10 ** decimals) : "");
    setTargetDate(goal?.targetDate ?? "");
    setDescription(goal?.description ?? "");
    setIcon(goal?.icon ?? "Target");
    setHue(goal?.hue ?? 1);
    setErrors({});
  }

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Give this goal a name.";
    const target = parseAmountToMinor(targetText, decimals);
    if (target === null || target <= 0) nextErrors.target = "Enter a target greater than zero.";
    setErrors(nextErrors);
    // Combined guard so TypeScript can narrow `target` to a definite integer.
    if (Object.keys(nextErrors).length > 0 || target === null || target <= 0) return;

    if (goal) {
      await updateGoal(goal.id, {
        name: name.trim(),
        targetAmountMinor: target,
        targetDate: targetDate || undefined,
        description: description.trim() || undefined,
        icon,
        hue: hue as SavingsGoal["hue"],
      });
      onUpdated(name.trim());
    } else {
      await createGoal({
        name: name.trim(),
        targetAmountMinor: target,
        currency,
        targetDate: targetDate || undefined,
        description: description.trim() || undefined,
        icon,
        hue: hue as SavingsGoal["hue"],
      });
      onCreated(name.trim());
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      subtitle={goal ? undefined : "Something worth setting money aside for"}
      footer={
        <div className="flex gap-2">
          {goal ? (
            <Button variant="danger" size="lg" onClick={() => onDelete(goal)}>
              Delete
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" icon={Check} onClick={submit}>
            {goal ? "Save changes" : "Create goal"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="goal-name" error={errors.name}>
          <Input
            id="goal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Emergency fund"
            invalid={Boolean(errors.name)}
            maxLength={48}
          />
        </Field>

        <Field label={`Target amount (${currency})`} error={errors.target}>
          <Input
            type="text"
            inputMode="decimal"
            value={targetText}
            onChange={(e) => {
              setTargetText(e.target.value.replace(/[^\d.]/g, ""));
              setErrors((p) => ({ ...p, target: "" }));
            }}
            placeholder={decimals > 0 ? "0.00" : "0"}
            invalid={Boolean(errors.target)}
            className="tnum text-center !text-[26px] !font-semibold"
          />
        </Field>

        <div className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {[250_000, 500_000, 1_000_000, 3_000_000, 5_000_000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTargetText(String(preset / 10 ** decimals))}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2"
            >
              {formatMoney(preset, currency)}
            </button>
          ))}
        </div>

        <Field label="Target date" htmlFor="goal-date" hint="Optional. Used to suggest a monthly amount.">
          <Input id="goal-date" type="date" value={targetDate} min={todayISO()} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>

        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {PICKER_ICONS.map((name) => {
              const Icon = iconFor(name);
              const active = name === icon;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  aria-label={name}
                  aria-pressed={active}
                  className={cn(
                    "grid aspect-square place-items-center rounded-[9px] border transition",
                    active ? "border-accent bg-accent-wash text-accent" : "border-line bg-surface-2 text-ink-2",
                  )}
                >
                  <Icon size={17} strokeWidth={2.05} />
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Colour">
          <div className="flex gap-2">
            {HUES.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHue(h)}
                aria-label={`Colour ${h}`}
                aria-pressed={h === hue}
                className={cn(
                  "h-9 flex-1 rounded-[9px] border-2 transition",
                  `bg-hue${h}-wash`,
                  h === hue ? "border-accent" : "border-transparent",
                )}
              />
            ))}
          </div>
        </Field>

        <Field label="Notes" htmlFor="goal-notes">
          <TextArea
            id="goal-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why this matters to you"
            maxLength={200}
          />
        </Field>
      </div>
    </Sheet>
  );
}

/* ==========================================================================
   Funding (add / withdraw)
   ========================================================================== */

export function FundingSheet({
  target,
  accounts,
  onClose,
  onDone,
}: {
  target: { goal: SavingsGoal; mode: "add" | "withdraw" } | null;
  accounts: Account[];
  onClose: () => void;
  onDone: (message: string, detail?: string) => void;
}) {
  if (!target) return null;
  const { goal, mode } = target;
  const decimals = decimalsOf(goal.currency);
  const matching = accounts.filter((a) => a.currency === goal.currency);

  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState(matching[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmountToMinor(amountText, decimals) ?? 0;

  const submit = async () => {
    if (amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    try {
      await contributeToGoal({
        goalId: goal.id,
        amountMinor: mode === "withdraw" ? -amount : amount,
        currency: goal.currency,
        date,
        note: note.trim() || undefined,
        fromAccountId: accountId || undefined,
      });
      onDone(
        mode === "withdraw" ? "Withdrawal recorded" : "Contribution recorded",
        `${formatMoney(amount, goal.currency)} ${mode === "withdraw" ? "from" : "to"} ${goal.name}`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that.");
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === "withdraw" ? `Withdraw from ${goal.name}` : `Add to ${goal.name}`}
      subtitle={`${formatMoney(goal.targetAmountMinor, goal.currency)} target`}
      footer={
        <Button
          size="lg"
          full
          icon={mode === "withdraw" ? Minus : Plus}
          variant={mode === "withdraw" ? "secondary" : "primary"}
          onClick={submit}
        >
          {mode === "withdraw" ? "Withdraw" : "Add"} {amount > 0 ? formatMoney(amount, goal.currency) : ""}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={`Amount (${goal.currency})`} error={error ?? undefined}>
          <Input
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value.replace(/[^\d.]/g, ""));
              setError(null);
            }}
            placeholder={decimals > 0 ? "0.00" : "0"}
            invalid={Boolean(error)}
            className="tnum text-center !text-[30px] !font-semibold"
          />
        </Field>

        <div className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {[10_000, 50_000, 100_000, 250_000, 500_000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountText(String(preset / 10 ** decimals))}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2"
            >
              {formatMoney(preset, goal.currency)}
            </button>
          ))}
        </div>

        {matching.length > 0 ? (
          <Field
            label="From account"
            hint="Records a matching transaction so your balance stays accurate. Leave empty to skip."
          >
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">No account — just the goal</option>
              {matching.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="rounded-sm bg-surface-2 px-3 py-2.5">
            <p className="text-[12.5px] text-ink-2">
              No {goal.currency} account exists, so this will only adjust the goal total.
            </p>
          </div>
        )}

        <Field label="Date" htmlFor="fund-date">
          <Input id="fund-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Note" htmlFor="fund-note">
          <Input id="fund-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={80} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ==========================================================================
   Goal detail screen
   ========================================================================== */

export function GoalDetailScreen({
  goal,
  contributions,
  accounts,
  onBack,
}: {
  goal: SavingsGoal;
  contributions: GoalContribution[];
  accounts: Account[];
  onBack: () => void;
}) {
  const [funding, setFunding] = useState<{ goal: SavingsGoal; mode: "add" | "withdraw" } | null>(null);
  const progress = useMemo(() => allGoalProgress([goal], contributions)[0], [goal, contributions]);
  const Icon = iconFor(goal.icon);
  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name;

  return (
    <>
      <AppShell
        active="goals"
        title={goal.name}
        subtitle={
          goal.targetDate
            ? `Target ${dayLabel(goal.targetDate)} · ${progress.progressPercent}% funded`
            : `${progress.progressPercent}% funded`
        }
        headerRight={
          <Button variant="secondary" size="sm" onClick={onBack}>
            Back
          </Button>
        }
      >
        <div className="space-y-5">
          <Card>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-[12px]",
                  `bg-hue${goal.hue}-wash`,
                  `text-hue${goal.hue}`,
                )}
              >
                <Icon size={22} strokeWidth={2.05} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow text-ink-3">Saved</p>
                <p className="figure-lg tnum mt-0.5">
                  <Money amountMinor={progress.savedMinor} currency={goal.currency} size="lg" />
                </p>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  of {formatMoney(goal.targetAmountMinor, goal.currency)}
                  {progress.remainingMinor > 0 ? ` · ${formatMoney(progress.remainingMinor, goal.currency)} to go` : " · funded"}
                </p>
              </div>
            </div>

            <div className="mt-3.5">
              <ProgressBar value={progress.progressPercent} height={10} tone="income" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {progress.monthsRemaining !== null ? (
                <Detail label="Months left" value={String(progress.monthsRemaining)} />
              ) : null}
              {progress.requiredMonthlyMinor !== null ? (
                <Detail label="Per month" value={formatMoney(progress.requiredMonthlyMinor, goal.currency)} />
              ) : null}
              <Detail label="Deposits" value={String(progress.contributionCount)} />
            </div>

            {goal.description ? (
              <p className="mt-3 rounded-sm bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">
                {goal.description}
              </p>
            ) : null}
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" icon={Plus} onClick={() => setFunding({ goal, mode: "add" })}>
              Add money
            </Button>
            <Button size="lg" variant="secondary" icon={Minus} onClick={() => setFunding({ goal, mode: "withdraw" })}>
              Withdraw
            </Button>
          </div>

          <section>
            <SectionHeader title="History" hint={`${contributions.length} ${contributions.length === 1 ? "entry" : "entries"}`} />
            {contributions.length === 0 ? (
              <EmptyState icon={Target} title="No contributions yet" body="Even a small first deposit gets the goal moving." compact />
            ) : (
              <ListGroup>
                {contributions.map((c) => {
                  const positive = c.amountMinor >= 0;
                  return (
                    <ListRow key={c.id} indent>
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
                          positive ? "bg-income-wash text-income" : "bg-surface-2 text-ink-2",
                        )}
                      >
                        {positive ? <Plus size={17} strokeWidth={2.3} /> : <Minus size={17} strokeWidth={2.3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium">
                          {c.note ?? (positive ? "Contribution" : "Withdrawal")}
                        </span>
                        <span className="block text-[12px] text-ink-3">
                          {dayLabel(c.date)}
                          {c.transactionId && accountName(c.transactionId) ? " · linked" : ""}
                        </span>
                      </span>
                      <Money
                        amountMinor={c.amountMinor}
                        currency={c.currency}
                        size="md"
                        signed
                        tone={positive ? "income" : "expense"}
                      />
                    </ListRow>
                  );
                })}
              </ListGroup>
            )}
          </section>
        </div>
      </AppShell>

      <FundingSheet
        target={funding}
        accounts={accounts}
        onClose={() => setFunding(null)}
        onDone={() => undefined}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-3">{label}</p>
      <p className="tnum mt-0.5 text-[14px] font-semibold">{value}</p>
    </div>
  );
}
