import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { toEpochMs, useProgressiveSlot } from '../progressive-timeline';

export interface ProgressiveTextMeta {
  /** The visible text has fully caught up to `text`. */
  done: boolean;
  /** Characters are currently being removed (the target diverged from what's shown). */
  deleting: boolean;
}

export interface ProgressiveTextProps {
  /** The full target string to reveal. */
  text: string;
  /** Typing rate in characters per second (constant). @default 40 */
  speed?: number;
  /**
   * Backspacing rate, in characters per second, used when `text` changes to a
   * value that diverges from what's already shown (the component deletes back to
   * the common prefix, then types the rest). @default `speed * 2`
   */
  deleteSpeed?: number;
  /** Seconds to wait before the first character is revealed. @default 0 */
  delay?: number;
  /**
   * Wall-clock anchor (a `Date` or epoch ms) for *when the reveal began*. With
   * it the typewriter is deterministic across remounts: on mount it computes how
   * much of the reveal is already due (`now - timestamp`, minus `delay`) and
   * jumps straight to that character before continuing to type the rest. So a
   * message that started typing 2s ago shows 2s of progress the instant it
   * re-mounts — a page revisit resumes the animation at the right point instead
   * of replaying it from the first character. Omit for the classic behaviour
   * (the reveal starts from empty whenever the component mounts). Inside a
   * {@link ProgressiveList}/{@link ProgressiveTimelineSlot} the slot's own
   * anchor is used automatically; an explicit `timestamp` here overrides it.
   */
  timestamp?: Date | number;
  /** Render the full text at once with no animation (e.g. pre-existing content). */
  instant?: boolean;
  /** Show a blinking block caret while animating (default renderer only). */
  caret?: boolean;
  /** Wrapper element type. Use `'div'` when `children` returns block content. @default 'span' */
  as?: ElementType;
  className?: string;
  /**
   * Custom renderer for the currently-revealed substring — pass this to wrap the
   * partial text (e.g. a Markdown renderer or a styled caret). When omitted the
   * raw string is rendered.
   */
  children?: (visible: string, meta: ProgressiveTextMeta) => ReactNode;
  /** Fired once the visible text catches up to `text`. */
  onDone?: () => void;
  /** Fired on every revealed/removed character with the new visible string. */
  onUpdate?: (visible: string) => void;
}

/** Length of the shared leading run of two strings. */
function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveals `text` one character at a time at a constant rate — a typewriter.
 *
 * The animation is driven by the *difference* between what's shown and the
 * current `text`, so it composes with streaming and live edits:
 * - text grows (a message streams in) → it types the appended characters;
 * - text changes to a divergent value (an aggregated title updates) → it deletes
 *   from the end back to the common prefix, then types the new tail.
 *
 * `speed`/`deleteSpeed`/`delay` are the tunables. `instant` (or the user's
 * `prefers-reduced-motion`) renders the full string immediately. Content that was
 * already present when the component mounted should pass `instant` so history
 * isn't re-typed; only freshly-arrived text needs to animate.
 *
 * Pass a `timestamp` to anchor the reveal to wall-clock time: on remount it
 * resumes at the character it *should* be at (given how long ago the reveal
 * began), so the animation stays consistent across page changes.
 */
export function ProgressiveText({
  text,
  speed = 40,
  deleteSpeed,
  delay = 0,
  timestamp,
  instant = false,
  caret = false,
  as,
  className,
  children,
  onDone,
  onUpdate,
}: ProgressiveTextProps) {
  const skip = instant || reducedMotion();

  // Timeline slot (a no-op when not inside a ProgressiveList): hold the reveal
  // until it's this slot's turn, and report how long the reveal takes so the
  // next list element is delayed by exactly this inner animation.
  const slot = useProgressiveSlot();
  const active = slot.active;
  const slotRef = useRef(slot);
  slotRef.current = slot;

  // Wall-clock catch-up: how many characters are *already* due at mount, from an
  // explicit `timestamp` or (failing that) the timeline slot's own anchor. This
  // is what makes the reveal resume mid-flight after a remount instead of
  // starting empty. Computed once, at mount — later prop changes type forward.
  const catchUpLen = useRef<number>(-1);
  if (catchUpLen.current < 0) {
    const anchor = toEpochMs(timestamp);
    const elapsed = anchor != null ? Math.max(0, Date.now() - anchor) : slot.elapsedMs;
    const past = Math.max(0, elapsed - Math.max(0, delay) * 1000);
    const interval = 1000 / Math.max(1, speed);
    catchUpLen.current = skip ? 0 : Math.min(text.length, Math.floor(past / interval));
  }

  const [visible, setVisible] = useState(() => (skip ? text : text.slice(0, catchUpLen.current)));

  // Latest values read by the rAF loop, so prop changes never restart it.
  const targetRef = useRef(text);
  targetRef.current = text;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const cfgRef = useRef({ speed, deleteSpeed, delay, skip });
  cfgRef.current = { speed, deleteSpeed, delay, skip };
  const cbRef = useRef({ onDone, onUpdate });
  cbRef.current = { onDone, onUpdate };

  const rafRef = useRef(0);
  const runningRef = useRef(false);
  // The one-time initial delay has elapsed. A catch-up jump already covered it,
  // so an anchored reveal that started in the past never re-waits the lead-in.
  const startedRef = useRef(catchUpLen.current > 0);
  const kickRef = useRef<() => void>(() => {});

  // The persistent animation loop — created once, reads everything via refs and
  // is cancelled only on unmount, so a growing `text` never resets its progress.
  useEffect(() => {
    let lastTs = 0;
    let acc = 0;
    let delayLeft = 0;

    const frame = (ts: number) => {
      if (lastTs === 0) {
        lastTs = ts;
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      const dt = ts - lastTs;
      lastTs = ts;

      // Burn the one-time initial delay before the first character.
      if (!startedRef.current) {
        delayLeft -= dt;
        if (delayLeft > 0) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }
        startedRef.current = true;
      }

      acc += dt;
      const { speed: sp, deleteSpeed: dsp } = cfgRef.current;
      const typeIv = 1000 / Math.max(1, sp);
      const delIv = 1000 / Math.max(1, dsp ?? sp * 2);

      let changed = false;
      // Emit as many characters as the elapsed time allows (frame-rate independent).
      for (let guard = 0; guard < 2000; guard++) {
        const cur = visibleRef.current;
        const tgt = targetRef.current;
        if (cur === tgt) break;
        const deleting = cur.length > commonPrefixLen(cur, tgt);
        if (acc < (deleting ? delIv : typeIv)) break;
        acc -= deleting ? delIv : typeIv;
        visibleRef.current = deleting ? cur.slice(0, -1) : tgt.slice(0, cur.length + 1);
        changed = true;
      }

      if (changed) {
        setVisible(visibleRef.current);
        cbRef.current.onUpdate?.(visibleRef.current);
      }

      if (visibleRef.current === targetRef.current) {
        runningRef.current = false;
        cbRef.current.onDone?.();
        return; // idle — the next text change re-kicks the loop
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    kickRef.current = () => {
      if (cfgRef.current.skip || runningRef.current) return;
      if (visibleRef.current === targetRef.current) return;
      runningRef.current = true;
      lastTs = 0;
      acc = 0;
      delayLeft = startedRef.current ? 0 : cfgRef.current.delay * 1000;
      rafRef.current = requestAnimationFrame(frame);
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to text / skip / activation: jump when instant, else — once it's this
  // slot's turn — report the reveal duration and (re)start the loop.
  useEffect(() => {
    if (skip) {
      visibleRef.current = text;
      setVisible(text);
      slotRef.current.finish(); // instant content hands the timeline off at once
      return;
    }
    if (!active) return; // wait until this slot is the head of the timeline
    // Constant rate ⇒ the reveal takes delay + (length / speed). Report the
    // *remaining* time (a catch-up jump already consumed part of it), so an
    // anchored ProgressiveList delays the next item by only what's left to type.
    const interval = 1000 / Math.max(1, speed);
    const remaining = Math.max(0, text.length - visibleRef.current.length) * interval;
    const lead = startedRef.current ? 0 : Math.max(0, delay) * 1000;
    slotRef.current.report(lead + remaining);
    kickRef.current();
  }, [text, skip, active, speed, delay]);

  const meta: ProgressiveTextMeta = {
    done: visible === text,
    deleting: visible.length > commonPrefixLen(visible, text),
  };

  const Wrapper = (as ?? 'span') as ElementType;
  return (
    <Wrapper className={className}>
      {children ? children(visible, meta) : visible}
      {caret && !children && !meta.done && (
        <span aria-hidden className={cn('ml-px inline-block animate-pulse')}>
          ▍
        </span>
      )}
    </Wrapper>
  );
}
