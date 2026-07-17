import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type Key,
  type ReactNode,
} from 'react';

import { usePrefersReducedMotion } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';
import type { GroupBy } from '../virtual-list';

/** The header shown for a group when the caller gives no `renderGroupHeader`. */
function defaultGroupHeader(groupKey: Key, count: number): ReactNode {
  return (
    <div className="flex items-baseline gap-2 px-1 pb-1.5 pt-3">
      <span className="mono text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {String(groupKey) || '—'}
      </span>
      <span className="mono text-[11px] tabular-nums text-muted-foreground/60">{count}</span>
    </div>
  );
}

export interface AnimatedListProps<T> {
  /** The rows, in the order they should appear. */
  items: T[];
  /** Render one row. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable key per row — this is what lets the list track a row across a reorder. */
  getItemKey: (item: T, index: number) => Key;
  /**
   * Group the list into labelled sections — a field name (`keyof T`) or a
   * function `(item) => key`. A header is inserted before each group (in
   * first-seen group order); pass the items pre-sorted by the same key so each
   * group is one contiguous block. Headers glide with the rest of the list on a
   * reorder, so keep {@link renderGroupHeader}'s output stable per key.
   */
  groupBy?: GroupBy<T>;
  /** Render a group's header from its key and the items under it. Defaults to a
   * small muted label with the group's count. */
  renderGroupHeader?: (groupKey: Key, items: T[]) => ReactNode;
  /**
   * How long a reorder glide takes, in ms. Default 460 — slow enough to read as
   * a move, quick enough not to feel sluggish.
   */
  duration?: number;
  /** The CSS timing function of the glide. Default an ease-in-out. */
  easing?: string;
  /** Class on the outer list container. */
  className?: string;
  /** Class on each row wrapper. */
  itemClassName?: string;
  /** Extra style on the outer list container. */
  style?: CSSProperties;
  /** Rendered when `items` is empty. */
  emptyState?: ReactNode;
}

/**
 * A **fit-content**, non-virtualized list whose rows glide to their new slot
 * (FLIP) when the list is re-sorted — a running-agents rail whose cards reorder
 * live, a leaderboard, anything short enough to render whole.
 *
 * Unlike {@link VirtualList} (which virtualizes and needs a fixed-height scroll
 * container), this renders every row and takes the height of its content, so it
 * drops straight into normal document flow. It only animates genuine reorders:
 * a row keeps its key and slides; a new key fades in; a removed key just leaves.
 * Honors `prefers-reduced-motion` (rows then teleport).
 *
 * Keys must be stable per row — that is how a card is tracked from its old
 * position to its new one. With index-as-key everything looks like it "moved
 * down one" and nothing glides sensibly.
 */
export function AnimatedList<T>({
  items,
  renderItem,
  getItemKey,
  groupBy,
  renderGroupHeader,
  duration = 460,
  easing = 'cubic-bezier(0.65, 0, 0.35, 1)',
  className,
  itemClassName,
  style,
  emptyState,
}: AnimatedListProps<T>) {
  const reduce = usePrefersReducedMotion();
  // The row DOM node per key, and the top of each row from the previous paint.
  const nodes = useRef(new Map<Key, HTMLElement>());
  const prevTops = useRef(new Map<Key, number>());

  // FLIP: after every commit, compare each surviving row's new top against the
  // one recorded last paint. If it moved, jump it back to where it was (Invert)
  // with the transition off, then on the next frame clear the offset so it
  // Plays to its real slot. Runs synchronously before paint so there's no flash.
  useLayoutEffect(() => {
    if (reduce) {
      // Still record positions so a later un-reduced session animates cleanly.
      const tops = new Map<Key, number>();
      nodes.current.forEach((el, key) => tops.set(key, el.getBoundingClientRect().top));
      prevTops.current = tops;
      return;
    }

    const newTops = new Map<Key, number>();
    const moved: { el: HTMLElement; dy: number }[] = [];

    nodes.current.forEach((el, key) => {
      const top = el.getBoundingClientRect().top;
      newTops.set(key, top);
      const prev = prevTops.current.get(key);
      if (prev != null) {
        const dy = prev - top;
        if (dy) moved.push({ el, dy });
      }
    });

    prevTops.current = newTops;
    if (!moved.length) return;

    // Invert: place each moved row back at its old offset, no transition.
    for (const { el, dy } of moved) {
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
    }

    // Play: next frame, restore the transition and clear the transform so the
    // rows glide from the inverted offset to their natural slot.
    const raf = requestAnimationFrame(() => {
      for (const { el } of moved) {
        el.style.transition = `transform ${duration}ms ${easing}`;
        el.style.transform = '';
      }
    });
    return () => cancelAnimationFrame(raf);
  });

  if (items.length === 0 && emptyState != null) return <>{emptyState}</>;

  // Build the render sequence: with `groupBy`, insert a header before each
  // group (first-seen order) and gather the group's items for the header render.
  // Headers get their own stable key (`__group__:<key>`) so FLIP tracks them
  // across a reorder too.
  const seq: (
    | { kind: 'header'; key: Key; groupKey: Key; groupItems: T[] }
    | { kind: 'item'; key: Key; item: T; index: number }
  )[] = [];
  if (groupBy != null) {
    const groupItemsByKey = new Map<Key, T[]>();
    const order: Key[] = [];
    items.forEach((item, i) => {
      const gk = (() => {
        const k =
          typeof groupBy === 'function'
            ? groupBy(item, i)
            : (item as Record<string, unknown>)[groupBy as string];
        return (k == null ? '' : k) as Key;
      })();
      if (!groupItemsByKey.has(gk)) {
        groupItemsByKey.set(gk, []);
        order.push(gk);
      }
      groupItemsByKey.get(gk)!.push(item);
    });
    let curKey: Key | undefined;
    items.forEach((item, i) => {
      const gk = (() => {
        const k =
          typeof groupBy === 'function'
            ? groupBy(item, i)
            : (item as Record<string, unknown>)[groupBy as string];
        return (k == null ? '' : k) as Key;
      })();
      if (gk !== curKey) {
        curKey = gk;
        seq.push({
          kind: 'header',
          key: `__group__:${String(gk)}`,
          groupKey: gk,
          groupItems: groupItemsByKey.get(gk) ?? [],
        });
      }
      seq.push({ kind: 'item', key: getItemKey(item, i), item, index: i });
    });
  } else {
    items.forEach((item, i) => seq.push({ kind: 'item', key: getItemKey(item, i), item, index: i }));
  }

  return (
    <div className={className} style={style}>
      {seq.map((row) => (
        <div
          key={row.key}
          ref={(el) => {
            if (el) nodes.current.set(row.key, el);
            else nodes.current.delete(row.key);
          }}
          className={cn('ds-animated-row', itemClassName)}
          style={{ willChange: 'transform' }}
        >
          {row.kind === 'header'
            ? (renderGroupHeader
                ? renderGroupHeader(row.groupKey, row.groupItems)
                : defaultGroupHeader(row.groupKey, row.groupItems.length))
            : renderItem(row.item, row.index)}
        </div>
      ))}
    </div>
  );
}
