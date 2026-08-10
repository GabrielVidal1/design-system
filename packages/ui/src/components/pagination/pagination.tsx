import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { useIsMobile } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';
import { Button } from '../button';

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Current page, 1-indexed. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** How many page numbers to show on each side of the current one (desktop only). Default 1. */
  siblingCount?: number;
  /** aria-label for the nav landmark. */
  label?: string;
}

const ELLIPSIS = 'ellipsis' as const;
type PageToken = number | typeof ELLIPSIS;

function pageRange(page: number, pageCount: number, siblingCount: number): PageToken[] {
  const totalShown = siblingCount * 2 + 5; // first, last, current, 2 ellipses
  if (pageCount <= totalShown) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const left = Math.max(page - siblingCount, 2);
  const right = Math.min(page + siblingCount, pageCount - 1);

  const tokens: PageToken[] = [1];
  if (left > 2) tokens.push(ELLIPSIS);
  for (let p = left; p <= right; p++) tokens.push(p);
  if (right < pageCount - 1) tokens.push(ELLIPSIS);
  tokens.push(pageCount);
  return tokens;
}

/**
 * Page-number navigation with prev/next, sibling pages and collapsing "…"
 * gaps on desktop; on phones it drops the number grid for a big-tap-target
 * "Prev / Page X of Y / Next" strip (numbered buttons are too small to hit
 * reliably on touch).
 *
 * @summary Prev/next + numbered pages with collapsing "…" gaps; a big-tap
 * "Page X of Y" strip on phones.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  label = 'Pagination',
  className,
  ...props
}: PaginationProps) {
  const isMobile = useIsMobile();
  const clampedCount = Math.max(pageCount, 1);
  const canPrev = page > 1;
  const canNext = page < clampedCount;

  const go = (p: number) => {
    if (p >= 1 && p <= clampedCount && p !== page) onPageChange(p);
  };

  if (isMobile) {
    return (
      <nav aria-label={label} className={cn('flex items-center justify-between gap-2', className)} {...props}>
        <Button variant="outline" size="lg" icon={<ChevronLeft />} disabled={!canPrev} onClick={() => go(page - 1)}>
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {clampedCount}
        </span>
        <Button
          variant="outline"
          size="lg"
          icon={<ChevronRight />}
          iconPosition="right"
          disabled={!canNext}
          onClick={() => go(page + 1)}
        >
          Next
        </Button>
      </nav>
    );
  }

  const tokens = pageRange(page, clampedCount, siblingCount);

  return (
    <nav aria-label={label} className={cn('flex items-center gap-1', className)} {...props}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <ol className="flex items-center gap-1">
        {tokens.map((t, i) =>
          t === ELLIPSIS ? (
            <li
              key={`e${i}`}
              className="flex size-8 items-center justify-center text-sm text-muted-foreground"
              aria-hidden
            >
              …
            </li>
          ) : (
            <li key={t}>
              <button
                type="button"
                aria-current={t === page ? 'page' : undefined}
                onClick={() => go(t)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md text-sm tabular-nums',
                  t === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {t}
              </button>
            </li>
          ),
        )}
      </ol>
      <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={!canNext} onClick={() => go(page + 1)}>
        <ChevronRight />
      </Button>
    </nav>
  );
}
