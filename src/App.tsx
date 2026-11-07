import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Account, Budget, Category, GoalContribution, RecurringTransaction, SavingsGoal, Transaction } from "@/db/schema";
import { HomeScreen } from "@/screens/HomeScreen";
const ActivityScreen = lazy(() => import("@/screens/ActivityScreen").then((m) => ({ default: m.ActivityScreen })));
const BudgetsScreen = lazy(() => import("@/screens/BudgetsScreen").then((m) => ({ default: m.BudgetsScreen })));
const GoalsScreen = lazy(() => import("@/screens/GoalsScreen").then((m) => ({ default: m.GoalsScreen })));
const GoalDetailScreen = lazy(() => import("@/screens/GoalsScreen").then((m) => ({ default: m.GoalDetailScreen })));
// Recharts is the heaviest dependency in the app and only Insights needs it,
// so that screen is code-split and loaded on demand.
const InsightsScreen = lazy(() =>
  import("@/screens/InsightsScreen").then((m) => ({ default: m.InsightsScreen })),
);
const AccountsScreen = lazy(() => import("@/screens/AccountsScreen").then((m) => ({ default: m.AccountsScreen })));
const AccountDetailScreen = lazy(() => import("@/screens/AccountsScreen").then((m) => ({ default: m.AccountDetailScreen })));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
import { LoadingScreen, ToastProvider } from "@/components/ui/feedback";
import { PrivacyProvider } from "@/components/Money";
import { QuickAddFab } from "@/components/nav/QuickAdd";
import { goBack, navigate, useRoute } from "@/state/router";
import {
  useEnabledCurrencies,
  usePrivacyToggle,
  useReportingCurrency,
  useTheme,
} from "@/state/settings";
import { hasAnyData, seedDemoData } from "@/data/seed";

/**
 * Root component. Owns nothing but composition: data arrives through live
 * queries, settings through their hooks, and each screen stays independent.
 */
export function App() {
  const route = useRoute();

  const [theme, setTheme] = useTheme();
  const [hidden] = usePrivacyToggle();
  const [reportingCurrency, setReportingCurrency] = useReportingCurrency();
  const [enabledCurrencies, setEnabledCurrencies] = useEnabledCurrencies();
  const [ready, setReady] = useState(false);

  // Seed demo data exactly once, and only on a genuinely empty database.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!(await hasAnyData())) await seedDemoData(false);
      } catch {
        // A failed seed must never block the app from opening.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accounts = useLiveQuery(() => db.accounts.toArray(), [], undefined as Account[] | undefined);
  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined as Category[] | undefined);
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], undefined as Transaction[] | undefined);
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], undefined as Budget[] | undefined);
  const goals = useLiveQuery(() => db.goals.toArray(), [], undefined as SavingsGoal[] | undefined);
  const contributions = useLiveQuery(
    () => db.goalContributions.toArray(),
    [],
    undefined as GoalContribution[] | undefined,
  );
  const recurring = useLiveQuery(
    () => db.recurring.toArray(),
    [],
    undefined as RecurringTransaction[] | undefined,
  );

  const dataReady =
    ready &&
    accounts !== undefined &&
    categories !== undefined &&
    transactions !== undefined &&
    budgets !== undefined &&
    goals !== undefined &&
    contributions !== undefined &&
    recurring !== undefined;

  const sortedAccounts = useMemo(
    () => (accounts ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [accounts],
  );

  const isDemo = useMemo(
    () => (transactions ?? []).some((t) => t.id.startsWith("txn_demo_")),
    [transactions],
  );

  const counts = useMemo(
    () => ({
      accounts: accounts?.length ?? 0,
      transactions: transactions?.length ?? 0,
      goals: goals?.length ?? 0,
      budgets: budgets?.length ?? 0,
      categories: categories?.length ?? 0,
    }),
    [accounts, transactions, goals, budgets, categories],
  );

  if (!dataReady) {
    return (
      <ToastProvider>
        <div className="mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top,0px),20px)]">
          <LoadingScreen />
        </div>
      </ToastProvider>
    );
  }

  const screen = (
    <Suspense fallback={<LoadingScreen label="Opening" />}>
    {(() => {
    switch (route.name) {
      case "activity":
        return (
          <ActivityScreen
            accounts={sortedAccounts}
            categories={categories!}
            transactions={transactions!}
            reportingCurrency={reportingCurrency}
            focusId={route.params.focus}
          />
        );

      case "budgets":
        return (
          <BudgetsScreen
            accounts={sortedAccounts}
            categories={categories!}
            transactions={transactions!}
            budgets={budgets!}
            reportingCurrency={reportingCurrency}
          />
        );

      case "goals":
        return (
          <GoalsScreen
            goals={goals!}
            contributions={contributions!}
            accounts={sortedAccounts}
            reportingCurrency={reportingCurrency}
          />
        );

      case "insights":
        return (
          <Suspense fallback={<LoadingScreen label="Preparing charts" />}>
          <InsightsScreen
            transactions={transactions!}
            categories={categories!}
            budgets={budgets!}
            goals={goals!}
            contributions={contributions!}
            reportingCurrency={reportingCurrency}
          />
          </Suspense>
        );

      case "accounts":
        return (
          <AccountsScreen
            accounts={sortedAccounts}
            transactions={transactions!}
            categories={categories!}
            reportingCurrency={reportingCurrency}
            enabledCurrencies={enabledCurrencies}
          />
        );

      case "account":
        return (
          <AccountDetailScreen
            account={sortedAccounts.find((a) => a.id === route.id) ?? sortedAccounts[0]}
            accounts={sortedAccounts}
            transactions={transactions!}
            categories={categories!}
            reportingCurrency={reportingCurrency}
            onBack={() => goBack("/accounts")}
          />
        );

      case "goal":
        return (
          <GoalDetailScreen
            goal={goals!.find((g) => g.id === route.id) ?? goals![0]}
            contributions={(contributions ?? []).filter((c) => c.goalId === route.id)}
            accounts={sortedAccounts}
            onBack={() => goBack("/goals")}
          />
        );

      case "settings":
        return (
          <SettingsScreen
            theme={theme}
            onThemeChange={setTheme}
            reportingCurrency={reportingCurrency}
            onReportingCurrencyChange={setReportingCurrency}
            enabledCurrencies={enabledCurrencies}
            onEnabledCurrenciesChange={setEnabledCurrencies}
            rates={{}}
            onRatesChange={() => undefined}
            isDemoData={isDemo}
            counts={counts}
            onBack={() => goBack("/")}
          />
        );

      case "home":
      default:
        return (
          <HomeScreen
            accounts={sortedAccounts}
            categories={categories!}
            transactions={transactions!}
            budgets={budgets!}
            goals={goals!}
            contributions={contributions!}
            recurring={(recurring ?? []).map((r) => ({
              id: r.id,
              label: r.label,
              nextDate: r.nextDate,
              amountMinor: r.amountMinor,
              currency: r.currency,
              type: r.type,
            }))}
            reportingCurrency={reportingCurrency}
          />
        );
    }
    })()}
    </Suspense>
  );

  return (
    <ToastProvider>
      <PrivacyProvider hidden={hidden}>{screen}</PrivacyProvider>
      <QuickAddFab hidden={route.name === "settings"} />
    </ToastProvider>
  );
}

/** Convenience for tests and the service worker update flow. */
export function reloadApp() {
  navigate("/", { replace: true });
}
