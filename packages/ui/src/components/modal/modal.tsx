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
  className?: string;
  children?: React.ReactNode;
}

/**
 * The scrim + panel every project re-implements: portalled to `<body>`, Escape
 * and scrim-click to close, body scroll locked, focus moved in on open and
 * returned to the trigger on close, and a soft focus trap so Tab can't wander
 * behind the overlay.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  dismissable = true,
  className,
  children,
}: ModalProps) {
  const panel = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);

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

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ds-modal-scrim fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onPointerDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'ds-modal-panel flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none sm:rounded-2xl',
          SIZES[size],
          className,
        )}
      >
        {(title || dismissable) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="truncate text-base font-medium">{title}</h2>}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
