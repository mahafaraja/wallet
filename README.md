# Pocket Ledger

Pocket Ledger is an early, client-side personal finance app for tracking accounts, transactions, budgets, savings goals and insights. It is built with React, TypeScript and Vite. Financial records live in the current browser's IndexedDB; there is no finance backend, bank connection, login or live Google Drive sync.

> **Important:** This version is a prototype. Its JSON restore can reject exported preference records, and some multi-currency calculations and transfers are not yet safe. Keep an independent copy of important records and read [Known issues and roadmap](docs/08-known-issues-and-roadmap.md) before relying on it.

## Documentation

Start at the [documentation index](docs/README.md), or jump to a guide:

1. [Getting started](docs/01-getting-started.md) — tools, installation, VS Code and local commands.
2. [User guide](docs/02-user-guide.md) — screens, transactions, accounts, budgets and goals.
3. [System architecture](docs/03-system-architecture.md) — context, components, diagrams and data flow.
4. [Data model and finance](docs/04-data-model-and-finance.md) — IndexedDB stores, relationships, amounts and formulas.
5. [Storage, backup and sync](docs/05-storage-backup-and-sync.md) — origin-scoped data, JSON, current restore limitations and the future Drive adapter.
6. [Development and testing](docs/06-development-and-testing.md) — source map, dependencies, Git and tests.
7. [PWA, deployment and security](docs/07-pwa-deployment-security.md) — service-worker behavior, hosting and privacy boundaries.
8. [Known issues and roadmap](docs/08-known-issues-and-roadmap.md) — current risks and suggested priorities.
9. [Glossary and references](docs/09-glossary-and-references.md) — plain-language terms and official documentation.

## Quick start

Install Git, Node.js 22.12 or newer, npm and a modern browser. Open the project folder in VS Code and run:

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. Keep the terminal running while using the app. No PostgreSQL instance, `DATABASE_URL` or external API credentials are required.

Other commands:

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
- **Backup and sync:** JSON export and a restore UI exist, but restore has a known validation mismatch. The Google Drive adapter is a disabled design stub—not a connected service.

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

## Source code, Git and VS Code

Git tracks the project source and commit history—not your browser's IndexedDB. If you received a `.bundle` file, create a new local copy from it:

```bash
git clone "$HOME/Downloads/<downloaded-file>.bundle" pocket-ledger
cd pocket-ledger
git remote remove origin
npm ci
npm run dev
```

Replace `<downloaded-file>` with the actual filename. On Windows, use PowerShell or Git Bash. Then open the `pocket-ledger` folder in VS Code with **File → Open Folder**. Removing `origin` disconnects the read-only bundle file; it does not delete your commits.

In VS Code, **Source Control → Graph** shows commits; **Changes** shows only uncommitted edits. To inspect history in a terminal:

```bash
git status -sb
git --no-pager log --all --oneline --decorate -40
```

To create a private GitHub repository, run **Publish to GitHub** from the VS Code Command Palette and sign in locally. For an existing repository, use **Git: Add Remote** and then push. A bundle is a snapshot, not a live connection between this workspace and your computer.

If you receive an updated bundle, fetch and inspect it without changing your working files:

```bash
git fetch --no-tags "$HOME/Downloads/<downloaded-file>.bundle" refs/heads/master
git --no-pager log --oneline HEAD..FETCH_HEAD
```

Only with a clean working tree and a shared history, `git merge --ff-only FETCH_HEAD` moves the branch forward. It refuses a divergent fast-forward instead of discarding local commits. Back up or commit local edits before merging; do not force-push or reset as a recovery shortcut.

Git history in this repository began after the older Stash/Next.js prototype was replaced, so that earlier prototype is not available as separate commits. See [Getting started](docs/01-getting-started.md) and [Development and testing](docs/06-development-and-testing.md).

## Data and privacy

- Financial records are stored in IndexedDB for the current browser origin. A new browser, device, host, or port can have a different database.
- Clearing site data, private browsing, device loss or storage eviction can remove local records. This is not cloud backup.
- JSON exports are not encrypted. The current importer can reject an export containing keyed preference records; retain the original browser data and exported files until a verified recovery path exists.
- The eye control masks values rendered with the shared `Money` component, but it does not mask every directly formatted value or chart. It is not access control or encryption.
- Google Drive, authentication and automatic synchronization are not implemented. The current app does not request Drive access.

For details, see [Storage, backup and sync](docs/05-storage-backup-and-sync.md) and [PWA, deployment and security](docs/07-pwa-deployment-security.md).

## Project layout

```text
src/App.tsx                  Screen composition and Dexie subscriptions
src/screens/                 Product screens
src/components/              Shared UI, navigation and transaction components
src/db/                      Dexie database declaration and record types
src/data/                    CRUD, sample data and backup/sync scaffolding
src/lib/                     Money, currency, finance, dates and validation
src/state/                   Hash router and preference hooks
src/design/ and src/app.css  Icons, typography, theme and design tokens
public/                      PWA manifest, worker and icons
scripts/                     Git bundle export utility
docs/                        Product, architecture and developer guides
```

The interface uses semantic light/dark tokens, the platform font stack with Inter Variable as a fallback, and Lucide React icons. See [Glossary and references](docs/09-glossary-and-references.md) for the tools and their official documentation.
