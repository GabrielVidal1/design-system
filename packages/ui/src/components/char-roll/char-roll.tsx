import * as React from 'react';

import { usePrefersReducedMotion } from '../../hooks';
import { cn } from '../../lib/utils';

const DIGITS = '0123456789';

export interface CharRollProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The string (or number, stringified) to display. Changing it rolls each changed character. */
  value: string | number;
  /** Roll duration per character, ms. More steps in the same time = a faster spin. @default 500 */
  duration?: number;
  /**
   * Delay between successive changed characters, ms, rippling from the END of
   * the string toward the start (the rightmost changed char moves first, like
   * the fast wheel of a tally counter). `0` rolls everything at once. @default 30
   */
  stagger?: number;
  /**
   * Extra full revolutions through the digit wheel on change. The rightmost
   * *changed* digit spins `maxRotations` extra turns, the next changed one to
   * its left one fewer, and so on — simulating the accelerated low-order wheels
   * of a mechanical counter. Non-digit characters always flip in one step.
   * @default 0
   */
  maxRotations?: number;
  /**
   * How the old and new strings pair up when their lengths differ. `'end'`
   * (default) aligns the last characters — right for numbers, where the ones
   * digit stays the ones digit ("999" → "1000"). `'start'` aligns the first
   * characters — usually right for words. @default 'end'
   */
  align?: 'start' | 'end';
}

interface CellSpec {
  /** Character now shown (resting state). */
  char: string;
  /** Character it rolls in from ('' when the cell is new). */
  from: string;
  /** Extra full digit revolutions for this cell. */
  turns: number;
  /** ms before this cell starts rolling. */
  delay: number;
}

/**
 * Vertical strip of characters a cell rolls through, top → bottom =
 * `[to, …intermediates…, from]`. The roll animates the strip downward, so the
 * old character exits at the bottom and the new one drops in from the top.
 *
 * Digit → digit rolls pass through every intermediate digit on the wheel
 * (wrapping 9 → 0), plus `turns` extra full revolutions; anything else flips
 * in a single step.
 */
export function buildStrip(from: string, to: string, turns: number): string[] {
  // `''.indexOf('')` is 0 — guard so a blank (new/removed cell) is not '0'.
  const fi = from === '' ? -1 : DIGITS.indexOf(from);
  const ti = to === '' ? -1 : DIGITS.indexOf(to);
  if (fi >= 0 && ti >= 0) {
    let steps = (ti - fi + 10) % 10;
    steps += Math.max(0, Math.floor(turns)) * 10;
    if (steps === 0) return [to];
    const strip: string[] = [];
    for (let s = steps; s >= 0; s--) strip.push(DIGITS[(fi + s) % 10]);
    return strip;
  }
  return from === to ? [to] : [to, from];
}

/** Split into user-perceived characters (keeps surrogate pairs intact). */
function chars(s: string): string[] {
  return Array.from(s);
}

/** Pair every character of `to` with the character it replaces in `from`. */
function pairCells(
  from: string,
  to: string,
  align: 'start' | 'end',
  stagger: number,
  maxRotations: number,
): CellSpec[] {
  const toChars = chars(to);
  const fromChars = chars(from);
  const shift = align === 'end' ? toChars.length - fromChars.length : 0;
  const cells: CellSpec[] = toChars.map((c, i) => {
    const j = i - shift;
    return { char: c, from: fromChars[j] ?? '', turns: 0, delay: 0 };
  });
  // Stagger and extra turns count only *changed* cells, right to left, so
  // unchanged separators ("$", ".", ",") neither eat a turn nor add a beat.
  let rank = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (cell.from === cell.char) continue;
    cell.delay = rank * stagger;
    cell.turns = Math.max(0, maxRotations - rank);
    rank++;
  }
  return cells;
}

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

interface CellProps {
  spec: CellSpec;
  gen: number;
  duration: number;
  animate: boolean;
}

function Cell({ spec, gen, duration, animate }: CellProps) {
  const stripRef = React.useRef<HTMLSpanElement>(null);
  const strip = React.useMemo(
    () => (animate ? buildStrip(spec.from, spec.char, spec.turns) : [spec.char]),
    // Rebuild only when a new value generation arrives, not on tunable churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gen, animate],
  );

  React.useLayoutEffect(() => {
    const el = stripRef.current;
    const steps = strip.length - 1;
    if (!el || steps === 0 || typeof el.animate !== 'function') return;
    // The strip is (steps + 1) cells tall; shifting by `steps` cells is
    // steps/(steps+1) of its own height. Rolls downward: old char out the
    // bottom, new char in from the top.
    const anim = el.animate(
      [
        { transform: `translateY(${-(steps / (steps + 1)) * 100}%)` },
        { transform: 'translateY(0%)' },
      ],
      { duration, delay: spec.delay, easing: EASE_OUT, fill: 'backwards' },
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strip]);

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}
      aria-hidden
    >
      {/* Invisible in-flow copy of the resting char keeps width and baseline honest. */}
      <span style={{ visibility: 'hidden' }}>{spec.char === ' ' ? ' ' : spec.char}</span>
      <span ref={stripRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
        {strip.map((c, i) => (
          <span key={i} style={{ display: 'block', textAlign: 'center' }}>
            {c === ' ' || c === '' ? ' ' : c}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Animates changes to a string or number by rolling each changed character
 * vertically — new characters drop in from the top like the wheels of a
 * mechanical tally counter. Made for live counters (token counts, costs,
 * durations) that would otherwise just blink to a new value.
 *
 * - Digits roll through every intermediate digit (wrapping 9 → 0); other
 *   characters flip in one step, and unchanged characters hold still.
 * - `stagger` ripples the roll from the end of the string toward the start.
 * - `maxRotations` adds extra revolutions to the rightmost changed digits for
 *   an accelerated odometer feel.
 *
 * Format first, then pass the string (`<CharRoll value={fmtCost(cost)} />`) —
 * the component animates exactly what it is given. Numbers render with
 * `tabular-nums` so columns don't wobble as digits change. Respects
 * `prefers-reduced-motion` (values swap instantly).
 *
 * @summary Tally-counter digit roll for a changing value.
 */
export function CharRoll({
  value,
  duration = 500,
  stagger = 30,
  maxRotations = 0,
  align = 'end',
  className,
  style,
  ...rest
}: CharRollProps) {
  const str = String(value);
  const reduced = usePrefersReducedMotion();

  const [state, setState] = React.useState({ str, from: str, gen: 0 });
  if (state.str !== str) {
    // Derived-state pattern: capture what was shown as the roll's start point.
    setState((s) => ({ str, from: s.str, gen: s.gen + 1 }));
  }

  const cells = React.useMemo(
    () => pairCells(state.from, state.str, align, stagger, maxRotations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, align],
  );

  return (
    <span
      {...rest}
      aria-label={str}
      className={cn('gv-char-roll', className)}
      style={{
        display: 'inline-flex',
        whiteSpace: 'pre',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {cells.map((spec, i) => (
        <Cell
          // Key by position from the END so digits keep their wheel when the
          // value grows a column ("999" → "1000").
          key={align === 'end' ? cells.length - i : i}
          spec={spec}
          gen={state.gen}
          duration={duration}
          animate={!reduced && state.gen > 0}
        />
      ))}
    </span>
  );
}
