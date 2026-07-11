import * as React from 'react';

import { cn } from '../../lib/utils';

/** A pulsing placeholder block. Give it a size with `className`. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  /** Number of lines. The last one is short, like real ragged text. */
  lines?: number;
  className?: string;
}

/** A paragraph of skeleton lines — the shape text actually loads into. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/5' : 'w-full')} />
      ))}
    </div>
  );
}

export interface SkeletonGridProps {
  count?: number;
  /** Tailwind aspect class for each tile. */
  aspect?: string;
  className?: string;
}

/** A grid of tiles — the gallery/card placeholder. */
export function SkeletonGrid({
  count = 6,
  aspect = 'aspect-square',
  className,
}: SkeletonGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-xl', aspect)} />
      ))}
    </div>
  );
}
