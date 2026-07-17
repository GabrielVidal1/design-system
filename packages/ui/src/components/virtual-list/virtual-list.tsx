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

/**
 * How to group a list into labelled sections. Either the **name of a field** to
 * group by (`'version'` — the common case, `keyof T`) or a function deriving a
 * group key from each item. Items are partitioned in their incoming order, so
 * to see groups as contiguous blocks the caller sorts by the same key first;
 * each group keeps the order it was given. See {@link VirtualListProps.groupBy}.
 */
export type GroupBy<T> = keyof T | ((item: T, index: number) => Key);

/** One header in the flattened, group-aware render sequence. */
interface HeaderRow {
  kind: 'header';
  /** The group's key — passed to `renderGroupHeader`. */
  groupKey: Key;
  /** How many items sit under this header. */
  count: number;
}
/** One item in the flattened render sequence (`index` is its flat item index). */
interface ItemRow<T> {
  kind: 'item';
  item: T;
  index: number;
  groupKey: Key;
}
type FlatRow<T> = HeaderRow | ItemRow<T>;

/** Resolve a {@link GroupBy} against one item. */
function groupKeyOf<T>(groupBy: GroupBy<T>, item: T, index: number): Key {
  if (typeof groupBy === 'function') return groupBy(item, index);
  const v = (item as Record<string, unknown>)[groupBy as string];
  return (v == null ? '' : (v as Key)) as Key;
}

/**
 * Flatten `items` into a header/item sequence: first-seen group order, each
 * group's items kept in their incoming order. A run of the same key stays one
 * group even if it recurs later (that only happens when the caller hasn't sorted
 * by the key — grouping reads best on a pre-sorted list, so we don't re-sort it
 * for them and change what they asked to show).
 */
function flatten<T>(items: T[], groupBy: GroupBy<T>): FlatRow<T>[] {
  const out: FlatRow<T>[] = [];
  const headerAt = new Map<Key, HeaderRow>();
  let curKey: Key | undefined;
  items.forEach((item, index) => {
    const gk = groupKeyOf(groupBy, item, index);
    if (gk !== curKey || !headerAt.has(gk)) {
      const header: HeaderRow = { kind: 'header', groupKey: gk, count: 0 };
      headerAt.set(gk, header);
      out.push(header);
      curKey = gk;
    }
    headerAt.get(gk)!.count += 1;
    out.push({ kind: 'item', item, index, groupKey: gk });
  });
  return out;
}

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
  /**
   * Group the list into labelled sections. Pass the **name of a field**
   * (`'version'`, i.e. `keyof T`) or a function `(item) => key`; consecutive
   * items sharing a key fall under one header, in first-seen group order. A
   * header row is inserted before each group and rendered by
   * {@link renderGroupHeader}. The list still virtualizes — headers and items
   * share one windowed sequence, so a thousand grouped rows cost the same as a
   * thousand flat ones.
   *
   * Group by whatever the items already carry; **sort the array by the same key
   * first** so each group is one contiguous block (this doesn't reorder for
   * you — it groups what it's given). Grouping is a **list-mode** feature: it is
   * ignored when `columns` > 1.
   */
  groupBy?: GroupBy<T>;
  /**
   * Render a group's header from its key and the items under it. Defaults to a
   * small muted label showing the key and the group's count. Only used when
   * {@link groupBy} is set.
   */
  renderGroupHeader?: (groupKey: Key, items: T[]) => ReactNode;
  /** First-paint height guess for a group header, px. Default 32. */
  groupHeaderSize?: number;
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

/** The header shown for a group when the caller gives no `renderGroupHeader`. */
function defaultGroupHeader(groupKey: Key, count: number): ReactNode {
  const label = String(groupKey) || '—';
  return (
    <div className="flex items-baseline gap-2 px-1 pb-1.5 pt-3">
      <span className="mono text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span className="mono text-[11px] tabular-nums text-muted-foreground/60">{count}</span>
    </div>
  );
}

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
  groupBy,
  renderGroupHeader,
  groupHeaderSize = 32,
  className,
  style,
  apiRef,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(columns);
  const isGrid = columnCount > 1;
  // Grouping is a list-mode feature — a grid can't interleave full-width headers
  // between chunked rows, so `columns` wins and grouping is ignored there.
  const grouped = !isGrid && groupBy != null;

  // What the virtualizer actually windows, in one of three modes:
  //   grid    — rows of `columnCount` items (grouping ignored)
  //   grouped — a header/item sequence (headers interleaved between groups)
  //   flat    — one item per row
  // Either way it measures one element per virtual index, so the windowing logic
  // below is identical for all three.
  const rows = useMemo(() => (isGrid ? chunk(items, columnCount) : null), [items, columnCount, isGrid]);
  const flatRows = useMemo(
    () => (grouped ? flatten(items, groupBy as GroupBy<T>) : null),
    [grouped, items, groupBy],
  );
  const rowCount = rows ? rows.length : flatRows ? flatRows.length : items.length;

  // A group header measures taller/shorter than an item — tell the virtualizer
  // so its first-paint offsets don't jump when real heights land.
  const sizeAt = (index: number) =>
    flatRows && flatRows[index]?.kind === 'header' ? groupHeaderSize : estimateSize;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: sizeAt,
    overscan,
    // Every virtual index needs a stable key. Grid mode keys a row by its first
    // cell; grouped mode keys a header by its group and an item by the caller's
    // key; flat mode defers to the caller's key.
    getItemKey: (index) => {
      if (rows) {
        return getItemKey ? getItemKey(rows[index][0], index * columnCount) : index;
      }
      if (flatRows) {
        const r = flatRows[index];
        if (r.kind === 'header') return `__group__:${String(r.groupKey)}`;
        return getItemKey ? getItemKey(r.item, r.index) : r.index;
      }
      return getItemKey ? getItemKey(items[index], index) : index;
    },
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

  // Item flat-index → virtual row index. In flat mode they're equal; in grid
  // mode it's `index / columnCount`; in grouped mode headers shift every item
  // down, so we resolve it from the flattened sequence.
  const itemToRow = useMemo(() => {
    if (!flatRows) return null;
    const m = new Map<number, number>();
    flatRows.forEach((r, rowIdx) => {
      if (r.kind === 'item') m.set(r.index, rowIdx);
    });
    return m;
  }, [flatRows]);

  useImperativeHandle(
    apiRef,
    () => ({
      // Callers think in item indices (a keyboard cursor walks items, not rows),
      // so map the item to the row that holds it before scrolling.
      scrollToIndex: (index, opts) => {
        const row = itemToRow ? itemToRow.get(index) ?? index : Math.floor(index / columnCount);
        virtualizer.scrollToIndex(row, { align: opts?.align ?? 'auto' });
      },
      scrollToTop: () => virtualizer.scrollToOffset(0),
      columnCount,
    }),
    [virtualizer, columnCount, itemToRow],
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
            ) : flatRows ? (
              (() => {
                const r = flatRows[v.index];
                if (r.kind === 'header') {
                  const groupItems = flatRows
                    .filter((x): x is ItemRow<T> => x.kind === 'item' && x.groupKey === r.groupKey)
                    .map((x) => x.item);
                  return renderGroupHeader
                    ? renderGroupHeader(r.groupKey, groupItems)
                    : defaultGroupHeader(r.groupKey, r.count);
                }
                return renderItem(r.item, r.index);
              })()
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
