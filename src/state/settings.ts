/**
 * Application-level settings.
 *
 * Reads and writes the Dexie `preferences` table through the repository, and
 * applies theme + privacy to the document. Components consume these hooks; none
 * of them touch Dexie directly.
 */

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { PreferenceKey } from "@/db/schema";
import { DEFAULT_CURRENCY, DEFAULT_ENABLED } from "@/lib/currency";

export type ThemePreference = "light" | "dark" | "system";

function useStored<T>(key: PreferenceKey, fallback: T): [T, (value: T) => void, boolean] {
  const [local, setLocal] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  const stored = useLiveQuery(async () => {
    const row = await db.preferences.get(key);
    return (row?.value as T | undefined) ?? fallback;
  }, [key, fallback]);

  useEffect(() => {
    if (stored !== undefined) {
      setLocal(stored);
      setReady(true);
    }
  }, [stored]);

  const update = (value: T) => {
    setLocal(value);
    void db.preferences.put({ key, value, updatedAt: new Date().toISOString() });
  };

  return [local, update, ready];
}

export function useTheme(): [ThemePreference, (t: ThemePreference) => void] {
  const [theme, setTheme] = useStored<ThemePreference>("theme", "system");

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.theme = resolved;
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  /**
   * The theme is also written to localStorage, because index.html runs a
   * pre-paint script that reads it. Without this mirror the two sources disagree
   * and you get a flash of the wrong theme on reload.
   */
  const setThemePref = (value: ThemePreference) => {
    setTheme(value);
    try {
      window.localStorage.setItem("pocket-ledger-theme", value);
    } catch {
      /* storage may be unavailable; Dexie remains the source of truth */
    }
  };

  return [theme, setThemePref];
}

export function usePrivacyToggle(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useStored<boolean>("hideAmounts", false);
  return [value, setValue];
}

export function useReportingCurrency(): [string, (code: string) => void] {
  const [value, setValue] = useStored<string>("reportingCurrency", DEFAULT_CURRENCY);
  return [value, setValue];
}

export function useEnabledCurrencies(): [string[], (list: string[]) => void] {
  const [value, setValue] = useStored<string[]>("enabledCurrencies", DEFAULT_ENABLED);
  return [value, setValue];
}

/**
 * Manual exchange rates, keyed "FROM_TO".
 * The user enters these by hand; nothing is fetched from a rate service, so a
 * converted figure is always the user's own decision.
 */
export function useExchangeRates(): [Record<string, number>, (rates: Record<string, number>) => void] {
  const [value, setValue] = useStored<Record<string, number>>("rates", {});
  return [value, setValue];
}

export function rateKey(from: string, to: string): string {
  return `${from}_${to}`;
}
