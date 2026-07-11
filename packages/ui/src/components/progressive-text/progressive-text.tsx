import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

import { cn } from '../../lib/utils';

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
 */
export function ProgressiveText({
  text,
  speed = 40,
  deleteSpeed,
  delay = 0,
  instant = false,
  caret = false,
  as,
  className,
  children,
  onDone,
  onUpdate,
}: ProgressiveTextProps) {
  const skip = instant || reducedMotion();
  const [visible, setVisible] = useState(() => (skip ? text : ''));

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
  const startedRef = useRef(false); // the one-time initial delay has elapsed
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

  // React to text / skip changes: jump when instant, else (re)start the loop.
  useEffect(() => {
    if (skip) {
      visibleRef.current = text;
      setVisible(text);
      return;
    }
    kickRef.current();
  }, [text, skip]);

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
