/**
 * Minimal hash router.
 *
 * Gives real URLs (so refresh, deep links and the browser back button all work)
 * without pulling in a router dependency. Screens are a flat string namespace
 * plus an optional id — enough for this app's shape.
 */

import { useCallback, useEffect, useState } from "react";

export type RouteName =
  | "home"
  | "activity"
  | "budgets"
  | "goals"
  | "insights"
  | "settings"
  | "accounts"
  | "account"
  | "goal"
  | "categories";

export type Route = {
  name: RouteName;
  id?: string;
  /** Query params, decoded. */
  params: Record<string, string>;
};

const TAB_ROUTES: RouteName[] = ["home", "activity", "budgets", "goals", "insights"];

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const head = (segments[0] ?? "home") as RouteName;

  const params: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      const [k, v = ""] = pair.split("=");
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }

  const name: RouteName = TAB_ROUTES.includes(head) || head === "settings" || head === "accounts" || head === "account" || head === "goal" || head === "categories"
    ? head
    : "home";

  return { name, id: segments[1], params };
}

function currentRoute(): Route {
  return parse(window.location.hash);
}

export function navigate(path: string, opts?: { replace?: boolean }) {
  const target = `#${path.startsWith("/") ? path : `/${path}`}`;
  if (opts?.replace) {
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = target;
  }
}

export function goBack(fallback = "/") {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined" ? { name: "home", params: {} } : currentRoute(),
  );

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

/** Convenience: navigate back to a tab after a sheet closes. */
export function useDismissTo(fallback: string) {
  return useCallback(() => {
    if (window.history.length > 1 && window.location.hash !== `#${fallback}`) {
      window.history.back();
    } else {
      navigate(fallback, { replace: true });
    }
  }, [fallback]);
}

export function isTabRoute(name: RouteName): boolean {
  return TAB_ROUTES.includes(name);
}
