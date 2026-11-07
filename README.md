# Pocket Ledger

A personal finance application that runs entirely on your device. Track income,
expenses, budgets, accounts and savings goals — no account, no server, no
analytics.

Built mobile-first as an installable PWA, tuned for the iPhone XR viewport and
up through desktop.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run build        # production build to dist/
npm start            # serve dist/ on :3000
npm test             # financial calculation test suite
npm run typecheck    # tsc --noEmit
```

The app opens with clearly-labelled sample data so nothing is empty. Remove or
reset it from **Settings → Sample data**.

---

## Design system

Everything visual comes from one place: `src/app.css`.

| Layer | Where |
| --- | --- |
| Colour tokens | `--p-*` primitives, redefined per theme |
| Typography | `.figure-*`, `.eyebrow`, `.tnum` utilities |
| Radius / shadow / motion | Tailwind theme + `--ease-out-*` curves |
| Category hues | `--p-hue1…10` with matching washes |

Two themes (light and dark) plus a system-following mode. One accent colour —
indigo-violet — with semantic income, expense, warning and danger tokens on a
restrained cool-neutral base. No raw hex value appears in a component.

Type is a native system font stack (`-apple-system` first). Financial figures
use tabular numerals throughout so digits never jitter as totals change, and the
largest figures get their own scale with tight display tracking.

Icons are **Lucide React only** — no emoji, no generated art, no hand-drawn SVG
illustrations. `src/design/icons.ts` maps stored icon *names* to components so
records stay JSON-serialisable.

The application mark is a simple geometric target: a ring and a dot, legible at
16px.

---

## Architecture

```
src/
  db/            Dexie schema + instance
  data/
    repository.ts   the ONLY module that touches IndexedDB
    seed.ts         clearly-labelled sample data
    sync/
      adapter.ts        SyncAdapter contract, conflict detection, merge
      adapters.ts       Google Drive stub + local file adapter
      backupCodec.ts    versioned JSON envelope
      syncManager.ts    orchestration: export, import, restore, merge
  lib/
    money.ts       integer minor-unit arithmetic
    currency.ts    ISO 4217 catalogue, formatting, conversion
    finance.ts     pure calculations (balances, totals, budgets, goals)
    dates.ts       deterministic local-calendar dates
    validate.ts    input validation
    id.ts          prefixed IDs + revision clock
  state/          hash router, settings hooks
  components/
    ui/            primitives, Sheet, ConfirmDialog, toasts, empty/loading
    nav/           bottom bar, desktop rail, quick-add FAB
    transactions/  row, transaction sheet
  screens/         Home, Activity, Budgets, Goals, Insights, Accounts, Settings
```

**Separation of concerns is deliberate.** Screens never query IndexedDB — they
call the repository. Calculations are pure functions with no I/O, which is what
makes them testable. The sync layer is behind an interface, so the Google Drive
implementation can be added without touching a screen.

---

## Money correctness

This is the part that has to be right.

- **Integer minor units.** Every amount is an integer count of the currency's
  minor unit. `0.1 + 0.2` is never a question the app has to answer.
- **Currency precision comes from ISO 4217.** UGX, RWF, TZS, BIF, JPY and KRW
  have **zero** minor units. Treating them as two-decimal currencies is the most
  common money bug in East-African fintech, so it is encoded in the catalogue.
- **Transfers are never income or expense.** They only move money between
  accounts. Enforced in `monthlyTotals()` and covered by tests.
- **Balances are always recomputed** from the opening balance plus
  transactions — never read from a cached column. An edit or delete corrects
  every derived figure immediately.
- **Currencies are never silently merged.** A record in another currency is
  excluded from reports and *counted*, so the UI can say "2 records excluded".
  Conversion happens only when the user supplies a rate, and the converted value
  is stored *alongside* the original — never instead of it.
- **Splitting never loses a unit.** `splitMinor(1000, 3)` returns
  `[334, 333, 333]`, which sums back to exactly 1000.
- **Nothing is discarded on validation failure.** The form keeps what you typed;
  the error names the field.
- **Deletes are guarded.** An account with transactions cannot be deleted — only
  archived — because that would corrupt history.

83 tests cover these rules:

```bash
npm test
```

---

## Multi-currency

UGX is the default reporting currency. USD, KES, EUR, GBP, RWF, TZS, ZAR, NGN
and JPY are available; enable the ones you use in Settings.

Totals are grouped per currency and never combined across them. When a record's
currency differs from your reporting currency you can enter your own exchange
rate; the transaction sheet shows both figures — original and converted — before
you save.

---

## Storage and backup

Data lives in IndexedDB via Dexie, in tables for accounts, categories,
transactions, budgets, savings goals, goal contributions, recurring schedules,
preferences and sync metadata. It survives refresh, closing the browser and
working offline.

**Export and import** a complete JSON backup from Settings. The format is
versioned:

```json
{
  "app": "pocket-ledger",
  "schemaVersion": 1,
  "createdAt": "…",
  "revision": 1714467600001,
  "counts": { "transactions": 214 },
  "records": { "accounts": [], "transactions": [] }
}
```

Restoring compares local and backup record-by-record. If both sides changed, you
are asked whether to merge or replace — merging keeps the higher revision of
each record, so **nothing is ever silently dropped**.

---

## Google Drive: designed, not connected

The long-term plan is Google Drive as the persistent cloud backup, in a visible
folder called **"Personal Finance Backups"**, using the narrow `drive.file`
OAuth scope (access limited to files this app creates). Deliberately *not* the
hidden `appDataFolder*, because a hidden folder should not be the only permanent
home for financial records.

The architecture for this is real: `SyncAdapter` is a complete interface, the
Drive adapter implements it honestly (every method reports that it is not
available), conflict detection and record-level merge are implemented and
tested, and the versioned backup format is already in use by local export.

**In this build there is no authentication, no network call, and no simulated
connection.** The Settings screen labels cloud sync plainly as "Not connected"
and the Connect button is disabled. `src/data/sync/adapters.ts` documents the
exact REST endpoints and scope for the future implementation.

---

## PWA

Installable on iOS (Add to Home Screen), Android and desktop.

- Web manifest with shortcuts and maskable icon
- Service worker: app-shell precache, navigation fallback, cache-first assets
- Offline behaviour — open and use with no network
- `viewport-fit=cover` plus `env(safe-area-inset-*)` for the notch and home bar
- Theme colour for both light and dark
- No App Store required

**Note on iOS:** service workers require a secure context. `localhost` works in
desktop Chrome; to get offline support on an iPhone, serve over https (for
example `npx localtunnel --port 5173`) and then Add to Home Screen.

---

## Performance

Code-split by screen so the first paint is small:

| Chunk | Size |
| --- | --- |
| Initial (React, Dexie, router, Home) | ~357 kB |
| Stylesheet | ~44 kB |
| Recharts (Insights only, on demand) | ~435 kB |
| Each other screen | 10–22 kB |

Recharts is the heaviest dependency in the app and only the Insights screen uses
it, so that screen is lazy-loaded. Every chart derives from stored records —
nothing is estimated or fabricated.
