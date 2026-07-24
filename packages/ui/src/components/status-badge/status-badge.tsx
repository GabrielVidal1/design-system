import * as React from 'react';
import {
  Ban,
  Check,
  CircleDashed,
  Clock,
  Loader2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '../../lib/utils';

export type Tone = 'neutral' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';

/*
 * Tones are written out in full — Tailwind scans source text, so a template
 * literal like `bg-${tone}-500/12` would compile to nothing.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  sky: 'bg-sky-500/12 text-sky-600 border-sky-500/25 dark:text-sky-400',
  emerald: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/25 dark:text-emerald-400',
  amber: 'bg-amber-500/12 text-amber-600 border-amber-500/25 dark:text-amber-400',
  rose: 'bg-rose-500/12 text-rose-600 border-rose-500/25 dark:text-rose-400',
  violet: 'bg-violet-500/12 text-violet-600 border-violet-500/25 dark:text-violet-400',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** A leading dot instead of an icon — for tag/priority chips. */
  dot?: boolean;
}

/** A small pill. The base every status/tag chip in the lab is built from. */
export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export interface StatusMeta {
  label: string;
  tone: Tone;
  Icon?: LucideIcon;
  /** Spin the icon — for anything in flight. */
  spin?: boolean;
}

/** The job lifecycle every queue in the lab speaks. Extend it via `meta`. */
export const JOB_STATUS: Record<string, StatusMeta> = {
  queued: { label: 'Queued', tone: 'neutral', Icon: Clock },
  pending: { label: 'Pending', tone: 'neutral', Icon: Clock },
  running: { label: 'Running', tone: 'sky', Icon: Loader2, spin: true },
  done: { label: 'Done', tone: 'emerald', Icon: Check },
  succeeded: { label: 'Succeeded', tone: 'emerald', Icon: Check },
  error: { label: 'Error', tone: 'rose', Icon: TriangleAlert },
  failed: { label: 'Failed', tone: 'rose', Icon: TriangleAlert },
  cancelled: { label: 'Cancelled', tone: 'amber', Icon: Ban },
  archived: { label: 'Archived', tone: 'violet', Icon: CircleDashed },
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
  status: string;
  /** Override or extend the default map (merged over `JOB_STATUS`). */
  meta?: Record<string, StatusMeta>;
}

/**
 * A status pill driven by a `status → {label, tone, icon}` map, so the same
 * string renders the same colour in every service.
 * Unknown statuses degrade to a neutral pill of the raw string, never a crash.
 *
 * @summary Coloured badge with a built-in job-status → tone map (`JOB_STATUS`). For
 * queue/build/deploy states.
 */
export function StatusBadge({ status, meta, className, ...props }: StatusBadgeProps) {
  const entry: StatusMeta = { ...JOB_STATUS, ...meta }[status] ?? { label: status, tone: 'neutral' };
  const { Icon } = entry;
  return (
    <Badge tone={entry.tone} className={className} {...props}>
      {Icon && <Icon className={cn(entry.spin && 'animate-spin')} />}
      {entry.label}
    </Badge>
  );
}
