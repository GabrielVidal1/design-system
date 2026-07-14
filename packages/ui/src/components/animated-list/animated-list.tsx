import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type Key,
  type ReactNode,
} from 'react';

import { usePrefersReducedMotion } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';

export interface AnimatedListProps<T> {
  /** The rows, in the order they should appear. */
  items: T[];
  /** Render one row. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable key per row — this is what lets the list track a row across a reorder. */
  getItemKey: (item: T, index: number) => Key;
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

  return (
    <div className={className} style={style}>
      {items.map((item, i) => {
        const key = getItemKey(item, i);
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) nodes.current.set(key, el);
              else nodes.current.delete(key);
            }}
            className={cn('ds-animated-row', itemClassName)}
            style={{ willChange: 'transform' }}
          >
            {renderItem(item, i)}
          </div>
        );
      })}
    </div>
  );
}
