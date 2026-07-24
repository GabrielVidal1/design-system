import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { CharRoll } from '../char-roll';
import { Skeleton } from '../skeleton';

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** What is being counted — "Jobs today", "GPU time". */
  label: React.ReactNode;
  /**
   * The number itself. Strings and numbers change with the {@link CharRoll}
   * tally animation (see `roll`); any other node renders as-is.
   */
  value: React.ReactNode;
  /**
   * Change vs the previous period. A number gets a signed percent chip with an
   * arrow, coloured by `goodDirection`; a string renders verbatim in neutral.
   */
  delta?: number | string;
  /** Which way `delta` is good news — errors going down is good. @default 'up' */
  goodDirection?: 'up' | 'down';
  /** Sub-caption under the value — "vs last week", "3 running". */
  hint?: React.ReactNode;
  /** Corner icon. */
  Icon?: LucideIcon;
  /** Skeleton the value while the first fetch is in flight. */
  loading?: boolean;
  /** Animate `string | number` value changes with {@link CharRoll}. @default true */
  roll?: boolean;
}

const fmtDelta = (d: number) => `${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}%`;

/**
 * One dashboard KPI — label, big number, trend chip. The value ticks over
 * like a tally counter when it changes, so a live dashboard reads as live.
 * Lay several out with {@link StatRow}.
 *
 * @summary KPI tile and row — label, big value, optional delta. For dashboard
 * headline numbers.
 */
export function StatTile({
  label,
  value,
  delta,
  goodDirection = 'up',
  hint,
  Icon,
  loading = false,
  roll = true,
  className,
  ...props
}: StatTileProps) {
  const rollable = typeof value === 'string' || typeof value === 'number';

  let deltaChip: React.ReactNode = null;
  if (delta !== undefined) {
    if (typeof delta === 'number' && delta !== 0) {
      const up = delta > 0;
      const good = up === (goodDirection === 'up');
      const DeltaArrow = up ? ArrowUpRight : ArrowDownRight;
      deltaChip = (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 mono text-[11px] tabular-nums',
            good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}
        >
          <DeltaArrow className="size-3" />
          {fmtDelta(delta)}
        </span>
      );
    } else {
      deltaChip = (
        <span className="mono text-[11px] tabular-nums text-muted-foreground">
          {typeof delta === 'number' ? fmtDelta(delta) : delta}
        </span>
      );
    }
  }

  return (
    <div
      className={cn('min-w-0 rounded-lg border border-border bg-card p-4', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground/70" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <span className="display text-2xl leading-none text-foreground tabular-nums">
            {rollable && roll ? <CharRoll value={value as string | number} /> : value}
          </span>
        )}
        {!loading && deltaChip}
      </div>
      {hint && <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export interface StatRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Desktop column count; phones always get 2-up. @default 4 */
  columns?: 2 | 3 | 4;
}

/* Written out in full for the Tailwind scanner. */
const ROW_COLS: Record<NonNullable<StatRowProps['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

/** The KPI strip at the top of every dashboard: 2-up on phones, `columns`-up beyond. */
export function StatRow({ columns = 4, className, children, ...props }: StatRowProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', ROW_COLS[columns], className)} {...props}>
      {children}
    </div>
  );
}
