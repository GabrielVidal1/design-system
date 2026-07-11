import * as React from 'react';

import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  /** A lucide icon (or any node) — rendered muted in a soft disc. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** One line on what to do about it. Keep it actionable. */
  description?: React.ReactNode;
  /** The way out — usually a `<Button>`. */
  action?: React.ReactNode;
  /** Tighter, for a drawer or a card. */
  compact?: boolean;
  className?: string;
}

/** "No results yet" — the centred icon + message + call to action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5',
            compact ? 'size-9' : 'size-12 [&_svg]:size-6',
          )}
        >
          {icon}
        </div>
      )}
      <p className={cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
