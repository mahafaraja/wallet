import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn, IconButton } from "@/components/ui/primitives";

/**
 * Bottom sheet. Mobile-first: rises from the bottom edge on phones, centres as
 * a modal on wider viewports. Body scroll is locked while open.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="a-fade absolute inset-0 bg-black/45"
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "a-sheet relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-sheet bg-elevated",
          "shadow-[var(--shadow-sheet)] sm:rounded-xl sm:shadow-[var(--shadow-float)]",
          maxW,
        )}
      >
        <header className="flex items-start gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p> : null}
          </div>
          <IconButton icon={X} label="Close" variant="secondary" size={30} onClick={onClose} />
        </header>

        <div className="no-bar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-line bg-elevated px-4 pt-3 safe-b">{footer}</div>
        ) : (
          <div className="safe-b" />
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for destructive or irreversible actions.
 * Deliberately requires an explicit choice — no dismissable-by-accident toasts.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button type="button" aria-label="Cancel" onClick={onCancel} className="a-fade absolute inset-0 bg-black/45" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="a-pop relative z-10 w-full max-w-sm rounded-lg border border-line bg-elevated p-5 shadow-[var(--shadow-float)]"
      >
        <h3 id="confirm-title" className="text-[17px] font-semibold tracking-[-0.015em]">
          {title}
        </h3>
        <div className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{body}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md border border-line bg-surface px-4 text-[14px] font-semibold text-ink transition active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "h-10 rounded-md px-4 text-[14px] font-semibold transition active:scale-[0.97] disabled:opacity-50",
              destructive ? "bg-danger text-white" : "bg-accent text-on-accent",
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
