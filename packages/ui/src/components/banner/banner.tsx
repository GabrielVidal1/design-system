import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

export type BannerType = 'info' | 'success' | 'warning' | 'error' | 'neutral';

const META: Record<BannerType, { Icon: LucideIcon; className: string }> = {
  neutral: { Icon: Info, className: 'border-border bg-muted text-foreground [&_svg]:text-muted-foreground' },
  info: {
    Icon: Info,
    className: 'border-sky-500/25 bg-sky-500/10 text-foreground [&_svg]:text-sky-600 dark:[&_svg]:text-sky-400',
  },
  success: {
    Icon: CheckCircle2,
    className:
      'border-emerald-500/25 bg-emerald-500/10 text-foreground [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400',
  },
  warning: {
    Icon: AlertTriangle,
    className:
      'border-amber-500/25 bg-amber-500/10 text-foreground [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400',
  },
  error: {
    Icon: XCircle,
    className: 'border-destructive/25 bg-destructive/10 text-foreground [&_svg]:text-destructive',
  },
};

export interface BannerAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  type?: BannerType;
  /** Bold first line above the message. */
  title?: React.ReactNode;
  /** Override the type's default icon. Pass `false` to hide it entirely. */
  icon?: React.ReactNode | false;
  /** A single inline action (button or link) — for a second, use plain children. */
  action?: BannerAction;
  /** Renders a dismiss button and calls this when clicked. Omit for a static banner. */
  onDismiss?: () => void;
  /** Tighter padding/text, for a banner inside a card or drawer. */
  compact?: boolean;
}

/**
 * A persistent inline message — page-level status, a form-wide error, a
 * "you're on the free tier" callout — as opposed to `Toast`'s transient,
 * floating notification. Same type vocabulary (`success`/`error`/`warning`/
 * `info`) so a caller can promote a toast straight to a banner.
 *
 * @summary Inline status/callout banner (info/success/warning/error), optionally
 * dismissible with an action link — the persistent counterpart to `Toast`.
 */
export function Banner({
  type = 'info',
  title,
  icon,
  action,
  onDismiss,
  compact = false,
  className,
  children,
  ...props
}: BannerProps) {
  const { Icon, className: toneClassName } = META[type];
  const role = type === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-3 rounded-xl border',
        compact ? 'p-2.5 text-xs' : 'p-3.5 text-sm',
        toneClassName,
        className,
      )}
      {...props}
    >
      {icon !== false && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Icon />}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('[overflow-wrap:anywhere]', title && 'text-foreground/80')}>{children}</div>}
        {action &&
          (action.href ?
            <a
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-block font-medium underline underline-offset-2"
            >
              {action.label}
            </a>
          : <button
              type="button"
              onClick={action.onClick}
              className="mt-1.5 font-medium underline underline-offset-2"
            >
              {action.label}
            </button>)}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 opacity-70 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
