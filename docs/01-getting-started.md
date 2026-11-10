# 01 · Getting started

[← Documentation index](README.md)

## What you need

| Tool | Purpose | Where to get it |
| --- | --- | --- |
| **Git** | Clone the repository and review its commits | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **Node.js** | Runs Vite, tests and build tooling | [nodejs.org](https://nodejs.org/) |
| **npm** | Installs the packages in `package-lock.json`; included with Node | Installed with Node |
| **VS Code** | Edit the project and use its integrated terminal | [code.visualstudio.com](https://code.visualstudio.com/) |
| **A modern browser** | Runs the app, IndexedDB and developer tools | Safari, Chrome, Edge or Firefox |

Use **Node.js 22.12 or newer** as the straightforward choice. Vite 8 also supports Node.js 20.19 or newer on the supported 20.x line; see the [Vite 8 release notes](https://vite.dev/blog/announcing-vite8). Check what you installed:

```bash
node --version
npm --version
git --version
```

You do **not** need PostgreSQL, a `DATABASE_URL`, Firebase, Supabase, a Google API key or a paid service to run the current app. Some environments may contain a legacy `.env` file, but the client-side Vite application does not read it for a financial database.

## Open the existing local copy

1. In VS Code choose **File → Open Folder** and select the actual `pocket-ledger` project directory—not its parent folder and not the `.bundle` file.
2. Open **Terminal → New Terminal**. The terminal should start in the project directory, where `package.json` exists.
3. Install the exact dependency versions in the lockfile:

```bash
npm ci
```

4. Start the development server:

```bash
npm run dev
```

5. Open the URL printed in the terminal, normally `http://localhost:5173`. Keep the terminal running while you use the app. Press `Ctrl+C` in that terminal to stop it.

If the port is in use, Vite can choose a different port; use the URL it prints. **Browser storage is origin-specific**: `localhost:5173` and `localhost:5174` are different origins and can show different data.

## Get the project from a Git bundle

A `.bundle` is a snapshot of committed Git history, not a live repository server. Download the bundle supplied with the project and, from a terminal in the directory where you want a new folder, run:

```bash
git clone "$HOME/Downloads/<downloaded-file>.bundle" pocket-ledger
cd pocket-ledger
git remote remove origin
npm ci
npm run dev
```

Replace `<downloaded-file>` with the actual name. In Windows, use PowerShell or Git Bash. `git remote remove origin` removes the read-only bundle as a remote; it does not delete commits. Open this new `pocket-ledger` directory in VS Code.

To check history without changing files:

```bash
git status -sb
git --no-pager log --all --oneline --decorate -40
```

In VS Code, **Source Control → Graph** shows commits. **Changes** shows only files modified since the current commit. See the root [README](../README.md) for publishing to GitHub and safely fetching another bundle.

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
