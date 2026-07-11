import { useCallback, useEffect, useRef, useState, type Key, type ReactNode, type Ref } from 'react';

import { cn } from '../../lib/utils';
import { ProgressiveTimelineSlot } from '../progressive-timeline';

export interface ProgressiveListItemMeta {
  /** This item was revealed by the animation (appended after mount), not part of
   *  the instantly-shown initial batch. */
  isNew: boolean;
}

export interface ProgressiveListProps<T> {
  items: readonly T[];
  /** Render one item. Wrap animating rows on `meta.isNew`. */
  children: (item: T, index: number, meta: ProgressiveListItemMeta) => ReactNode;
  /**
   * Fallback pace for items that don't drive the timeline themselves: rows with
   * no progressive child hand off this many items per second. Rows that *do*
   * contain a progressive element (e.g. {@link ProgressiveText}) instead hold
   * the timeline until their own inner animation reports done. @default 4
   */
  speed?: number;
  /** Seconds to wait before the first newly-appended item is revealed. @default 0 */
  delay?: number;
  /**
   * Per-item fallback delay, in seconds, before the timeline advances past it —
   * overrides the `speed`-derived interval for rows that don't report a duration.
   */
  getDelay?: (item: T, index: number) => number;
  /** Stable key per item. @default the index */
  getKey?: (item: T, index: number) => Key;
  /**
   * How many leading items to show instantly on mount, with no animation.
   * @default items.length — an already-populated list appears at once and only
   * items appended *after* mount animate in. Pass `0` to replay the whole list.
   */
  initialReveal?: number;
  /** Reveal everything immediately, no animation. */
  instant?: boolean;
  /** Ref forwarded to the wrapper `<div>` (e.g. for scroll / query access). */
  containerRef?: Ref<HTMLDivElement>;
  className?: string;
  /** Extra classes on the reveal wrapper of each animating item. */
  itemClassName?: string;
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveals a list one item at a time, in order, and — crucially — waits for each
 * item's *inner* animation before revealing the next. It does this through a
 * timeline context ({@link useProgressiveSlot}): each animating row is wrapped in
 * a slot; the row's progressive children (e.g. {@link ProgressiveText}) report
 * how long they animate, and the next row only appears once that finishes. Rows
 * without any progressive child fall back to a constant `speed`.
 *
 * Items present when the component mounts are shown instantly (see
 * `initialReveal`); only items appended later run through the timeline — so a
 * live, append-only feed animates only its genuinely-new rows and never replays
 * history.
 */
export function ProgressiveList<T>({
  items,
  children,
  speed = 4,
  delay = 0,
  getDelay,
  getKey,
  initialReveal,
  instant = false,
  containerRef,
  className,
  itemClassName,
}: ProgressiveListProps<T>) {
  const skip = instant || reducedMotion();

  // Fixed at mount: how many items were "already there" (shown instantly).
  const initialRef = useRef<number>(-1);
  if (initialRef.current < 0) {
    initialRef.current = skip ? items.length : Math.min(initialReveal ?? items.length, items.length);
  }
  const initialCount = initialRef.current;

  const [revealed, setRevealed] = useState(initialCount);
  // How many of the animating slots ([initialCount, revealed)) have handed off.
  const [completed, setCompleted] = useState(0);
  const handleComplete = useCallback(() => setCompleted((c) => c + 1), []);

  // Latest values read by the reveal scheduler without forcing it to reschedule.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getDelayRef = useRef(getDelay);
  getDelayRef.current = getDelay;

  // Advance the timeline: reveal the next item only once every already-revealed
  // animating slot has completed its inner animation (or its fallback elapsed).
  useEffect(() => {
    if (skip) {
      if (revealed !== items.length) setRevealed(items.length);
      return;
    }
    if (revealed >= items.length) return;
    const animatingShown = revealed - initialCount;
    if (completed < animatingShown) return; // the current head is still animating
    // First item of a fresh batch waits the lead-in `delay`; the rest chain off
    // completions, so their spacing comes from each row's own inner animation.
    const wait = animatingShown === 0 ? delay * 1000 : 0;
    const t = window.setTimeout(
      () => setRevealed((r) => Math.min(r + 1, itemsRef.current.length)),
      wait,
    );
    return () => window.clearTimeout(t);
  }, [revealed, completed, items.length, skip, delay, initialCount]);

  const headIndex = revealed - 1; // the one currently animating

  return (
    <div ref={containerRef} className={className}>
      {items.slice(0, revealed).map((item, i) => {
        const key = getKey ? getKey(item, i) : i;
        const isNew = i >= initialCount;
        const content = children(item, i, { isNew });

        // Historical / instant rows: no timeline slot, a bare keyed child so the
        // container's own spacing (e.g. space-y) still targets the real row.
        if (!isNew || skip) {
          return (
            <RevealItem key={key} animate={false} className={itemClassName}>
              {content}
            </RevealItem>
          );
        }

        // Animating rows: a timeline slot gates the next reveal on this row's
        // inner animation (its progressive children report their duration).
        const gd = getDelayRef.current;
        const fallbackMs = gd ? gd(item, i) * 1000 : 1000 / Math.max(0.001, speed);
        return (
          <ProgressiveTimelineSlot
            key={key}
            active={i === headIndex}
            fallbackMs={fallbackMs}
            onComplete={handleComplete}
          >
            <RevealItem animate className={itemClassName}>
              {content}
            </RevealItem>
          </ProgressiveTimelineSlot>
        );
      })}
    </div>
  );
}

/** Fades/slides its child in on mount; a passthrough when `animate` is false. */
function RevealItem({
  animate,
  className,
  children,
}: {
  animate: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  if (!animate) return <>{children}</>;
  return (
    <div
      className={cn(
        'transition-all duration-300 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
