import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { useEscape, useScrollLock } from '../../hooks/use-overlay';

export interface InspectorPanelProps {
  /** Panel heading — usually the selected object ("Rectangle", "3 items"). */
  title?: React.ReactNode;
  /** `InspectorSection`s (or anything) — the scrollable body. */
  children: React.ReactNode;
  /** Pinned under the body (e.g. a delete button). */
  footer?: React.ReactNode;
  /** Sheet visibility on phones (ignored inline). @default true */
  open?: boolean;
  /** Renders a close ✕ (and closes the phone sheet's scrim/Esc). Without it
   *  the sheet has no dismiss affordance, so pass it whenever `sheet` can
   *  apply. */
  onClose?: () => void;
  /** Force presentation: `true` = bottom sheet, `false` = inline column.
   *  Default: sheet on phones, inline on desktop. */
  sheet?: boolean;
  className?: string;
}

export interface InspectorSectionProps {
  title: React.ReactNode;
  /** Right-aligned header extras (a reset button, an "＋"…). */
  actions?: React.ReactNode;
  /** Header click folds the section. @default true */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export interface InspectorRowProps {
  label: React.ReactNode;
  /** Muted line under the control. */
  hint?: React.ReactNode;
  /** Label above the control instead of beside it — for wide controls
   *  (an inline `ColorPicker`, a textarea). @default false */
  stacked?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * The property panel of an editor: a titled, scrollable column of
 * `InspectorSection`s whose `InspectorRow`s align every label/control pair.
 * Inline it is presentation-free — give it a width inside a `FloatingPanel`,
 * a `ResizableLayout` pane or any sidebar; on phones it turns into a bottom
 * sheet over the stage (controlled via `open`/`onClose`).
 *
 * @summary Editor property panel — titled sections of aligned label/control
 * rows; a sidebar column on desktop, a bottom sheet on phones.
 */
export function InspectorPanel({
  title,
  children,
  footer,
  open = true,
  onClose,
  sheet,
  className,
}: InspectorPanelProps) {
  const isMobile = useIsMobile();
  const asSheet = sheet ?? isMobile;

  const body = (
    <>
      {(title || onClose) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium">{title}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0 border-t border-border px-3 py-2">{footer}</div>}
    </>
  );

  if (!asSheet) {
    return (
      <div
        className={cn(
          'ds-inspector flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
          className,
        )}
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {body}
      </div>
    );
  }

  if (!open) return null;
  return <InspectorSheet onClose={onClose} className={className}>{body}</InspectorSheet>;
}

function InspectorSheet({
  children,
  onClose,
  className,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  useScrollLock(true);
  useEscape(() => onClose?.());
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ds-inspector-scrim fixed inset-0 z-[95] flex items-end bg-black/40 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-label="Inspector"
        className={cn(
          'ds-inspector-sheet flex max-h-[80vh] w-full flex-col rounded-t-2xl border-t border-border bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] text-card-foreground shadow-2xl',
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * One titled, optionally collapsible group of rows ("Transform", "Fill",
 * "Typography"). Sections separate with hairlines and remember nothing —
 * fold state is local.
 *
 * @summary Collapsible titled group of inspector rows.
 */
export function InspectorSection({
  title,
  actions,
  collapsible = true,
  defaultCollapsed = false,
  children,
  className,
}: InspectorSectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const bodyId = React.useId();

  return (
    <section className={cn('border-b border-border last:border-b-0', className)}>
      <div className="flex h-9 items-center justify-between gap-2 pl-1.5 pr-3">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={() => setCollapsed((c) => !c)}
            className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn('size-3.5 shrink-0 transition-transform', !collapsed && 'rotate-90')}
            />
            <span className="truncate">{title}</span>
          </button>
        ) : (
          <span className="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
        )}
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {!collapsed && (
        <div id={bodyId} className="flex flex-col gap-2.5 px-3 pb-3 pt-0.5">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * One label/control pair. Side-by-side by default (label column left,
 * control right, everything aligned); `stacked` puts the label above for
 * controls that want the full width.
 *
 * @summary Aligned label + control row inside an inspector section.
 */
export function InspectorRow({ label, hint, stacked = false, children, className }: InspectorRowProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className={cn('flex min-w-0 gap-2', stacked ? 'flex-col' : 'items-center')}>
        <span
          className={cn(
            'shrink-0 text-xs text-muted-foreground',
            !stacked && 'w-20 min-w-0 truncate',
          )}
        >
          {label}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {hint && <div className={cn('text-[11px] text-muted-foreground/80', !stacked && 'pl-[5.5rem]')}>{hint}</div>}
    </div>
  );
}
