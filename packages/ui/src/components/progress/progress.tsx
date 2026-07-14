import * as React from 'react';

import { cn } from '../../lib/utils';
import type { Tone } from '../status-badge';

/*
 * Tones are written out in full — Tailwind scans source text, so a template
 * literal like `bg-${tone}-500` would compile to nothing.
 */
const BAR_TONES: Record<Tone, string> = {
  neutral: 'bg-foreground/60',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
};

const TRACK_SIZES = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5' } as const;

export type ProgressSize = keyof typeof TRACK_SIZES;

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current value, `0..max`. Omit it (or pass `indeterminate`) for the sweep. */
  value?: number;
  /** The value that means "done". @default 100 */
  max?: number;
  tone?: Tone;
  size?: ProgressSize;
  /**
   * Unknown duration — the bar sweeps instead of filling. Implied when `value`
   * is omitted.
   */
  indeterminate?: boolean;
  /** Caption above the track, left-aligned. */
  label?: React.ReactNode;
  /** Show the value above the track, right-aligned. @default false */
  showValue?: boolean;
  /** Text for `showValue` (and `aria-valuetext`). Default is a percentage. */
  format?: (value: number, max: number) => string;
  /** Animate value changes by easing the fill width. @default true */
  animate?: boolean;
}

const defaultFormat = (value: number, max: number) => `${Math.round((value / max) * 100)}%`;

/**
 * A determinate progress bar — jobs, uploads, quotas. Reads its colour from
 * the shared {@link Tone} scale so a `running` job's bar matches its
 * {@link StatusBadge}. With no `value` (or `indeterminate`) it plays an
 * endless sweep; needs `@gabvdl/ui/progress.css` (in the `styles.css` barrel).
 */
export function Progress({
  value,
  max = 100,
  tone = 'sky',
  size = 'sm',
  indeterminate,
  label,
  showValue = false,
  format = defaultFormat,
  animate = true,
  className,
  ...props
}: ProgressProps) {
  const unknown = indeterminate || value === undefined;
  const clamped = unknown ? 0 : Math.min(Math.max(value, 0), max);
  const pct = unknown || max <= 0 ? 0 : (clamped / max) * 100;
  const text = unknown ? undefined : format(clamped, max);

  return (
    <div className={cn('w-full', className)} {...props}>
      {(label || (showValue && !unknown)) && (
        <div className="mb-1 flex items-baseline justify-between gap-3">
          {label ? <span className="text-xs text-muted-foreground">{label}</span> : <span />}
          {showValue && !unknown && (
            <span className="mono text-[11px] tabular-nums text-muted-foreground">{text}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={unknown ? undefined : clamped}
        aria-valuetext={text}
        className={cn('relative w-full overflow-hidden rounded-full bg-muted', TRACK_SIZES[size])}
      >
        <div
          className={cn(
            'h-full rounded-full',
            BAR_TONES[tone],
            unknown && 'ds-progress-sweep w-2/5',
            !unknown && animate && 'transition-[width] duration-500 ease-out',
          )}
          style={unknown ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
