import type { ReactNode } from "react";
import { Home, Receipt, PieChart, Target, BarChart3, Settings } from "lucide-react";
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

export function BottomNav({ active }: { active: RouteName }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-xl safe-b lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const isActive = item.name === active;
          return (
            <li key={item.name} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center gap-[3px] py-2 transition-colors",
                  isActive ? "text-accent" : "text-ink-3",
                )}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.3 : 1.85} />
                <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
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

/** Same destinations, expressed as a rail once there is room for one. */
export function SideNav({ active }: { active: RouteName }) {
  return (
    <nav
      aria-label="Main"
      className="fixed left-0 top-0 z-40 hidden h-full w-[228px] flex-col border-r border-line bg-surface px-3 py-5 lg:flex"
    >
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <AppMark />
        <div className="leading-tight">
          <p className="text-[14px] font-semibold tracking-[-0.01em]">Pocket Ledger</p>
          <p className="text-[11px] text-ink-3">Personal finance</p>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.name === active;
          return (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[14px] font-medium transition-colors",
                  isActive ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.25 : 1.9} />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => navigate("/settings")}
        aria-current={active === "settings" ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[14px] font-medium transition-colors",
          active === "settings" ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2",
        )}
      >
        <Settings size={18} strokeWidth={1.9} />
        Settings
      </button>
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
    <div className="min-h-dvh lg:pl-[228px]">
      <SideNav active={active} />
      <BottomNav active={active} />

      <div className={cn("mx-auto w-full px-4 pb-[calc(max(env(safe-area-inset-bottom,0px),12px)+84px)] pt-[max(env(safe-area-inset-top,0px),14px)] lg:px-8 lg:pb-16 lg:pt-8")}>
        <div className={cn("mx-auto", wide ? "max-w-4xl" : "max-w-xl lg:max-w-2xl")}>
          <header className="mb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold leading-tight tracking-[-0.028em]">{title}</h1>
                {subtitle ? (
                  <div className="mt-1 text-[13.5px] text-ink-2">{subtitle}</div>
                ) : null}
              </div>
              {headerRight ? <div className="flex shrink-0 items-center gap-2 pt-1.5">{headerRight}</div> : null}
            </div>
          </header>

          <div className="a-rise">{children}</div>
        </div>
      </div>
    </div>
  );
}
