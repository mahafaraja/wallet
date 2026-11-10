# 09 · Glossary and references

[← Documentation index](README.md)

## Product and finance terms

| Term | Meaning in Pocket Ledger |
| --- | --- |
| **Account** | A recorded location for money, such as cash, mobile money or a bank account. It is not connected to a real bank. |
| **Transaction** | A stored income, expense or transfer record. This is different from an IndexedDB transaction, which groups database writes. |
| **Opening balance** | The amount initially recorded in an account. Current balance is calculated from it and subsequent records. |
| **Transfer** | A movement between recorded accounts. Monthly income/spending calculations exclude it. Cross-currency transfers are currently unsafe. |
| **Category** | A label such as Groceries or Salary used to group records and budgets. |
| **Budget** | A stored category cap and its starting month; the current app does not retain separate historical versions when edited. |
| **Savings goal** | A target amount, currency and optional date, plus a history of signed contributions. It is not a bank account. |
| **Contribution** | A positive or negative record associated with a goal. With an account selected, this app also creates an expense/income transaction. |
| **Minor unit** | The integer unit in which an amount is stored. In the app's configuration, 1 USD = 100 minor units; UGX has no fractional unit. |
| **Reporting currency** | The currency used for some summaries and charts. Foreign records need an appropriate stored conversion to appear in those summaries. |
| **Exchange rate** | A number supplied by the user for converting one currency into another. No live-rate provider is connected. |
| **Net** | For monthly reports, included income minus included expenses; transfers are excluded. |
| **Rounding** | Mapping a calculated value to an allowed precision. Current conversions use JavaScript numbers and need additional boundary tests. |

## Application architecture terms

| Term | Meaning |
| --- | --- |
| **React component** | A reusable function that describes part of the interface based on props and state. |
| **SPA** | Single-page application: the browser loads an app shell and React changes screens without full server-rendered pages. |
| **Hash route** | A URL fragment such as `#/activity`; this app uses it to choose a screen. |
| **IndexedDB** | A browser-managed structured database. Pocket Ledger's database is named `pocket-ledger`. |
| **Dexie** | A JavaScript library wrapping IndexedDB with a higher-level API. |
| **`useLiveQuery`** | A Dexie React hook that re-runs an observed query and updates the UI when relevant data changes. |
| **Repository** | A layer of functions for reading/writing records. This codebase has one, but some other modules still access Dexie directly. |
| **Origin** | Scheme + host + port, such as `http://localhost:5173`. Different origins normally have separate browser storage. |
| **Schema / migration** | The defined stores and record/index structure; a migration moves existing data safely to a newer structure. |
| **UUID / ID** | Identifier used to reference a record. IDs are not a substitute for enforcing relationships. |
| **Revision** | A numeric per-record change marker in this code. Current values rely on local time and are not a proven distributed clock. |
| **PWA** | A web app with installation and other platform capabilities, usually using a manifest and service worker. |
| **Manifest** | JSON metadata describing the PWA's name, launch behavior and icons. |
| **Service worker** | A browser-managed background script that can intercept requests and cache app resources. It is not the ledger database. |
| **Cache Storage** | Browser storage for request/response pairs such as app assets; separate from IndexedDB records. |
| **Static server** | A process that serves built files. The included server does not handle financial records. |
| **API** | An interface for software interaction. `/api/health` is only a build/uptime check in the included server. |
| **JSON** | A text format used by the current export envelope. Exported files are not encrypted. |
| **Sync adapter** | An interface for a possible backup destination. The Drive adapter is currently a disconnected stub. |
| **Authentication** | Establishing an identity; not implemented in the current app. |
| **Authorization** | Permission to access a resource, such as a user's Drive file; also not implemented. |

## Development and Git terms

| Term | Meaning |
| --- | --- |
| **Node.js** | Runtime used for Vite, the included production server and development scripts—not where the user's IndexedDB runs. |
| **npm** | Package manager used to install dependencies and run project scripts. |
| **`npm ci`** | Installs dependencies using the lockfile; useful for a reproducible clean setup. |
| **Vite** | Tool that serves the app in development and bundles it for production. |
| **TypeScript** | JavaScript with static type checking; types do not by themselves validate data at runtime. |
| **Tailwind CSS** | Utility-class styling system; semantic values are defined in `src/app.css`. |
| **Lucide / Recharts / date-fns** | Libraries for icons, charts and date operations respectively. |
| **Vitest** | Test runner used for the existing unit suite. |
| **Commit** | A snapshot of tracked source code in Git history. It does not include the browser database. |
| **Branch** | A movable reference to a line of commits. The exported workspace currently uses `master`. |
| **Remote** | A named Git repository location, such as a GitHub repository. A bundle file is readable but cannot receive pushes. |
| **Git bundle** | A portable file containing committed Git objects and refs; it is a snapshot, not an ongoing connection. |
| **Fast-forward merge** | Moves a branch forward when its current commit is an ancestor of the incoming one. `--ff-only` refuses a divergent merge. |
| **ARIA** | Accessibility attributes that help assistive technologies understand roles, labels and states. |

## Official references

- [React documentation](https://react.dev/learn)
- [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vite guide](https://vite.dev/guide/) and [Vite 8 Node requirements](https://vite.dev/blog/announcing-vite8)
- [Tailwind CSS documentation](https://tailwindcss.com/docs)
- [Dexie TypeScript and React examples](https://dexie.org/docs/Typescript)
- [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN: Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [MDN: Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [Lucide React](https://lucide.dev/guide/packages/lucide-react)
- [Recharts](https://recharts.github.io/en-US/)
- [date-fns](https://date-fns.org/)
- [Vitest guide](https://vitest.dev/guide/)
- [Git bundle documentation](https://git-scm.com/docs/git-bundle)
- [VS Code: view source control history](https://code.visualstudio.com/docs/sourcecontrol/history)
