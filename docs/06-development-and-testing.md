# 06 · Development and testing

[← Documentation index](README.md)

## Stack and why each tool is here

Versions are defined in `package.json` and pinned by `package-lock.json`. Use the lockfile, not this table, as the exact version source.

| Tool | Role in this project |
| --- | --- |
| Node.js + npm | Run Vite, the static server and the test runner; install packages |
| React 19 | Render screens and manage component state |
| TypeScript 5 | Describe record shapes, component props and compile-time constraints |
| Vite 8 | Development server, bundling and code splitting |
| Tailwind CSS 4 | Utility styling and CSS theme integration through `@tailwindcss/vite` |
| Dexie + `dexie-react-hooks` | IndexedDB wrapper and reactive queries |
| date-fns | Date formatting and calendar calculations |
| Recharts | Insights charts |
| Lucide React | Interface icons |
| Inter Variable | Open-licensed fallback font when the platform system font is unavailable |
| Vitest | Unit tests for calculations and navigation markup |
| Git | Source control and `.bundle` exports; it is not the app database |

There is no Next.js runtime, Drizzle, PostgreSQL, Firebase or Supabase dependency in this Vite app. Existing Next.js references in old conversation history or an unrelated `.env` file do not describe the current stack.

## Common commands

Run these from the repository root:

```bash
npm ci              # install exactly from the lockfile
npm run dev         # Vite development server; URL is printed in terminal
npm run typecheck   # TypeScript, no output files
npm test            # Vitest unit suite
npm run build       # production assets in dist/
npm run preview     # Vite's preview server
npm start           # Node static server for dist/, default port 3000
```

The `@/` import alias maps to `src/` in both `tsconfig.json` and `vite.config.ts`. If you add an alias or change module resolution, update both places.

## Where to make a change

| Change | Start here | Also inspect |
| --- | --- | --- |
| A screen's layout or behavior | `src/screens/<Screen>.tsx` | shared components and `App.tsx` props |
| Shared controls or modals | `src/components/ui/` | keyboard, mobile safe areas, dark theme |
| Navigation or breakpoints | `src/components/nav/` | `src/state/router.ts`, `Nav.test.tsx` |
| Transaction validation | `src/lib/validate.ts` | `TransactionSheet.tsx`, money tests, repository |
| Finance formulas | `src/lib/finance.ts` | `finance.test.ts`, affected screens |
| Currency precision / formatting | `src/lib/currency.ts`, `money.ts` | existing data migration and rounding tests |
| Record shape | `src/db/schema.ts` | `database.ts` version/index migration and backup compatibility |
| Local CRUD | `src/data/repository.ts` | direct Dexie reads elsewhere; tests and sync behavior |
| Demo data | `src/data/seed.ts` | real-data preservation and `SettingsScreen.tsx` |
| Backup | `src/data/sync/` | schema validation, round-trip tests, conflict UI |
| PWA assets | `public/manifest.webmanifest`, `public/sw.js` | `src/pwa/registerSW.ts`, offline tests and cache version |
| Theme / typography | `src/app.css`, `src/design/` | light/dark contrast and responsive components |

**Current architecture note:** `App.tsx`, settings hooks, the quick-add component, seed code and backup codec also touch Dexie directly. The repository is not yet a strict exclusive boundary despite some source comments saying so.

## Test coverage today

The existing suite has:

- `src/lib/money.test.ts`: parsing, minor-unit arithmetic, splits, ratios and percentages.
- `src/lib/finance.test.ts`: monthly totals, account calculations, conversions, budget and goal calculations, date and formatting helpers.
- `src/components/nav/Nav.test.tsx`: rendered navigation markup, breakpoint classes and active states.

The tests are valuable but do **not** cover the full browser UI, IndexedDB transaction behavior, JSON export→import, multi-device conflicts, offline startup or all currency combinations. In particular, a passing suite does not mean restore or cross-currency transfers are safe. Add regression tests for the issue being changed, including failure and data-preservation cases.

### Suggested manual smoke test after changes

Use disposable sample data:

1. Load Home and navigate to each main screen at phone, tablet and desktop widths.
2. Add, edit and delete a test transaction in one currency; inspect its account balance and the relevant monthly totals.
3. Test same-currency transfer calculations and confirm monthly income/spending does not include them.
4. Check validation, keyboard access, dark theme and safe-area spacing.
5. For changes to backup/offline behavior, test a full export→restore round trip and offline launch in separate browser profiles; do not use irreplaceable records.

## Inspect browser data

In Chromium-based browser DevTools, open **Application → Storage → IndexedDB → pocket-ledger** to inspect stores. Safari's Web Inspector has corresponding storage tools. Read-only inspection is preferable; editing or clearing data directly bypasses application validation and can cause loss.

The service-worker registration and caches are visible separately in DevTools. Unregistering a service worker is not the same as deleting IndexedDB; **Clear site data** can delete both.

## Git workflow

Make changes in a branch, run the checks, review the diff, then create a small commit. VS Code's Source Control **Changes** panel shows uncommitted edits; **Graph** shows commits. `git log --oneline --all` works in a terminal.

The source repository does not automatically share financial data or connect this workspace to GitHub. If the workspace has no remote, a Git bundle is a snapshot, not a live sync. `node scripts/export-git-bundle.mjs` creates an ignored local bundle after all changes are committed; `--preview` puts a copy under `public/downloads/`, where anyone with the URL can retrieve the committed source history. Remove preview exports before public deployment if they are not intended to be shared.

## Adding a Dexie schema migration

1. Preserve existing data and capture a verified test fixture.
2. Define a new `this.version(n).stores(...)` in `src/db/database.ts`; add an upgrade function if existing rows need conversion.
3. Update types in `src/db/schema.ts`, reads/writes, calculations and backup schema handling together.
4. Test upgrade from a database at the previous version, including interrupted/failed migrations and rollback behavior.
5. Test export and import against old and new versions before release.

Do not reset or delete a real user's database as a migration shortcut. The current app has only version 1, and its backup import needs work before it can be considered a reliable recovery mechanism.
