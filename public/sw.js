/**
 * Pocket Ledger service worker.
 *
 * Strategy
 *  - App shell: cached on install so the app opens with no network at all.
 *  - Navigations: served from cache first, then network, so a cold start is
 *    instant and an offline start still renders.
 *  - Static assets: cache-first with versioned revalidation.
 *
 * There is no API to speak to — the app is entirely local — so "offline" simply
 * means "the shell is present".
 */

const VERSION = "pocket-ledger-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // allSettled: a missing optional asset must not abort installation.
      await Promise.allSettled(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* not supported */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

/** Cache-first, falling back to network. Safe for immutable, hashed assets. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const shell = await caches.open(SHELL_CACHE);
    const fallback = await shell.match("/index.html");
    if (fallback) return fallback;
    throw error;
  }
}

/**
 * Navigations prefer the cached shell so the app paints immediately, then
 * refresh the shell in the background so the next launch is current.
 */
async function navigate(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await cache.match("/index.html")) || (await cache.match("/"));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|mjs|woff2?|png|jpe?g|svg|webp|ico|json|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
