import {
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type Key,
  type ReactNode,
  type Ref,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '../../lib/utils';

/** Imperative handle exposed via {@link VirtualListProps.apiRef}. */
export interface VirtualListHandle {
  scrollToIndex: (index: number, opts?: { align?: 'auto' | 'start' | 'center' | 'end' }) => void;
  scrollToTop: () => void;
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
   * instead of teleporting. Only animates while the list is idle — scrolling and
   * lazy height-measurement never animate. Requires the stylesheet
   * `@gabvdl/ui/virtual-list.css` (bundled in `styles.css`) and a stable
   * `getItemKey` so React keeps each row's DOM node across the reorder. Honors
   * `prefers-reduced-motion`.
   */
  smooth?: boolean;
  /** The scroll container — MUST be given a bounded height (via `className`). */
  className?: string;
  style?: CSSProperties;
  /** Escape hatch to drive scrolling (e.g. keyboard navigation). */
  apiRef?: Ref<VirtualListHandle>;
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
  className,
  style,
  apiRef,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined,
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
      scrollToIndex: (index, opts) => virtualizer.scrollToIndex(index, { align: opts?.align ?? 'auto' }),
      scrollToTop: () => virtualizer.scrollToOffset(0),
    }),
    [virtualizer],
  );

  // Infinite load: pull the next page as the last rows enter range.
  useEffect(() => {
    if (!onEndReached || !hasMore || loading) return;
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= items.length - 1 - endThreshold) onEndReached();
  }, [virtualItems, items.length, hasMore, loading, endThreshold, onEndReached]);

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
            {renderItem(items[v.index], v.index)}
          </div>
        ))}
      </div>
      {loading && loadingIndicator}
    </div>
  );
}
