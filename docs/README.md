# Pocket Ledger documentation

This guide describes the **current Pocket Ledger implementation**, including what is available, how its parts connect, and what still needs work. It is meant for both the person using the app and someone maintaining the code.

> **Important:** This is an early version, not a complete or independently audited financial system. The current backup importer can reject its own exported files, and some multi-currency paths can produce incorrect figures. Do not rely on the app as the only copy of important financial records. Read [Known issues and roadmap](08-known-issues-and-roadmap.md) before using real data.

## Choose where to start

| If you want to… | Read |
| --- | --- |
| Install the tools and run the app | [01 · Getting started](01-getting-started.md) |
| Understand the screens and everyday actions | [02 · Using Pocket Ledger](02-user-guide.md) |
| Understand how the whole application is connected | [03 · System architecture](03-system-architecture.md) |
| Understand records, money and calculations | [04 · Data model and finance](04-data-model-and-finance.md) |
| Understand local storage, JSON backups and the future Drive adapter | [05 · Storage, backup and sync](05-storage-backup-and-sync.md) |
| Change the code, run tests and work with Git | [06 · Development and testing](06-development-and-testing.md) |
| Understand installation, offline behavior and deployment | [07 · PWA, deployment and security](07-pwa-deployment-security.md) |
| See limitations and proposed next steps | [08 · Known issues and roadmap](08-known-issues-and-roadmap.md) |
| Look up an unfamiliar term or library | [09 · Glossary and references](09-glossary-and-references.md) |

## The short version

1. **Pocket Ledger is a client-side React application** built with Vite and TypeScript. There is no finance API, login, hosted database, or live Google Drive connection in this version.
2. **The browser owns the financial data.** Dexie reads and writes IndexedDB on the current device and browser origin. Changing devices, browsers, hostnames, or ports can mean a different database.
3. **The interface reacts to stored records.** Dexie's live queries load data into React; calculation functions derive balances, summaries, budgets and charts from that data.
4. **A static host delivers the app.** Vite serves it during development; `server.mjs` can serve the production build. That server does not store transactions. Its `/api/health` route only checks that the build exists.
5. **Git history and financial records are separate.** Git tracks source code; browser data stays in IndexedDB. A Git bundle does not transfer your transactions.
6. **Some features are incomplete.** Backup restore, mixed-currency paths, reusable rates, demo reset, and offline coverage have important limitations documented in detail.

## Reading diagrams

The architecture guide uses Mermaid diagrams, which GitHub and many Markdown viewers can render. Each diagram also has a plain-language explanation so a Mermaid extension is optional. Paths in these documents are relative to the repository root unless a Markdown link says otherwise.

## Keeping documentation current

The code is the final source of truth. When changing a data model, screen, calculation, backup format, service worker, or command, update the corresponding guide in the same commit. Record behavior that is not implemented as a limitation, not as a promise.
