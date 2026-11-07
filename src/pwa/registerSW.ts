/**
 * Service-worker registration.
 *
 * Waits for the page to finish loading so registration never competes with the
 * first render. Failures are logged and swallowed — offline support is a
 * progressive enhancement, never a hard requirement.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isSecure =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecure) {
    // Service workers require a secure context. Inform the developer, not the user.
    console.info("[Pocket Ledger] Service worker skipped: not a secure context.");
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Check for an updated worker on each returning tab.
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[Pocket Ledger] A new version is ready. Reload to apply it.");
            }
          });
        });
      })
      .catch((error) => {
        console.warn("[Pocket Ledger] Service worker registration failed:", error);
      });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
