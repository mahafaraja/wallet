# Pocket Ledger

Pocket Ledger is an early, client-side personal finance app for tracking accounts, transactions, budgets, savings goals and insights. It is built with React, TypeScript and Vite. Financial records live in the current browser's IndexedDB; Google Drive backup is available for cloud sync across devices.

> **Important:** This version is a prototype. Its JSON restore can reject exported preference records, and some multi-currency calculations and transfers are not yet safe. Keep an independent copy of important records and read [Known issues and roadmap](docs/08-known-issues-and-roadmap.md) before relying on it.

## Documentation

Start at the [documentation index](docs/README.md), or jump to a guide:

1. [Getting started](docs/01-getting-started.md) — tools, installation and local commands.
2. [User guide](docs/02-user-guide.md) — screens, transactions, accounts, budgets and goals.
3. [System architecture](docs/03-system-architecture.md) — context, components, diagrams and data flow.
4. [Data model and finance](docs/04-data-model-and-finance.md) — IndexedDB stores, relationships, amounts and formulas.
5. [Storage, backup and sync](docs/05-storage-backup-and-sync.md) — origin-scoped data, JSON, current restore limitations and the future Drive adapter.
6. [Development and testing](docs/06-development-and-testing.md) — source map, dependencies, Git and tests.
7. [PWA, deployment and security](docs/07-pwa-deployment-security.md) — service-worker behavior, hosting and privacy boundaries.
8. [Known issues and roadmap](docs/08-known-issues-and-roadmap.md) — current risks and suggested priorities.
9. [Glossary and references](docs/09-glossary-and-references.md) — plain-language terms and official documentation.

## Quick start

You need **Node.js 22.12 or newer** (npm is included) and a modern browser (Chrome, Edge, Safari or Firefox). Git and a code editor are optional—you do not need them to run the app.

1. Open the project folder in a terminal.
2. Install the exact dependency versions in the lockfile:

   ```bash
   npm ci
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the URL printed in the terminal, normally `http://localhost:5173`. Keep the terminal running while you use the app. Press `Ctrl+C` to stop it.

No PostgreSQL instance, `DATABASE_URL` or external API credentials are required.

### Other commands

```bash
npm run typecheck    # TypeScript check
npm test             # Vitest unit tests
npm run build        # static production build in dist/
npm run preview      # Vite preview
npm start            # serve dist/ with server.mjs, normally on port 3000
```

The dev and production ports are different browser origins and therefore normally use separate IndexedDB data. A clean origin can be seeded with sample records; individual sample rows are not consistently labeled in the UI. Demo reset has known data-preservation issues, so avoid it after entering real data until fixed.

## What the app currently does

- **Home / navigation:** overview, accounts, budget summary, recent activity and upcoming sample schedules. Phones use a bottom bar; iPads, tablets and desktops use a sidebar from 768 CSS pixels.
- **Transactions and accounts:** manually record income, expenses and transfers, search and filter activity, and derive account balances from records. There is no bank or mobile-money integration.
- **Budgets and goals:** track category caps and goal contributions. Historical budget versions, goal withdrawal guards and some edit controls still need work.
- **Insights:** Recharts visualizations based on stored data. Monthly income/spending excludes transfers; other mixed-currency aggregates have known gaps.
- **PWA:** manifest, icons and service worker are present. Offline operation depends on which assets are cached and is not guaranteed for every fresh install or lazy-loaded screen.
- **Backup and sync:** JSON export and restore exist. Google Drive backup is available — connect your Google account in Settings to keep versioned backups in a visible "Personal Finance Backups" folder in your own Drive. Uses the narrow `drive.file` scope (access limited to files this app creates).

See the [user guide](docs/02-user-guide.md) for workflows and the [issue register](docs/08-known-issues-and-roadmap.md) for the limitations that matter most.

## How it is connected

```text
Person → browser / installed PWA → React screens and forms
                                  ↓
                         validation + finance functions
                                  ↓
                      Dexie / browser IndexedDB records
                                  ↑
                    useLiveQuery refreshes screen data
```

`index.html` loads `src/main.tsx`, which mounts `src/App.tsx`. The app selects screens through a hash router, reads records through Dexie live queries, and passes data into components and calculation helpers. Most mutations live in `src/data/repository.ts`; `App.tsx`, preference hooks, quick-add, demo seed and backup code also access Dexie directly. The service worker caches application resources separately from the financial database.

`server.mjs` is an optional static production server. Its `/api/health` reports build availability and uptime, not IndexedDB or financial-data health. For a component map, route table and sequence diagram, see [System architecture](docs/03-system-architecture.md).

## Data and privacy

- Financial records are stored in IndexedDB for the current browser origin. A new browser, device, host, or port can have a different database.
- Clearing site data, private browsing, device loss or storage eviction can remove local records. This is not cloud backup.
- JSON exports are not encrypted. The current importer can reject an export containing keyed preference records; retain the original browser data and exported files until a verified recovery path exists.
- The eye control masks values rendered with the shared `Money` component, but it does not mask every directly formatted value or chart. It is not access control or encryption.
- Google Drive backup is optional and uses the narrow `drive.file` OAuth scope. The app only accesses backup files it creates in a visible "Personal Finance Backups" folder. Backups are plain JSON and are **not encrypted** by the app.

For details, see [Storage, backup and sync](docs/05-storage-backup-and-sync.md) and [PWA, deployment and security](docs/07-pwa-deployment-security.md).

## Project layout

```text
src/              Application source: screens, components, data, lib, state, db, design
public/           PWA manifest, service worker and icons
docs/             Product, architecture and developer guides
scripts/          Git bundle export utility
index.html        Entry HTML and PWA metadata
server.mjs        Optional static production server
package.json      Dependencies and scripts
```

The interface uses semantic light/dark tokens, the platform font stack with Inter Variable as a fallback, and Lucide React icons. See [Glossary and references](docs/09-glossary-and-references.md) for the tools and their official documentation.
