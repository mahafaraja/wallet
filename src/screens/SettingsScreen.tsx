import { useRef, useState } from "react";
import {
  Check,
  Download,
  Upload,
  Cloud,
  CloudOff,
  Sun,
  Moon,
  MonitorSmartphone,
  RefreshCw,
  Trash2,
  Info,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/nav/Nav";
import {
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  SectionHeader,
  Segmented,
  Select,
  cn,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/feedback";
import type { ThemePreference } from "@/state/settings";
import { clearDemoData, seedDemoData } from "@/data/seed";
import { clearAllData } from "@/data/repository";
import { describeSync, exportToFile, mergeBackup, planRestore, restoreBackup } from "@/data/sync/syncManager";
import { CATALOGUE_ORDER, currency } from "@/lib/currency";
import { formatMoney } from "@/lib/currency";
import { parseAmountToMinor } from "@/lib/money";

export function SettingsScreen({
  theme,
  onThemeChange,
  reportingCurrency,
  onReportingCurrencyChange,
  enabledCurrencies,
  onEnabledCurrenciesChange,
  rates,
  onRatesChange,
  isDemoData,
  counts,
  onBack,
}: {
  theme: ThemePreference;
  onThemeChange: (t: ThemePreference) => void;
  reportingCurrency: string;
  onReportingCurrencyChange: (code: string) => void;
  enabledCurrencies: string[];
  onEnabledCurrenciesChange: (list: string[]) => void;
  rates: Record<string, number>;
  onRatesChange: (rates: Record<string, number>) => void;
  isDemoData: boolean;
  counts: { accounts: number; transactions: number; goals: number; budgets: number; categories: number };
  onBack: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  type PendingRestore = {
    kind: "restore" | "merge";
    summary: string;
    payload: Parameters<typeof restoreBackup>[0];
  };

  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sync = describeSync();

  const toggleCurrency = (code: string) => {
    if (code === reportingCurrency) return; // always keep the reporting currency enabled
    const next = enabledCurrencies.includes(code)
      ? enabledCurrencies.filter((c) => c !== code)
      : [...enabledCurrencies, code];
    onEnabledCurrenciesChange(next.length > 0 ? next : [reportingCurrency]);
  };

  const handleFile = async (file: File) => {
    setBusy("Reading backup");
    try {
      const plan = await planRestore(file);
      if (plan.action === "reject") {
        toast("Cannot use that file", { tone: "error", detail: plan.reason });
        return;
      }
      setPendingRestore({
        kind: plan.action,
        summary: plan.action === "merge" ? plan.conflict.summary : plan.summary,
        payload: plan.payload,
      });
    } catch (error) {
      toast("Could not read that file", { tone: "error", detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const ratePairs = enabledCurrencies
    .filter((c) => c !== reportingCurrency)
    .flatMap((code) => [{ from: code, to: reportingCurrency, key: `${code}_${reportingCurrency}` }]);

  return (
    <>
      <AppShell
        active="settings"
        title="Settings"
        subtitle="Preferences, currencies and backups"
        headerRight={
          <Button size="sm" variant="secondary" onClick={onBack}>
            Back
          </Button>
        }
      >
        <div className="space-y-6">
          {/* ---- Appearance ---------------------------------------------- */}
          <section>
            <SectionHeader title="Appearance" />
            <Card className="!p-3.5">
              <Segmented<ThemePreference>
                value={theme}
                onChange={onThemeChange}
                options={[
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: MonitorSmartphone },
                ]}
              />
              <p className="mt-2.5 text-[12.5px] text-ink-3">
                System follows your device, including a change while the app is open.
              </p>
            </Card>
          </section>

          {/* ---- Currencies --------------------------------------------- */}
          <section>
            <SectionHeader
              title="Currencies"
              hint={`Reporting currency is ${reportingCurrency}. Totals never mix currencies.`}
            />
            <Card className="!p-3.5">
              <Field label="Reporting currency" htmlFor="reporting" hint="Used for all totals, budgets and charts.">
                <Select
                  id="reporting"
                  value={reportingCurrency}
                  onChange={(e) => {
                    const next = e.target.value;
                    onReportingCurrencyChange(next);
                    if (!enabledCurrencies.includes(next)) {
                      onEnabledCurrenciesChange([...enabledCurrencies, next]);
                    }
                  }}
                >
                  {CATALOGUE_ORDER.filter((c) => enabledCurrencies.includes(c)).map((code) => (
                    <option key={code} value={code}>
                      {currency(code).name} · {code}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-ink-2">Available when recording</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATALOGUE_ORDER.map((code) => {
                    const active = enabledCurrencies.includes(code);
                    const locked = code === reportingCurrency;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleCurrency(code)}
                        disabled={locked}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
                          active
                            ? "border-accent bg-accent-wash text-accent"
                            : "border-line bg-surface-2 text-ink-2",
                          locked && "opacity-60",
                        )}
                        title={locked ? "Always enabled as your reporting currency" : undefined}
                      >
                        {active ? <Check size={12} strokeWidth={2.6} /> : null}
                        {code}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[12px] text-ink-3">
                  Enabling a currency only makes it available in pickers. Nothing is converted until you enter a rate.
                </p>
              </div>

              {ratePairs.length > 0 ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-1 text-[12px] font-semibold text-ink-2">
                    Rates into {reportingCurrency}
                  </p>
                  <p className="mb-2.5 text-[12px] text-ink-3">
                    You supply these by hand. A record in another currency is excluded from reports until you give it a
                    rate — never estimated.
                  </p>
                  <div className="space-y-2.5">
                    {ratePairs.map((pair) => {
                      const meta = currency(pair.from);
                      const value = rates[pair.key] ? String(rates[pair.key]) : "";
                      return (
                        <div key={pair.key} className="flex items-end gap-2.5">
                          <div className="min-w-0 flex-1">
                            <label className="mb-1 block text-[11.5px] text-ink-3">
                              1 {pair.from} ({meta.symbol}) in {pair.to}
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={value}
                              placeholder="e.g. 0.00027"
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d.]/g, "");
                                const next = { ...rates };
                                const parsed = parseAmountToMinor(raw, 6);
                                if (raw === "") delete next[pair.key];
                                else next[pair.key] = Number(raw);
                                onRatesChange(next);
                                void parsed;
                              }}
                              className="tnum"
                            />
                          </div>
                          {value ? (
                            <span className="pb-2.5 text-[11.5px] text-ink-3">
                              ≈ {formatMoney(1, pair.from)} = {Number(value).toLocaleString()} {pair.to}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </Card>
          </section>

          {/* ---- Backup -------------------------------------------------- */}
          <section>
            <SectionHeader title="Backup" hint="Your data lives on this device" />
            <ListGroup>
              <ListRow onClick={() => void (async () => {
                setBusy("Exporting");
                try {
                  const { filename } = await exportToFile();
                  toast("Backup downloaded", { tone: "success", detail: filename });
                } finally {
                  setBusy(null);
                }
              })()}>
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
                  <Download size={17} strokeWidth={2.05} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">Export JSON backup</span>
                  <span className="block text-[12px] text-ink-3">
                    {counts.transactions} transactions · {counts.accounts} accounts · {counts.goals} goals
                  </span>
                </span>
              </ListRow>

              <ListRow onClick={() => fileRef.current?.click()}>
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
                  <Upload size={17} strokeWidth={2.05} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">Restore from backup</span>
                  <span className="block text-[12px] text-ink-3">
                    Conflicts are detected before anything is written
                  </span>
                </span>
              </ListRow>
            </ListGroup>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </section>

          {/* ---- Cloud sync (planned, not connected) --------------------- */}
          <section>
            <SectionHeader title="Cloud synchronisation" hint="Planned for a future version" />
            <Card className="!p-3.5">
              <div className="flex items-start gap-3">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-3">
                  <CloudOff size={17} strokeWidth={2.05} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14.5px] font-semibold">
                    Google Drive
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ink-3">
                      Not connected
                    </span>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-ink-3">{sync.cloud.detail}</p>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 rounded-sm bg-surface-2 px-3 py-3 text-[12px] text-ink-2">
                <p className="flex items-start gap-2">
                  <Cloud size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-3" />
                  Backups will live in a visible Drive folder named{" "}
                  <strong className="font-semibold text-ink">{sync.cloud.plannedFolder}</strong>, so you can always reach
                  them yourself.
                </p>
                <p className="flex items-start gap-2">
                  <ShieldCheck size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-3" />
                  The narrow <code className="font-mono text-[11px]">{sync.cloud.scope}</code> permission will be
                  requested — access limited to files this app creates.
                </p>
                <p className="flex items-start gap-2">
                  <Coins size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-3" />
                  Versioned JSON, with timestamps and conflict prompts. Nothing is ever silently overwritten or deleted.
                </p>
              </div>

              <Button
                variant="secondary"
                size="md"
                full
                className="mt-3"
                disabled
                aria-describedby="cloud-disabled"
              >
                Connect Google Drive
              </Button>
              <p id="cloud-disabled" className="mt-1.5 text-center text-[11.5px] text-ink-3">
                Switched on in a later version. Not part of this build.
              </p>
            </Card>
          </section>

          {/* ---- Demo data ----------------------------------------------- */}
          <section>
            <SectionHeader title="Sample data" />
            <ListGroup>
              <ListRow
                onClick={() => {
                  if (isDemoData) setConfirmReset(true);
                  else setConfirmReset(true);
                }}
              >
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
                  <RefreshCw size={17} strokeWidth={2.05} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">
                    {isDemoData ? "Reset sample data" : "Load sample data"}
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {isDemoData
                      ? "Removes demo records and reseeds them."
                      : "Adds clearly labelled example records. Existing data is left alone."}
                  </span>
                </span>
              </ListRow>

              <ListRow onClick={() => setConfirmWipe(true)}>
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-danger-wash text-danger">
                  <Trash2 size={17} strokeWidth={2.05} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-danger">Delete all data</span>
                  <span className="block text-[12px] text-ink-3">
                    Clears every account, transaction, budget and goal on this device.
                  </span>
                </span>
              </ListRow>
            </ListGroup>
          </section>

          {/* ---- About --------------------------------------------------- */}
          <section>
            <SectionHeader title="About" />
            <Card className="!p-3.5">
              <div className="flex items-start gap-2.5">
                <Info size={15} strokeWidth={2.05} className="mt-0.5 shrink-0 text-ink-3" />
                <p className="text-[12.5px] leading-relaxed text-ink-2">
                  Pocket Ledger stores everything in your browser's IndexedDB on this device. No account, no server, no
                  analytics. Backups are plain JSON you can open in any text editor.
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Count label="Transactions" value={counts.transactions} />
                <Count label="Accounts" value={counts.accounts} />
                <Count label="Categories" value={counts.categories} />
                <Count label="Budgets" value={counts.budgets} />
                <Count label="Goals" value={counts.goals} />
              </div>
            </Card>
          </section>
        </div>
      </AppShell>

      {/* ---- Restore / merge decision ------------------------------------ */}
      <ConfirmDialog
        open={pendingRestore !== null}
        title={pendingRestore?.kind === "merge" ? "Both copies have changes" : "Restore this backup?"}
        body={pendingRestore?.summary}
        confirmLabel={pendingRestore?.kind === "merge" ? "Merge both" : "Replace this device"}
        busy={busy === "Restoring"}
        onCancel={() => setPendingRestore(null)}
        onConfirm={async () => {
          if (!pendingRestore) return;
          setBusy("Restoring");
          try {
            const payload = pendingRestore.payload;
            if (pendingRestore.kind === "merge") {
              await mergeBackup(payload);
              toast("Backup merged", { tone: "success", detail: "No records were discarded." });
            } else {
              await restoreBackup(payload);
              toast("Backup restored", { tone: "success" });
            }
            setPendingRestore(null);
          } catch (error) {
            toast("Restore failed", { tone: "error", detail: error instanceof Error ? error.message : undefined });
          } finally {
            setBusy(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title={isDemoData ? "Reset sample data?" : "Load sample data?"}
        body={
          isDemoData ? (
            <>
              Demo accounts, transactions, budgets and goals will be removed and re-created. Any records you added
              yourself are kept — they are not sample data.
            </>
          ) : (
            <>
              Sample records will be added so you can explore the app. Records you already have are not touched. You can
              remove the sample data at any time.
            </>
          )
        }
        confirmLabel={isDemoData ? "Reset sample data" : "Load sample data"}
        busy={busy === "Seeding"}
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setBusy("Seeding");
          try {
            if (isDemoData) {
              await clearDemoData();
              await seedDemoData(true);
              toast("Sample data reset", { tone: "success" });
            } else {
              await seedDemoData(true);
              toast("Sample data loaded", { tone: "success", detail: "Look for the demo label on records." });
            }
            setConfirmReset(false);
          } finally {
            setBusy(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmWipe}
        title="Delete everything?"
        body={
          <>
            This permanently clears all accounts, transactions, budgets, goals and contributions from this device.
            Preferences such as theme and reporting currency are kept. Consider exporting a backup first — this cannot
            be undone.
          </>
        }
        confirmLabel="Delete all data"
        destructive
        busy={busy === "Clearing"}
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          setBusy("Clearing");
          try {
            await clearAllData();
            await clearDemoData();
            toast("All data deleted", { tone: "success" });
            setConfirmWipe(false);
            onBack();
          } finally {
            setBusy(null);
          }
        }}
      />

      {busy ? (
        <div className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[calc(max(env(safe-area-inset-bottom,0px),10px)+84px)]">
          <div className="flex items-center gap-2 rounded-full border border-line bg-elevated px-3.5 py-2 shadow-[var(--shadow-float)]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
            <span className="text-[12.5px] font-medium">{busy}…</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-3">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-semibold">{value}</p>
    </div>
  );
}
