import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'neutral' | 'conflict' | 'network';
type Toast = { id: number; tone: ToastTone; title: string; sub?: string };
type Push = (tone: ToastTone, title: string, sub?: string) => void;

const ToastContext = createContext<Push>(() => undefined);

const ICON: Record<ToastTone, { className: string; glyph: string }> = {
  success: { className: 'bg-toast-success text-[#0b1702]', glyph: '✓' },
  neutral: { className: 'bg-toast-neutral text-shell-text', glyph: 'i' },
  conflict: { className: 'bg-toast-conflict text-[#1f1300]', glyph: '!' },
  network: { className: 'bg-toast-network text-[#1f0703]', glyph: '!' },
};

const MAX_TOASTS = 4;
const DISMISS_MS = 4_500;

/** Newest on top (desktop top-right) or nearest the thumb (mobile bottom). Max 4, 4.5 s each. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback<Push>((tone, title, sub) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [{ id, tone, title, sub }, ...list].slice(0, MAX_TOASTS));
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), DISMISS_MS);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-7 z-50 flex flex-col-reverse gap-2 sm:inset-x-auto sm:top-24 sm:right-6 sm:bottom-auto sm:w-[360px] sm:flex-col"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 rounded-card bg-toast px-3.5 py-3 text-shell-text shadow-float animate-toast-up sm:animate-toast-in"
          >
            <span
              aria-hidden="true"
              className={`inline-flex size-6 items-center justify-center rounded-pill text-[13px] font-bold ${ICON[toast.tone].className}`}
            >
              {ICON[toast.tone].glyph}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-[15px] leading-[1.35] font-semibold">{toast.title}</span>
              {toast.sub && <span className="text-[13px] leading-[1.35] text-toast-sub">{toast.sub}</span>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
