import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Text under the spinner (also its accessible name). */
  label?: string;
  /** Centre it in a tall block — the "page is loading" shape. */
  center?: boolean;
  className?: string;
}

const SIZES = { sm: 'size-4', md: 'size-6', lg: 'size-9' } as const;

/** The `Loader2 animate-spin` block that every project hand-rolls. */
export function Spinner({ size = 'md', label, center = false, className }: SpinnerProps) {
  const spinner = (
    <Loader2
      className={cn('animate-spin text-muted-foreground', SIZES[size], !center && className)}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  );

  if (!center && !label) return spinner;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        center && 'py-16',
        center && className,
      )}
    >
      {spinner}
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
