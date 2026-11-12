# 01 · Getting started

[← Documentation index](README.md)

## What you need

| Tool | Purpose | Where to get it |
| --- | --- | --- |
| **Node.js** | Runs Vite, tests and build tooling; npm is included | [nodejs.org](https://nodejs.org/) |
| **A modern browser** | Runs the app, IndexedDB and developer tools | Safari, Chrome, Edge or Firefox |

Use **Node.js 22.12 or newer** as the straightforward choice. Vite 8 also supports Node.js 20.19 or newer on the supported 20.x line; see the [Vite 8 release notes](https://vite.dev/blog/announcing-vite8). Check what you installed:

```bash
node --version
npm --version
```

You do **not** need Git, VS Code, PostgreSQL, a `DATABASE_URL`, Firebase, Supabase, a Google API key or a paid service to run the current app. Some environments may contain a legacy `.env` file, but the client-side Vite application does not read it for a financial database.

## Open the project folder

1. Open the `pocket-ledger` project directory in a terminal (any terminal; a code editor is optional).
2. Install the exact dependency versions in the lockfile:

   ```bash
   npm ci
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the URL printed in the terminal, normally `http://localhost:5173`. Keep the terminal running while you use the app. Press `Ctrl+C` in that terminal to stop it.

If the port is in use, Vite can choose a different port; use the URL it prints. **Browser storage is origin-specific**: `localhost:5173` and `localhost:5174` are different origins and can show different data.

## Run a production build locally

```bash
npm run build
npm start
```

`npm run build` writes static assets to `dist/`. `npm start` runs the small Node static server at `http://localhost:3000` by default; set `PORT` to change it. The production server exposes `/api/health`, but this checks the build, **not** IndexedDB or the financial data.

`npm run preview` is Vite's preview server, configured for port 5173; it is separate from `npm start`. Its routes and health behavior are not the same as `server.mjs`.

## Development checks

```bash
npm run typecheck
npm test
npm run build
```

The checks cover TypeScript, the Vitest suite, and the Vite build respectively. They do not by themselves prove that backups, offline operation, or every browser interaction works. See [Development and testing](06-development-and-testing.md).

## First launch and sample records

When the app finds no accounts or transactions and the demo flag is not set, startup attempts to add sample accounts, transactions, budgets, goals and recurring items. Sample IDs contain `_demo_`, but individual rows do not consistently display a demo badge. Resetting demo data currently has data-integrity limitations; read [Known issues](08-known-issues-and-roadmap.md) before mixing real and sample records.

## Your data is separate from your code

A new local origin has its own IndexedDB. Opening the project from a different browser, changing `localhost:5173` to `localhost:3000`, or moving to another computer does **not** copy your financial records. Git commits and `.bundle` files contain source code and history, not the browser database.

JSON export exists, but the current restore validator has a known compatibility problem with exported preference records. Keep the original browser data and any exported JSON files; do not delete the original while restore remains unverified. Details: [Storage, backup and sync](05-storage-backup-and-sync.md).
