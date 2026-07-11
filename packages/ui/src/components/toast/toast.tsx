import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';

import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastAction {
  label: string;
  onClick?: () => void;
  /** Renders the action as a link instead of a button. */
  href?: string;
}

export interface ToastOptions {
  /** Bold first line above the message. */
  title?: string;
  type?: ToastType;
  /** ms before it self-dismisses. `0` (or a `loading` toast) pins it open. */
  duration?: number;
  action?: ToastAction;
}

export interface Toast extends ToastOptions {
  id: string;
  message: React.ReactNode;
  type: ToastType;
}

/** Callable: `toast('Saved')`, plus one shorthand per type. */
export interface ToastFn {
  (message: React.ReactNode, options?: ToastOptions): string;
  success: (message: React.ReactNode, options?: ToastOptions) => string;
  error: (message: React.ReactNode, options?: ToastOptions) => string;
  warning: (message: React.ReactNode, options?: ToastOptions) => string;
  info: (message: React.ReactNode, options?: ToastOptions) => string;
  /** Pinned open with a spinner — settle it with `toast.update(id, …)`. */
  loading: (message: React.ReactNode, options?: ToastOptions) => string;
  /** Turn a pending toast into its outcome, in place. */
  update: (id: string, message: React.ReactNode, options?: ToastOptions) => void;
  dismiss: (id?: string) => void;
}

const ToastCtx = React.createContext<ToastFn | null>(null);

/**
 * The toast queue.
 *
 * ```tsx
 * <ToastProvider>          <App />         </ToastProvider>
 *
 * const toast = useToast()
 * toast.success('Deployed', { action: { label: 'Open', href: url } })
 * const id = toast.loading('Uploading…')
 * toast.update(id, 'Uploaded', { type: 'success' })
 * ```
 */
export function ToastProvider({
  children,
  position = 'bottom-right',
  duration = 4000,
  max = 4,
}: {
  children: React.ReactNode;
  position?: ToastPosition;
  /** Default lifetime. Errors get 1.75× this, since they carry more to read. */
  duration?: number;
  /** Oldest toasts beyond this are dropped, so a burst can't cover the page. */
  max?: number;
}) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const seq = React.useRef(0);

  const dismiss = React.useCallback((id?: string) => {
    if (id == null) {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      setToasts([]);
      return;
    }
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const arm = React.useCallback(
    (t: Toast) => {
      clearTimeout(timers.current.get(t.id));
      const ttl = t.duration ?? (t.type === 'loading' ? 0 : t.type === 'error' ? duration * 1.75 : duration);
      if (ttl > 0) timers.current.set(t.id, setTimeout(() => dismiss(t.id), ttl));
    },
    [dismiss, duration],
  );

  const push = React.useCallback(
    (message: React.ReactNode, { type = 'info', ...rest }: ToastOptions = {}) => {
      const id = `t${(seq.current += 1)}`;
      const toast: Toast = { id, message, type, ...rest };
      setToasts((prev) => [...prev, toast].slice(-max));
      arm(toast);
      return id;
    },
    [arm, max],
  );

  const update = React.useCallback(
    (id: string, message: React.ReactNode, options: ToastOptions = {}) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const next: Toast = { ...t, message, ...options, type: options.type ?? t.type };
          arm(next);
          return next;
        }),
      );
    },
    [arm],
  );

  const toast = React.useMemo<ToastFn>(() => {
    const fn = ((message, options) => push(message, options)) as ToastFn;
    fn.success = (m, o) => push(m, { ...o, type: 'success' });
    fn.error = (m, o) => push(m, { ...o, type: 'error' });
    fn.warning = (m, o) => push(m, { ...o, type: 'warning' });
    fn.info = (m, o) => push(m, { ...o, type: 'info' });
    fn.loading = (m, o) => push(m, { ...o, type: 'loading' });
    fn.update = update;
    fn.dismiss = dismiss;
    return fn;
  }, [push, update, dismiss]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <Toaster toasts={toasts} position={position} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

/** The toast function. Throws outside a `<ToastProvider>` — a silent no-op toast is worse. */
export function useToast(): ToastFn {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>');
  return ctx;
}

const META: Record<ToastType, { Icon: typeof Info; tone: string }> = {
  success: { Icon: CheckCircle2, tone: 'text-emerald-500' },
  error: { Icon: XCircle, tone: 'text-destructive' },
  warning: { Icon: AlertTriangle, tone: 'text-amber-500' },
  info: { Icon: Info, tone: 'text-sky-500' },
  loading: { Icon: Loader2, tone: 'text-muted-foreground' },
};

const PLACEMENT: Record<ToastPosition, string> = {
  'top-left': 'top-0 left-0 items-start',
  'top-center': 'top-0 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-0 right-0 items-end',
  'bottom-left': 'bottom-0 left-0 items-start',
  'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-0 right-0 items-end',
};

/** The rendered stack. `ToastProvider` mounts one; you rarely need it directly. */
export function Toaster({
  toasts,
  position = 'bottom-right',
  onDismiss,
}: {
  toasts: Toast[];
  position?: ToastPosition;
  onDismiss: (id: string) => void;
}) {
  if (typeof document === 'undefined') return null;

  const fromTop = position.startsWith('top');

  return createPortal(
    <div
      className={cn(
        'pointer-events-none fixed z-[100] flex w-full max-w-sm flex-col gap-2 p-4',
        fromTop ? 'flex-col' : 'flex-col-reverse',
        PLACEMENT[position],
      )}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const { Icon, tone } = META[t.type];
        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'ds-toast pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-popover p-3 pr-2 text-popover-foreground shadow-lg',
              fromTop ? 'ds-toast--top' : 'ds-toast--bottom',
            )}
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', tone, t.type === 'loading' && 'animate-spin')} />
            <div className="min-w-0 flex-1">
              {t.title && <p className="text-sm font-medium">{t.title}</p>}
              <div className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{t.message}</div>
              {t.action &&
                (t.action.href ? (
                  <a
                    href={t.action.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-xs font-medium text-foreground underline underline-offset-2"
                  >
                    {t.action.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick?.();
                      onDismiss(t.id);
                    }}
                    className="mt-1.5 text-xs font-medium text-foreground underline underline-offset-2"
                  >
                    {t.action.label}
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
