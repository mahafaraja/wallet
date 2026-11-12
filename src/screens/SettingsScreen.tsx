import { useEffect, useRef, useState } from "react";
import {
  Check,
  Cloud,
  CloudOff,
  Download,
  RefreshCw,
  Sun,
  Moon,
  MonitorSmartphone,
  Trash2,
  Upload,
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
import type { BackupManifest } from "@/data/sync/adapter";
import { detectConflict } from "@/data/sync/adapter";
import type { BackupPayload } from "@/data/sync/syncManager";
import {
  describeSync,
  exportToFile,
  mergeBackup,
  planRestore,
  restoreBackup,
  driveAdapter,
} from "@/data/sync/syncManager";
import { buildBackup } from "@/data/sync/backupCodec";
import { isAuthenticated } from "@/data/sync/driveAuth";
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
  const [driveBackups, setDriveBackups] = useState<BackupManifest[]>([]);
  const [driveBusy, setDriveBusy] = useState<string | null>(null);

  const sync = describeSync();

  /* =========================================================================
     Drive auth effects
     ========================================================================= */

  // On mount: clear any stuck busy state and load Drive backups if already
  // authenticated (e.g. after a page reload with a stored token).
  useEffect(() => {
    setDriveBusy(null);

    if (isAuthenticated() && driveAdapter.available) {
      void loadDriveBackups();
    }
  }, []);

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

  /* =========================================================================
     Google Drive handlers
     ========================================================================= */

  const loadDriveBackups = async () => {
    try {
      const backups = await driveAdapter.listBackups();
      setDriveBackups(backups);
    } catch {
      // If listing fails (e.g. not connected), keep the list empty.
      setDriveBackups([]);
    }
  };

  const handleConnectDrive = async () => {
    setDriveBusy("Connecting");
    try {
      const session = await driveAdapter.connect();
      toast("Google Drive connected", {
        tone: "success",
        detail: session.accountLabel,
      });
      await loadDriveBackups();
    } catch (error) {
      setDriveBusy(null);
      toast("Connection failed", {
        tone: "error",
        detail: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDisconnectDrive = async () => {
    setDriveBusy("Disconnecting");
    try {
      await driveAdapter.disconnect();
      setDriveBackups([]);
      toast("Google Drive disconnected");
    } catch (error) {
      toast("Disconnect failed", {
        tone: "error",
        detail: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDriveBusy(null);
    }
  };

  const handleBackupToDrive = async () => {
    setDriveBusy("Backing up");
    try {
      const localPayload = await buildBackup();
      const records = localPayload.records;
      const manifest = await driveAdapter.upload(records);
      await loadDriveBackups();
      toast("Backup saved to Drive", {
        tone: "success",
        detail: manifest.label,
      });
    } catch (error) {
      toast("Backup to Drive failed", {
        tone: "error",
        detail: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDriveBusy(null);
    }
  };

  const handleRestoreFromDrive = async (manifest: BackupManifest) => {
    setBusy("Restoring from Drive");
    try {
      const records = await driveAdapter.download(manifest.id);
      const localPayload = await buildBackup();
      const conflict = detectConflict(
        {
          records: localPayload.records,
          revision: localPayload.revision,
          changedAt: localPayload.createdAt,
        },
        {
          records,
          revision: manifest.revision ?? 0,
          changedAt: manifest.createdAt,
        },
      );

      if (conflict.localOnly.length === 0 && conflict.diverged.length === 0) {
        await restoreBackup({
          app: "pocket-ledger",
          schemaVersion: 1,
          createdAt: manifest.createdAt,
          revision: manifest.revision ?? 0,
          counts: {},
          records,
        });
        toast("Backup restored from Drive", { tone: "success" });
      } else {
        const payload: BackupPayload = {
          app: "pocket-ledger",
          schemaVersion: 1,
          createdAt: manifest.createdAt,
          revision: manifest.revision ?? 0,
          counts: {},
          records,
        };
        await mergeBackup(payload);
        toast("Backup merged from Drive", {
          tone: "success",
          detail: "No records were discarded.",
        });
      }
      await loadDriveBackups();
    } catch (error) {
      toast("Restore from Drive failed", {
        tone: "error",
        detail: error instanceof Error ? error.message : undefined,
      });
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
              <p className="mt-2.5 ts-footnote text-ink-3">
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
                <p className="mb-2 ts-caption-1 font-semibold text-ink-2">Available when recording</p>
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
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ts-footnote-emph transition",
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
                <p className="mt-2 ts-caption-1 text-ink-3">
                  Enabling a currency only makes it available in pickers. Nothing is converted until you enter a rate.
                </p>
              </div>

              {ratePairs.length > 0 ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-1 ts-caption-1 font-semibold text-ink-2">
                    Rates into {reportingCurrency}
                  </p>
                  <p className="mb-2.5 ts-caption-1 text-ink-3">
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
                            <label className="mb-1 block ts-caption-1 text-ink-3">
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
                            <span className="pb-2.5 ts-caption-1 text-ink-3">
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
                  <Download size={17} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block ts-subheadline font-medium">Export JSON backup</span>
                  <span className="block ts-caption-1 text-ink-3">
                    {counts.transactions} transactions · {counts.accounts} accounts · {counts.goals} goals
                  </span>
                </span>
              </ListRow>

              <ListRow onClick={() => fileRef.current?.click()}>
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
                  <Upload size={17} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block ts-subheadline font-medium">Restore from backup</span>
                  <span className="block ts-caption-1 text-ink-3">
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

          {/* ---- Cloud sync (Google Drive) --------------------------------- */}
          <section>
            <SectionHeader title="Cloud synchronisation" hint="Google Drive backup" />
            <Card className="!p-3.5">
              {/* Status row */}
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${
                    driveAdapter.available ? "bg-surface-2" : "bg-danger-wash"
                  } text-ink-3`}
                >
                  {driveAdapter.available ? (
                    <Cloud size={17} strokeWidth={2} />
                  ) : (
                    <CloudOff size={17} strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 ts-callout font-semibold">
                    Google Drive
                    {!driveAdapter.available ? (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 ts-caption-2 font-semibold text-ink-3">
                        Not configured
                      </span>
                    ) : isAuthenticated() ? (
                      <span className="rounded-full bg-accent-wash px-2 py-0.5 ts-caption-2 font-semibold text-accent">
                        Connected
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 ts-caption-2 font-semibold text-ink-3">
                        Not connected
                      </span>
                    )}
                  </p>
                  <p className="mt-1 ts-footnote leading-snug text-ink-3">
                    {!driveAdapter.available
                      ? "Add VITE_GOOGLE_DRIVE_CLIENT_ID to .env to enable Google Drive."
                      : isAuthenticated()
                        ? "Backups live in your Google Drive. Back up or restore across devices."
                        : "Sign in to Google Drive to enable cloud backup."}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3.5 space-y-2">
                {!driveAdapter.available ? (
                  <Button variant="secondary" size="sm" full disabled>
                    Configure Google Drive
                  </Button>
                ) : isAuthenticated() ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      full
                      disabled={driveBusy !== null}
                      onClick={handleBackupToDrive}
                    >
                      {driveBusy === "Backing up" ? "Backing up…" : "Back up to Drive now"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      full
                      disabled={driveBusy !== null}
                      onClick={handleDisconnectDrive}
                    >
                      {driveBusy === "Disconnecting" ? "Disconnecting…" : "Disconnect Google Drive"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    full
                    disabled={driveBusy !== null}
                    onClick={handleConnectDrive}
                  >
                    {driveBusy === "Connecting" ? "Connecting…" : "Connect Google Drive"}
                  </Button>
                )}
                <p className="text-center ts-caption-1 text-ink-3">
                  {driveAdapter.available
                    ? isAuthenticated()
                      ? "Backups are versioned JSON in your Drive folder — nothing is silently overwritten."
                      : "Connect to enable cloud backup across your devices."
                    : "Set VITE_GOOGLE_DRIVE_CLIENT_ID in .env and restart the dev server."}
                </p>
              </div>

              {/* Drive backup list */}
              {isAuthenticated() && driveBackups.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 ts-caption-1 font-semibold text-ink-2">
                    Backups in Drive
                  </p>
                  <ListGroup>
                    {driveBackups.map((m) => (
                      <ListRow key={m.id} onClick={() => void handleRestoreFromDrive(m)}>
                        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
                          <Cloud size={15} strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block ts-subheadline font-medium">{m.label}</span>
                          <span className="block ts-caption-1 text-ink-3">
                            {new Date(m.createdAt).toLocaleString()} ·{" "}
                            {m.sizeBytes ? (m.sizeBytes / 1024).toFixed(1) + " KB" : "unknown size"}
                          </span>
                        </span>
                        <span className="text-ink-3 ts-caption-1">Restore</span>
                      </ListRow>
                    ))}
                  </ListGroup>
                </div>
              )}

              {/* Info details (shown when not yet connected) */}
              {!isAuthenticated() && driveAdapter.available && (
                <div className="mt-3.5 space-y-2 rounded-sm bg-surface-2 px-3 py-3 ts-caption-1 text-ink-2">
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
              )}
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
                  <RefreshCw size={17} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block ts-subheadline font-medium">
                    {isDemoData ? "Reset sample data" : "Load sample data"}
                  </span>
                  <span className="block ts-caption-1 text-ink-3">
                    {isDemoData
                      ? "Removes demo records and reseeds them."
                      : "Adds clearly labelled example records. Existing data is left alone."}
                  </span>
                </span>
              </ListRow>

              <ListRow onClick={() => setConfirmWipe(true)}>
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-danger-wash text-danger">
                  <Trash2 size={17} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block ts-subheadline font-medium text-danger">Delete all data</span>
                  <span className="block ts-caption-1 text-ink-3">
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
                <Info size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-ink-3" />
                <p className="ts-footnote leading-relaxed text-ink-2">
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
            <span className="ts-footnote-emph">{busy}…</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <p className="eyebrow text-ink-3">{label}</p>
      <p className="tnum mt-0.5 ts-subhead-emph">{value}</p>
    </div>
  );
}
