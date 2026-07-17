import { useCallback, useEffect, useRef, useState, type Key, type ReactNode, type Ref } from 'react';

import { normalizeCatchUp, type CatchUpConfig } from '../../lib/catch-up';
import { cn } from '../../lib/utils';
import { ProgressiveTimelineSlot, toEpochMs } from '../progressive-timeline';

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
  /**
   * Wall-clock anchor (a `Date` or epoch ms) for *when the reveal sequence
   * began* — the first newly-appended row. With it the reveal is deterministic
   * across remounts: on mount the list fast-forwards past every row whose slot
   * (by the fallback/`getDelay` pacing) is already due, and hands each still-
   * animating row a back-dated anchor so its own progressive children resume
   * mid-flight too. A revisited page therefore shows the sequence at the point
   * it should be at, not replayed from the top. Omit for the classic behaviour
   * (the reveal starts whenever the component mounts). Only the fallback pacing
   * is used to place the anchor; rows whose real inner animation runs longer
   * than their fallback still finish typing after the jump.
   */
  timestamp?: Date | number;
  /**
   * Smoothly *play through* the anchored backlog instead of snapping past it.
   * With a `timestamp` far in the past the list would fast-forward past every
   * due row at once — skipping the animation. `catchUp` instead leaves the rows
   * within its window to reveal on an ease-in/ease-out ramp (and forwards the
   * config to each row's inner {@link ProgressiveText}), so a revisit shows a
   * brief "whoosh to now". A number is the ramp duration in ms; the object form
   * (`{ ms, window?, easing? }`) tunes it. `0` / omitted keeps the instant jump.
   */
  catchUp?: CatchUpConfig;
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
 *
 * Pass a `timestamp` to anchor the reveal to wall-clock time: on remount the
 * list resumes at the row it should be at (and back-dates each animating row's
 * anchor), so the sequence stays consistent across page changes.
 */
export function ProgressiveList<T>({
  items,
  children,
  speed = 4,
  delay = 0,
  getDelay,
  timestamp,
  catchUp,
  getKey,
  initialReveal,
  instant = false,
  containerRef,
  className,
  itemClassName,
}: ProgressiveListProps<T>) {
  const skip = instant || reducedMotion();
  const catchUpNorm = normalizeCatchUp(catchUp);

  // Fixed at mount: how many items were "already there" (shown instantly).
  const initialRef = useRef<number>(-1);
  if (initialRef.current < 0) {
    initialRef.current = skip ? items.length : Math.min(initialReveal ?? items.length, items.length);
  }
  const initialCount = initialRef.current;

  // Wall-clock anchor for the first animating row (epoch ms), fixed at mount.
  const anchorRef = useRef<number | null>(null);
  const anchorInit = useRef(false);
  if (!anchorInit.current) {
    anchorInit.current = true;
    anchorRef.current = skip ? null : toEpochMs(timestamp);
  }
  const anchor = anchorRef.current;

  // Fallback duration (ms) the sequence assigns to the i-th animating row when
  // placing wall-clock anchors — the same pacing the live timeline falls back to.
  const fallbackMsOf = useCallback(
    (item: T, index: number) => (getDelay ? getDelay(item, index) * 1000 : 1000 / Math.max(0.001, speed)),
    [getDelay, speed],
  );

  // Back-dated catch-up: with an anchor, fast-forward past rows whose fallback
  // window has already elapsed, so a revisited page starts partway in. The head
  // row that lands in the current window keeps its remaining animation.
  //
  // With `catchUp`, don't fast-forward all the way: leave the rows whose fallback
  // windows fall within the last `catchUp.window` ms to reveal on the eased ramp
  // (each gets a back-dated `startedAt` + the `catchUp` config, so its inner
  // ProgressiveText eases too) — a smooth "whoosh to now" instead of a snap.
  const initialRevealed = useRef<number>(-1);
  if (initialRevealed.current < 0) {
    if (anchor == null) {
      initialRevealed.current = initialCount;
    } else {
      let elapsed = Math.max(0, Date.now() - anchor) - Math.max(0, delay) * 1000;
      let r = initialCount;
      while (r < items.length && elapsed > 0) {
        elapsed -= fallbackMsOf(items[r], r);
        if (elapsed <= 0) break;
        r++;
      }
      let firstShown = Math.min(r, items.length);
      // Pull the head back over the eased window so those rows animate.
      if (catchUpNorm.ms > 0 && catchUpNorm.window > 0) {
        let budget = catchUpNorm.window;
        while (firstShown > initialCount && budget > 0) {
          budget -= fallbackMsOf(items[firstShown - 1], firstShown - 1);
          firstShown--;
        }
      }
      initialRevealed.current = firstShown;
    }
  }

  const [revealed, setRevealed] = useState(initialRevealed.current);
  // How many of the animating slots ([initialCount, revealed)) have handed off.
  // Catch-up back-dates the head, so every skipped-over row is already complete.
  const [completed, setCompleted] = useState(Math.max(0, initialRevealed.current - 1 - initialCount));
  const handleComplete = useCallback(() => setCompleted((c) => c + 1), []);

  // Latest values read by the reveal scheduler without forcing it to reschedule.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getDelayRef = useRef(getDelay);
  getDelayRef.current = getDelay;

  // Cumulative fallback offset (ms) of animating row i from the anchor — used to
  // back-date each slot's own wall-clock start so its inner animation resumes at
  // the right point too. Only meaningful when `anchor` is set.
  const startedAtOf = (index: number): number | undefined => {
    if (anchor == null) return undefined;
    let off = Math.max(0, delay) * 1000;
    for (let j = initialCount; j < index; j++) off += fallbackMsOf(itemsRef.current[j], j);
    return anchor + off;
  };

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
    // (An anchored list already fast-forwarded past the lead-in at mount.)
    const wait = animatingShown === 0 && anchor == null ? delay * 1000 : 0;
    const t = window.setTimeout(
      () => setRevealed((r) => Math.min(r + 1, itemsRef.current.length)),
      wait,
    );
    return () => window.clearTimeout(t);
  }, [revealed, completed, items.length, skip, delay, initialCount, anchor]);

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
        return (
          <ProgressiveTimelineSlot
            key={key}
            active={i === headIndex}
            fallbackMs={fallbackMsOf(item, i)}
            startedAt={startedAtOf(i)}
            catchUp={anchor != null ? catchUp : undefined}
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
