# 07 · PWA, deployment and security

[← Documentation index](README.md)

## PWA pieces

| File | Purpose |
| --- | --- |
| `public/manifest.webmanifest` | Name, short name, start URL, display mode, theme colors, icons and shortcuts |
| `public/icons/` | SVG, PNG, maskable and Apple touch icons |
| `index.html` | Manifest link, viewport/safe-area settings and Apple web-app metadata |
| `src/pwa/registerSW.ts` | Registers the worker after page load on HTTPS or localhost |
| `public/sw.js` | Versioned shell and asset caches, fetch handling |
| `src/app.css` | Safe-area, responsive and theme utilities |

A PWA is still a website delivered as HTML/CSS/JavaScript. Installing it adds a launcher and standalone window; it does not install a cloud database or move records between devices.

## Current cache behavior

`public/sw.js` uses the cache prefix `pocket-ledger-v1`:

- On install it attempts to cache `/`, `/index.html`, the manifest and the SVG icon. `Promise.allSettled` means an individual failed item does not fail installation.
- For navigation requests, the implementation tries the **network first**, updates cached `/index.html` on success, and falls back to the cached shell on failure. Some comments in the file describe a different order; the code is authoritative.
- For same-origin GET requests under `/assets/`, `/icons/`, and matching asset extensions, it checks the asset cache first and then fetches and caches successful responses.
- For an uncached asset when offline, the current fallback may return the HTML shell rather than the requested CSS/JS. That is not a reliable asset response and needs improvement.

**Offline is not guaranteed for every screen.** The install list does not pre-cache every hashed Vite asset or lazy-loaded screen chunk. The worker registers after page load, so first-load assets may not all pass through it; browser HTTP caching may also affect the result. Test a production build on each target browser and visit required screens online after the worker controls the page. Do not promise a fresh offline install will have all screens available.

The cache version is a manually defined string. A deployment that changes assets should review worker/version behavior and test upgrades. On activation the worker deletes caches whose names do not start with its version prefix, so a dedicated app origin is safer than sharing an origin with unrelated applications.

## Test a production-like build

1. Run `npm run build`, then `npm start` and open `http://localhost:3000`.
2. In browser DevTools, confirm that the service worker is installed and controlling the page. Reload after installation and visit the screens you want to test while online.
3. Enable the **Network → Offline** simulation, reload and navigate. Record any missing assets or lazy-loaded screens.
4. Return online and repeat after an app update. Test independently in Safari/iOS; a desktop Chromium result is not proof of iOS behavior.

`localhost` is generally treated as a secure context for service workers. A plain HTTP LAN address on a phone is not equivalent to localhost on that phone. Use a trusted HTTPS origin for PWA/service-worker testing from another device.

**Do not use “Clear site data” on a real ledger as a cache troubleshooting step.** It may also delete IndexedDB. If only a worker must be tested, use the browser's service-worker controls and retain the database; even then, preserve the original browser and an independent record of important data.

## Install on iPhone or iPad

Open the app in Safari from a suitable HTTPS origin, tap **Share → Add to Home Screen**, then launch the new icon. Exact Safari wording can vary by iOS version. This does not make Google Drive sync available. Verify storage and offline behavior on the actual device before depending on it.

## Deploy static assets

1. Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`.
2. Deploy `dist/` to a static host with HTTPS, or use the included `server.mjs` via `npm start`.
3. Ensure the manifest, service worker, icons and `/assets/` are served from the app origin with appropriate MIME types.
4. Test navigation, installation, offline behavior, upgrades, and data migration on the deployed origin. Hash routes do not require server-side route handlers for each screen.

`server.mjs` defaults to port 3000 and responds at `/api/health` with build/uptime information. It does not inspect the user's browser database and must not be mistaken for a financial-data API or backup service.

The Vite build copies the contents of `public/` into `dist/`, including **ignored** files. A one-off Git export created with `node scripts/export-git-bundle.mjs --preview` is publicly downloadable from `/downloads/` if it remains there at build time. Remove such preview bundles before deploying if you do not intend to expose the repository history. A random filename is not authentication.

## Security and privacy boundaries

- There is no app login, authorization, encryption of IndexedDB records, or encrypted JSON export. Anyone with access to the same browser profile/device may be able to read the data.
- A malicious browser extension, compromised static host, injected script or device malware could potentially access browser data. Serve only trusted builds over HTTPS and follow standard dependency, XSS and access-control practices.
- The eye toggle is not a security feature and does not mask every directly formatted value or chart.
- Do not commit `.env`, tokens, financial exports, or generated Git bundles. Review full Git history before publishing a repository; ignored files are excluded from future commits but do not erase earlier committed content.
- No app code currently sends records to Google Drive. The proposed Drive permission and authentication are future work, not active protections.

See [MDN: Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps), [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), and [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
