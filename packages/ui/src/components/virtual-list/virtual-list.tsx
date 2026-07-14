import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
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
   * instead of teleporting. Every row that moves glides — the ones falling to
   * make room as much as the one climbing past them. Only animates while the
   * list is idle — scrolling and lazy height-measurement never animate. Rows
   * travelling *up* are stacked over rows travelling down, so a row that
   * overtakes its neighbours passes visibly in front of them rather than
   * sliding underneath. Requires the stylesheet
   * `@gabvdl/ui/virtual-list.css` (bundled in `styles.css`) and a stable
   * `getItemKey` so React keeps each row's DOM node across the reorder. Honors
   * `prefers-reduced-motion`.
   */
  smooth?: boolean;
  /**
   * How long a `smooth` reorder takes, in ms. Default 520 — slow enough to read
   * a row overtaking its neighbours. Drop it (200–300) for a snappier list, or
   * raise it for a more deliberate glide.
   */
  smoothDuration?: number;
  /**
   * The CSS timing function of a `smooth` reorder. Default is an ease-in-out
   * (`cubic-bezier(0.65, 0, 0.35, 1)`): the row eases away from its old slot and
   * settles into the new one, which reads as a deliberate move rather than a
   * snap. Any CSS `transition-timing-function` value works.
   */
  smoothEasing?: string;
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
  smoothDuration = 520,
  smoothEasing = 'cubic-bezier(0.65, 0, 0.35, 1)',
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

  // Which way each row is currently travelling, so the ones climbing can be
  // stacked over the ones falling — otherwise two rows swapping places cross
  // in an arbitrary DOM order and the mover can slide *under* the row it is
  // overtaking, which hides the whole point of the animation.
  //
  // The virtualizer gives us each row's target offset; the previous render's
  // offset for the same key is the slot it is gliding *from*. A row keeps its
  // layer for the duration of the transition (rather than only for the single
  // render that moved it) so it stays on top the whole way across; the timer is
  // rescheduled on every move, and cleared when the row settles.
  const prevOffsets = useRef(new Map<Key, number>());
  const [risingKeys, setRisingKeys] = useState<ReadonlySet<Key>>(() => new Set());
  const risingTimers = useRef(new Map<Key, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!animate) {
      // Keep the offsets fresh while scrolling so the first idle render after a
      // scroll compares against where rows actually are, not where they were
      // before the scroll — otherwise every row reads as a huge "move".
      const offsets = new Map<Key, number>();
      for (const v of virtualItems) offsets.set(v.key, v.start);
      prevOffsets.current = offsets;
      return;
    }

    // Compare each row against the list's OVERALL drift, not against zero: when
    // a row above the window is lazily measured to its real height, every offset
    // below it shifts by the same few pixels. Judged absolutely, that uniform
    // shift makes the entire window look like it is moving (up or down) and
    // every row gets lifted, which lifts nothing in relative terms. The median
    // delta is that common shift, so subtracting it leaves only the rows that
    // actually changed rank — the ones we want on top.
    const offsets = new Map<Key, number>();
    const deltas: { key: Key; delta: number }[] = [];
    for (const v of virtualItems) {
      offsets.set(v.key, v.start);
      const before = prevOffsets.current.get(v.key);
      // A row with no previous offset just entered the window — it has nowhere
      // to glide from, so it isn't moving in either direction.
      if (before !== undefined) deltas.push({ key: v.key, delta: v.start - before });
    }
    prevOffsets.current = offsets;

    if (deltas.length === 0) return;

    const sorted = deltas.map((d) => d.delta).sort((a, b) => a - b);
    const drift = sorted[Math.floor(sorted.length / 2)];

    // A row is climbing only if it moved up on BOTH counts: in absolute terms
    // (it really did travel up the viewport) and relative to the drift (it
    // out-ran the common shift, i.e. it changed rank). Requiring both is what
    // keeps a first-paint height measurement — where rows below the first one
    // all jump down by different amounts — from lifting the rows that merely
    // moved *least*. The epsilon ignores sub-pixel jitter so rows that are
    // visually standing still never flicker between layers.
    const rising = deltas
      .filter((d) => d.delta < -1 && d.delta - drift < -1)
      .map((d) => d.key);

    if (rising.length === 0) return;

    setRisingKeys((prev) => {
      const next = new Set(prev);
      for (const key of rising) next.add(key);
      return next;
    });

    for (const key of rising) {
      clearTimeout(risingTimers.current.get(key));
      risingTimers.current.set(
        key,
        setTimeout(() => {
          risingTimers.current.delete(key);
          setRisingKeys((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, smoothDuration),
      );
    }
  }, [virtualItems, animate, smoothDuration]);

  // Drop the timers on unmount so a list torn down mid-reorder doesn't set state
  // on a dead component.
  useEffect(() => {
    const timers = risingTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

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

  // Paint the rows in a STABLE DOM order rather than in rank order.
  //
  // The virtualizer hands back `virtualItems` sorted by index, so on a re-sort
  // the same row arrives at a different array position and React reorders the
  // DOM nodes to match (`insertBefore`). Re-inserting an element throws away the
  // transform it was interpolating from, so its transition is dropped and it
  // teleports — which is why, before this, only *some* rows glided and the rest
  // snapped to their new slot.
  //
  // Rows are absolutely positioned and placed purely by `transform`, so DOM
  // order has no effect on layout — only on paint order, and that is what the
  // `--rising` z-index above is for. Keeping each row pinned to a fixed sibling
  // position means React only ever updates its `style`, and every row (climbing
  // AND falling) interpolates.
  //
  // A row's slot is remembered across renders, so a key that is still in the
  // window keeps the sibling position it already occupies; keys that scroll out
  // free their slot for a newcomer. Sorting by index would be simpler but is
  // exactly what we must avoid — that IS the rank order.
  const domSlots = useRef(new Map<Key, number>());
  const orderedItems = useMemo(() => {
    if (!smooth) return virtualItems;

    // Work on a copy and only publish it at the end: a `useMemo` body must be
    // pure, or StrictMode's double-invoke would assign each newcomer two
    // different slots.
    const slots = new Map(domSlots.current);
    const live = new Set(virtualItems.map((v) => v.key));
    for (const key of [...slots.keys()]) if (!live.has(key)) slots.delete(key);

    const taken = new Set(slots.values());
    let free = 0;
    for (const v of virtualItems) {
      if (slots.has(v.key)) continue;
      while (taken.has(free)) free++;
      slots.set(v.key, free);
      taken.add(free);
    }
    domSlots.current = slots;

    return [...virtualItems].sort((a, b) => (slots.get(a.key) ?? 0) - (slots.get(b.key) ?? 0));
  }, [virtualItems, smooth]);

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
        {orderedItems.map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            className={cn(
              'ds-virtual-row',
              animate && 'ds-virtual-row--smooth',
              risingKeys.has(v.key) && 'ds-virtual-row--rising',
            )}
            style={
              {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${v.start}px)`,
                '--ds-virtual-row-duration': `${smoothDuration}ms`,
                '--ds-virtual-row-ease': smoothEasing,
              } as CSSProperties
            }
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
