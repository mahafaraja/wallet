import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/components/ui/primitives";

/* ==========================================================================
   Toasts
   ========================================================================== */

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  detail?: string;
};

type ToastApi = {
  toast: (message: string, opts?: { tone?: ToastTone; detail?: string }) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastApi["toast"]>(
    (message, opts) => {
      const id = Date.now() + Math.random();
      const entry: Toast = {
        id,
        tone: opts?.tone ?? "info",
        message,
        detail: opts?.detail,
      };
      setToasts((prev) => [...prev.slice(-2), entry]);
      // Auto-dismiss; errors linger longer because they may need reading.
      setTimeout(() => dismiss(id), entry.tone === "error" ? 6000 : 3200);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-[calc(max(env(safe-area-inset-bottom,0px),10px)+76px)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "a-toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border px-3.5 py-2.5 shadow-[var(--shadow-float)]",
              t.tone === "success" && "border-line bg-elevated",
              t.tone === "error" && "border-danger/40 bg-elevated",
              t.tone === "info" && "border-line bg-elevated",
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 size={17} strokeWidth={2.2} className="mt-px shrink-0 text-income" />
            ) : t.tone === "error" ? (
              <AlertCircle size={17} strokeWidth={2.2} className="mt-px shrink-0 text-danger" />
            ) : (
              <Info size={17} strokeWidth={2.2} className="mt-px shrink-0 text-accent" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-snug">{t.message}</p>
              {t.detail ? <p className="mt-0.5 text-[12px] text-ink-2">{t.detail}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-3 transition hover:text-ink"
            >
              <X size={13} strokeWidth={2.6} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

/* ==========================================================================
   Empty states
   ========================================================================== */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line text-center",
        compact ? "px-5 py-7" : "px-6 py-12",
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon size={20} strokeWidth={1.9} />
      </span>
      <p className="mt-3 text-[14.5px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-[34ch] text-[13px] leading-relaxed text-ink-3">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ==========================================================================
   Loading states
   ========================================================================== */

export function LoadingScreen({ label = "Loading your ledger" }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6">
      <div className="grid gap-2.5" style={{ width: "min(100%, 320px)" }} aria-hidden>
        <div className="skeleton h-[104px] !rounded-lg" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-16 !rounded-lg" />
        <div className="skeleton h-16 !rounded-lg" />
      </div>
      <p className="sr-only" role="status">
        {label}
      </p>
    </div>
  );
}

export function InlineLoading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-ink-3" role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label ? <span className="text-[13px]">{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}
