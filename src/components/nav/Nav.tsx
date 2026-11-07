import type { ReactNode } from "react";
import { Home, Receipt, PieChart, Target, BarChart3, Settings, Landmark } from "lucide-react";
import { cn } from "@/components/ui/primitives";
import { navigate } from "@/state/router";
import type { RouteName } from "@/state/router";

type NavItem = { name: RouteName; path: string; label: string; icon: typeof Home };

export const NAV_ITEMS: NavItem[] = [
  { name: "home", path: "/", label: "Home", icon: Home },
  { name: "activity", path: "/activity", label: "Activity", icon: Receipt },
  { name: "budgets", path: "/budgets", label: "Budgets", icon: PieChart },
  { name: "goals", path: "/goals", label: "Goals", icon: Target },
  { name: "insights", path: "/insights", label: "Insights", icon: BarChart3 },
];

/** Keep a parent destination highlighted while a related detail page is open. */
function isActiveDestination(destination: RouteName, active: RouteName): boolean {
  return destination === active || (destination === "goals" && active === "goal");
}

/** Phones retain the five-destination bottom bar; tablets use the sidebar. */
export function BottomNav({ active }: { active: RouteName }) {
  return (
    <nav
      aria-label="Main navigation"
      className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch px-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
        {NAV_ITEMS.map((item) => {
          const isActive = isActiveDestination(item.name, active);
          return (
            <li key={item.name} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 w-full flex-col items-center gap-[3px] py-2 transition-colors",
                  isActive ? "text-accent" : "text-ink-3",
                )}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.4 : 1.7} />
                <span className={cn("ts-caption-2", isActive ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A persistent, touch-friendly sidebar for iPad, tablets, and desktop. */
export function SideNav({ active }: { active: RouteName }) {
  const accountsActive = active === "accounts" || active === "account";
  const settingsActive = active === "settings" || active === "categories";

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-52 flex-col overflow-y-auto border-r border-line bg-surface",
        "pr-3 pl-[max(0.75rem,env(safe-area-inset-left,0px))]",
        "pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]",
        "md:flex lg:w-[228px]",
      )}
    >
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <AppMark size={34} />
        <div className="min-w-0 leading-tight">
          <p className="ts-subhead-emph truncate">Pocket Ledger</p>
          <p className="ts-caption-1 text-ink-3">Personal finance</p>
        </div>
      </div>

      <p className="eyebrow mb-2 px-2.5 text-ink-3">Explore</p>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = isActiveDestination(item.name, active);
          return (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "ts-subheadline flex min-h-11 w-full items-center gap-3 rounded-sm px-2.5 py-2 font-medium transition-colors",
                  isActive ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <item.icon size={19} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-line pt-5">
        <p className="eyebrow mb-2 px-2.5 text-ink-3">Your wallet</p>
        <button
          type="button"
          onClick={() => navigate("/accounts")}
          aria-current={accountsActive ? "page" : undefined}
          className={cn(
            "ts-subheadline flex min-h-11 w-full items-center gap-3 rounded-sm px-2.5 py-2 font-medium transition-colors",
            accountsActive ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2",
          )}
        >
          <Landmark size={19} strokeWidth={accountsActive ? 2.4 : 1.8} aria-hidden />
          Accounts
        </button>
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          aria-current={settingsActive ? "page" : undefined}
          className={cn(
            "ts-subheadline flex min-h-11 w-full items-center gap-3 rounded-sm px-2.5 py-2 font-medium transition-colors",
            settingsActive ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2",
          )}
        >
          <Settings size={19} strokeWidth={settingsActive ? 2.4 : 1.8} aria-hidden />
          Settings
        </button>
        <p className="ts-caption-1 mt-2 px-2.5 text-ink-3">Private to this device</p>
      </div>
    </nav>
  );
}

/** Simple geometric application mark. Legible at 16px, no illustration. */
export function AppMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect width="40" height="40" rx="9" fill="var(--p-accent)" />
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="white" strokeWidth="3.4" />
      <circle cx="20" cy="20" r="2.6" fill="white" />
    </svg>
  );
}

export function AppShell({
  active,
  children,
  title,
  subtitle,
  headerRight,
  wide,
}: {
  active: RouteName;
  children: ReactNode;
  title: string;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh md:pl-52 lg:pl-[228px]">
      <SideNav active={active} />
      <BottomNav active={active} />

      <main
        className={cn(
          "mx-auto w-full px-4 pb-[calc(max(env(safe-area-inset-bottom,0px),12px)+84px)] pt-[max(env(safe-area-inset-top,0px),14px)]",
          "md:px-6 md:pb-[max(4rem,env(safe-area-inset-bottom,0px))] md:pt-[max(2rem,env(safe-area-inset-top,0px))] lg:px-8",
        )}
      >
        <div className={cn("mx-auto", wide ? "max-w-4xl" : "max-w-xl lg:max-w-2xl")}>
          <header className="mb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="ts-title-1 font-bold">{title}</h1>
                {subtitle ? (
                  <div className="ts-footnote mt-1 text-ink-2">{subtitle}</div>
                ) : null}
              </div>
              {headerRight ? <div className="flex shrink-0 items-center gap-2 pt-1.5">{headerRight}</div> : null}
            </div>
          </header>

          <div className="a-rise">{children}</div>
        </div>
      </main>
    </div>
  );
}
