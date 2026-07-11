import { useEffect, useRef, useState, type Key, type ReactNode, type Ref } from 'react';

import { cn } from '../../lib/utils';

export interface ProgressiveListItemMeta {
  /** This item was revealed by the animation (appended after mount), not part of
   *  the instantly-shown initial batch. */
  isNew: boolean;
}

export interface ProgressiveListProps<T> {
  items: readonly T[];
  /** Render one item. Wrap animating rows on `meta.isNew`. */
  children: (item: T, index: number, meta: ProgressiveListItemMeta) => ReactNode;
  /** Items revealed per second (constant). @default 4 */
  speed?: number;
  /** Seconds to wait before the first newly-appended item is revealed. @default 0 */
  delay?: number;
  /**
   * Per-item delay, in seconds, before an item appears — overrides the constant
   * `speed` pacing when provided (e.g. derive it from a timestamp gap).
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
 * Reveals a list one item at a time at a constant rate. Items present when the
 * component mounts are shown instantly (see `initialReveal`); items appended
 * later fade/slide in one after another — so a live, append-only list (a chat
 * thread, a log) animates only its genuinely-new rows and never replays history.
 *
 * Pair with {@link ProgressiveText} inside `children` (gated on `meta.isNew`) to
 * both stagger the rows and type out their text.
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

  const [revealed, setRevealed] = useState(initialRef.current);
  const caughtUpRef = useRef(true);

  // Latest values read by the scheduler without forcing it to reschedule.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getDelayRef = useRef(getDelay);
  getDelayRef.current = getDelay;

  useEffect(() => {
    if (skip) {
      if (revealed !== items.length) setRevealed(items.length);
      caughtUpRef.current = true;
      return;
    }
    if (revealed >= items.length) {
      caughtUpRef.current = true;
      return;
    }
    const idx = revealed;
    const gd = getDelayRef.current;
    const base = gd ? gd(itemsRef.current[idx], idx) * 1000 : 1000 / Math.max(0.001, speed);
    // Only the first item of a fresh batch waits the initial `delay`.
    const wait = base + (caughtUpRef.current ? delay * 1000 : 0);
    caughtUpRef.current = false;
    const t = window.setTimeout(
      () => setRevealed((r) => Math.min(r + 1, itemsRef.current.length)),
      wait,
    );
    return () => window.clearTimeout(t);
  }, [revealed, items.length, skip, speed, delay]);

  return (
    <div ref={containerRef} className={className}>
      {items.slice(0, revealed).map((item, i) => {
        const isNew = i >= initialRef.current;
        return (
          <RevealItem key={getKey ? getKey(item, i) : i} animate={isNew && !skip} className={itemClassName}>
            {children(item, i, { isNew })}
          </RevealItem>
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
