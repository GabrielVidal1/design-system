import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
  type Key,
  type ReactNode,
  type Ref,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '../../lib/utils';
import { useMediaQuery } from '../../hooks/use-media-query';

/** Imperative handle exposed via {@link VirtualListProps.apiRef}. */
export interface VirtualListHandle {
  /** Scroll an **item** index into view (in grid mode, its row). */
  scrollToIndex: (index: number, opts?: { align?: 'auto' | 'start' | 'center' | 'end' }) => void;
  scrollToTop: () => void;
  /** How many items sit on one row right now (1 unless `columns` is set). */
  columnCount: number;
}

/**
 * How many items go on one row. A number is a fixed count; the object form picks
 * per breakpoint (Tailwind's `sm`/`md`/`lg`), falling back to `base`.
 */
export type VirtualListColumns = number | { base?: number; sm?: number; md?: number; lg?: number };

export interface VirtualListProps<T> {
  /** The rows. Only the ones near the viewport are ever in the DOM. */
  items: T[];
  /** Render one row. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable React key per row (defaults to the index). */
  getItemKey?: (item: T, index: number) => Key;
  /** First-paint height guess in px; real heights are then measured. */
  estimateSize?: number;
  /** Off-screen rows kept mounted as a scroll buffer. */
  overscan?: number;
  /**
   * Called when the last rows scroll into range — append more items here for an
   * infinite list. Guarded by `hasMore` and `loading`.
   */
  onEndReached?: () => void;
  /** Whether more pages remain (guards `onEndReached`). */
  hasMore?: boolean;
  /** Whether a load is in flight (guards `onEndReached`, shows the indicator). */
  loading?: boolean;
  /** Rows-from-the-end that trip `onEndReached`. Default 4. */
  endThreshold?: number;
  /** Shown at the bottom while `loading`. */
  loadingIndicator?: ReactNode;
  /** Shown when `items` is empty and not loading. */
  emptyState?: ReactNode;
  /**
   * Animate rows sliding to their new position when the list is re-sorted (e.g.
   * an auto-sort by "updated" date whose value changed), so a reorder glides
   * instead of teleporting. Only animates while the list is idle — scrolling and
   * lazy height-measurement never animate. Requires the stylesheet
   * `@gabvdl/ui/virtual-list.css` (bundled in `styles.css`) and a stable
   * `getItemKey` so React keeps each row's DOM node across the reorder. Honors
   * `prefers-reduced-motion`.
   */
  smooth?: boolean;
  /**
   * Lay the items out as a **grid** of this many columns instead of a single
   * column — the virtualizer then windows one *row of N* at a time, so a card
   * grid stays as cheap as a list. Responsive: `{ base: 2, md: 3, lg: 4 }`.
   * Default 1 (a plain list; the grid wrapper isn't rendered at all).
   *
   * `renderItem` still receives the flat item index, and `estimateSize` is the
   * height of one **row**, so bump it when the cells are taller than a row.
   * Cells in a row should be equal height (fixed aspect + clamped text) — the
   * virtualizer measures the row, so a ragged row makes the scroll height jump.
   */
  columns?: VirtualListColumns;
  /** Gap between grid cells, px. Only used when `columns` > 1. Default 12. */
  gap?: number;
  /** The scroll container — MUST be given a bounded height (via `className`). */
  className?: string;
  style?: CSSProperties;
  /** Escape hatch to drive scrolling (e.g. keyboard navigation). */
  apiRef?: Ref<VirtualListHandle>;
}

/**
 * Resolve the responsive `columns` prop against the current viewport. Hooks run
 * unconditionally (one media query per breakpoint) and the widest matching entry
 * wins, mirroring how Tailwind's min-width breakpoints cascade.
 */
function useColumnCount(columns: VirtualListColumns | undefined): number {
  const sm = useMediaQuery('(min-width: 640px)');
  const md = useMediaQuery('(min-width: 768px)');
  const lg = useMediaQuery('(min-width: 1024px)');

  if (columns == null) return 1;
  if (typeof columns === 'number') return Math.max(1, Math.floor(columns));

  const picked =
    (lg ? columns.lg : undefined) ??
    (md ? columns.md ?? columns.sm : undefined) ??
    (sm ? columns.sm : undefined) ??
    columns.base ??
    1;
  return Math.max(1, Math.floor(picked));
}

/** Group a flat list into rows of `size` (`[[a,b],[c,d],[e]]`). */
function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const DefaultLoading = (
  <div className="py-3 text-center mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
    Loading…
  </div>
);

/**
 * A virtualized, optionally infinite list. Only the rows near the viewport are
 * mounted (windowing), heights are measured so rows may vary, and `onEndReached`
 * fires as the tail comes into view so you can lazily append more. The scroll
 * container needs a bounded height — set one with `className` (e.g. `h-96` or
 * `flex-1 min-h-0`).
 *
 * ```tsx
 * <VirtualList
 *   items={rows}
 *   className="h-96"
 *   estimateSize={56}
 *   hasMore={hasMore}
 *   loading={loading}
 *   onEndReached={loadNextPage}
 *   renderItem={(row) => <Row {...row} />}
 * />
 * ```
 *
 * Pass `columns` to lay the same items out as a **card grid** — the items are
 * chunked into rows of N and the virtualizer windows one *row* at a time, so a
 * gallery of a thousand cards costs the same as a list of a thousand rows:
 *
 * ```tsx
 * <VirtualList items={photos} columns={{ base: 2, md: 3, lg: 4 }} estimateSize={220} … />
 * ```
 */
export function VirtualList<T>({
  items,
  renderItem,
  getItemKey,
  estimateSize = 56,
  overscan = 6,
  onEndReached,
  hasMore = false,
  loading = false,
  endThreshold = 4,
  loadingIndicator = DefaultLoading,
  emptyState = null,
  smooth = false,
  columns,
  gap = 12,
  className,
  style,
  apiRef,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(columns);
  const isGrid = columnCount > 1;

  // What the virtualizer actually windows: single items in list mode, rows of
  // `columnCount` items in grid mode. Either way it measures one element per
  // virtual index, so the windowing logic below is identical for both.
  const rows = useMemo(() => (isGrid ? chunk(items, columnCount) : null), [items, columnCount, isGrid]);
  const rowCount = rows ? rows.length : items.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    // In grid mode a row has no identity of its own — key it by its first cell,
    // which is stable as long as the caller's `getItemKey` is.
    getItemKey: getItemKey
      ? (index) =>
          rows
            ? getItemKey(rows[index][0], index * columnCount)
            : getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Only glide rows when the list is idle: during a scroll the same reflow that
  // repositions rows (and lazy height-measurement) would otherwise animate too,
  // reading as lag. On a reorder the component re-renders while not scrolling,
  // so the target offsets change and the transition plays.
  const animate = smooth && !virtualizer.isScrolling;

  useImperativeHandle(
    apiRef,
    () => ({
      // Callers think in item indices (a keyboard cursor walks items, not rows),
      // so map the item to the row that holds it before scrolling.
      scrollToIndex: (index, opts) =>
        virtualizer.scrollToIndex(Math.floor(index / columnCount), { align: opts?.align ?? 'auto' }),
      scrollToTop: () => virtualizer.scrollToOffset(0),
      columnCount,
    }),
    [virtualizer, columnCount],
  );

  // Infinite load: pull the next page as the last rows enter range.
  useEffect(() => {
    if (!onEndReached || !hasMore || loading) return;
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= rowCount - 1 - endThreshold) onEndReached();
  }, [virtualItems, rowCount, hasMore, loading, endThreshold, onEndReached]);

  if (items.length === 0 && !loading) {
    return (
      <div ref={parentRef} className={cn('overflow-y-auto', className)} style={style}>
        {emptyState}
      </div>
    );
  }

  return (
    <div ref={parentRef} className={cn('overflow-y-auto', className)} style={style}>
      <div style={{ position: 'relative', width: '100%', height: virtualizer.getTotalSize() }}>
        {virtualItems.map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            className={cn('ds-virtual-row', animate && 'ds-virtual-row--smooth')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${v.start}px)`,
            }}
          >
            {rows ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  gap,
                  paddingBottom: gap,
                }}
              >
                {rows[v.index].map((item, col) => {
                  const flat = v.index * columnCount + col;
                  return <div key={flat}>{renderItem(item, flat)}</div>;
                })}
              </div>
            ) : (
              renderItem(items[v.index], v.index)
            )}
          </div>
        ))}
      </div>
      {loading && loadingIndicator}
    </div>
  );
}
