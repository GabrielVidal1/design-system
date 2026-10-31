import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useEscape, useScrollLock } from '../../hooks/use-overlay';

export type ModalSize = 'sm' | 'md' | 'lg' | 'full';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  full: 'max-w-[min(64rem,95vw)] h-[90vh]',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Pinned below the body — buttons, usually. */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Clicking the scrim closes. Turn off for destructive flows. */
  dismissable?: boolean;
  /** Drop the title/close bar entirely — for panels that own their whole chrome
   * (a command palette, say). Escape and scrim-click still close. */
  hideHeader?: boolean;
  className?: string;
  /** Overrides the body's default padding/scroll wrapper classes. */
  bodyClassName?: string;
  children?: React.ReactNode;
}

/**
 * The scrim + panel every project re-implements: portalled to `<body>`, Escape
 * and scrim-click to close, body scroll locked, focus moved in on open and
 * returned to the trigger on close, and a soft focus trap so Tab can't wander
 * behind the overlay.
 *
 * With `overlay.css` loaded it animates both ways: on phones the panel is a
 * bottom sheet that rises on open and sinks back on close; wider, it fades and
 * scales. Closing keeps it mounted until its exit animation ends, showing what
 * it last showed while open — so a consumer that clears its content along with
 * `open` doesn't empty the sheet mid-slide. Without the stylesheet, or with
 * reduced motion, it unmounts at once.
 *
 * @summary Modal dialog plus the imperative layer — `useModal` to open one from code
 * and `useConfirm` for yes/no. Use instead of re-implementing a dialog.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  dismissable = true,
  hideHeader = false,
  className,
  bodyClassName,
  children,
}: ModalProps) {
  const panel = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);

  // Mounted while open, and after that until the exit animation is done.
  const [shown, setShown] = React.useState(open);
  if (open && !shown) setShown(true);
  const leaving = shown && !open;
  const last = React.useRef({ title, description, footer, children });
  if (open) last.current = { title, description, footer, children };
  const view = open ? { title, description, footer, children } : last.current;

  React.useEffect(() => {
    if (!leaving) return;
    const el = panel.current;
    const name = el ? getComputedStyle(el).animationName : '';
    if (!name || name === 'none' || reducedMotion()) {
      setShown(false);
      return;
    }
    // animationend can be skipped (a hidden tab, an interrupted animation).
    const t = window.setTimeout(() => setShown(false), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  useScrollLock(open);
  useEscape(() => dismissable && onClose(), open);

  React.useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus({ preventScroll: true });
    return () => restoreTo.current?.focus?.({ preventScroll: true });
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!shown || typeof document === 'undefined') return null;
  const { title: shownTitle, description: shownDescription, footer: shownFooter } = view;

  return createPortal(
    <div
      data-state={leaving ? 'closed' : 'open'}
      className="ds-modal-scrim fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onPointerDown={(e) => {
        if (!leaving && dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof shownTitle === 'string' ? shownTitle : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onAnimationEnd={(e) => {
          if (leaving && e.target === e.currentTarget) setShown(false);
        }}
        className={cn(
          'ds-modal-panel flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none sm:rounded-2xl',
          SIZES[size],
          className,
        )}
      >
        {!hideHeader && (shownTitle || dismissable) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {shownTitle && <h2 className="truncate text-base font-medium">{shownTitle}</h2>}
              {shownDescription && <p className="mt-1 text-sm text-muted-foreground">{shownDescription}</p>}
            </div>
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
          {view.children}
        </div>
        {shownFooter && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{shownFooter}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The longest exit animation in overlay.css is 220 ms; past this, unmount
 * whether or not `animationend` came. */
const EXIT_FALLBACK_MS = 400;

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
