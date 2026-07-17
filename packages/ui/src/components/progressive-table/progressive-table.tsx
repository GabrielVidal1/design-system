import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { toEpochMs, useProgressiveSlot } from '../progressive-timeline';

export interface ProgressiveTableCellContext {
  /** Row index within `rows` (the header row is not counted). */
  row: number;
  /** Column index. */
  col: number;
  /** True for a header cell (then `row` is -1). */
  header: boolean;
}

export interface ProgressiveTableProps {
  /** Header cells — rendered in a single `<thead>` row. */
  headers: readonly ReactNode[];
  /** Body rows; each is an array of cells aligned to `headers`. */
  rows: readonly (readonly ReactNode[])[];
  /** Body rows revealed per second, after the header. @default 6 */
  speed?: number;
  /** Seconds to wait before the header appears. @default 0 */
  delay?: number;
  /**
   * Wall-clock anchor (a `Date` or epoch ms) for *when the reveal began*. With
   * it the table is deterministic across remounts: on mount it computes how many
   * rows are already due (`now - timestamp`, minus the header lead-in) and shows
   * them at once, animating only the row still in its window. A revisited page
   * resumes at the right row instead of replaying from the header. Omit for the
   * classic behaviour (the reveal starts whenever the table mounts). Inside a
   * {@link ProgressiveList} the enclosing slot's anchor is used automatically; an
   * explicit `timestamp` overrides it.
   */
  timestamp?: Date | number;
  /** Render the whole table at once, with no animation. */
  instant?: boolean;
  /**
   * How many leading body rows to show instantly (with the header), no
   * animation. @default rows.length — an already-known table appears whole and
   * nothing animates. Pass `0` to reveal header + every row from scratch.
   */
  initialReveal?: number;
  /** Optional `<caption>`. */
  caption?: ReactNode;
  /** Optional per-cell renderer (defaults to rendering the cell node as-is). */
  renderCell?: (cell: ReactNode, ctx: ProgressiveTableCellContext) => ReactNode;
  /** Classes on the scroll wrapper `<div>`. @default 'overflow-x-auto' */
  wrapperClassName?: string;
  /** Classes on the `<table>`. */
  className?: string;
  theadClassName?: string;
  tbodyClassName?: string;
  /** Classes on every body `<tr>`. */
  rowClassName?: string;
  /** Classes on the header `<tr>`. */
  headRowClassName?: string;
  /** Classes on every `<td>`. */
  cellClassName?: string;
  /** Classes on every `<th>`. */
  headCellClassName?: string;
}

/** Duration of a single row's fade+slide entrance (must match the CSS below). */
const ENTRANCE_MS = 300;

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveals a table header-first, then its body rows one at a time — the table
 * analogue of {@link ProgressiveText} (typewriter) and {@link ProgressiveList}
 * (staggered feed). It participates in the same timeline: inside a
 * {@link ProgressiveList} it waits for its slot to become active, reports how
 * long the whole reveal takes, and hands off once the last row is in.
 *
 * Rows present when the table is "already known" are shown instantly (see
 * `initialReveal`); pass `initialReveal={0}` to animate the entire table.
 * Respects `prefers-reduced-motion` and `instant` (renders everything at once).
 */
export function ProgressiveTable({
  headers,
  rows,
  speed = 6,
  delay = 0,
  timestamp,
  instant = false,
  initialReveal,
  caption,
  renderCell,
  wrapperClassName = 'overflow-x-auto',
  className,
  theadClassName,
  tbodyClassName,
  rowClassName,
  headRowClassName,
  cellClassName,
  headCellClassName,
}: ProgressiveTableProps) {
  const skip = instant || reducedMotion();

  // Fixed at mount: how many body rows were "already there" (shown instantly).
  const initialRef = useRef<number>(-1);
  if (initialRef.current < 0) {
    initialRef.current = skip ? rows.length : Math.min(initialReveal ?? rows.length, rows.length);
  }
  const initialCount = initialRef.current;
  const animate = !skip && initialCount < rows.length;

  // Timeline slot (a no-op when standalone): hold the reveal until it's our turn.
  const slot = useProgressiveSlot();
  const active = slot.active;
  const slotRef = useRef(slot);
  slotRef.current = slot;

  // Wall-clock catch-up (fixed at mount): how many body rows are already due,
  // from an explicit `timestamp` or the enclosing slot's anchor. Lets a
  // revisited page resume at the right row instead of replaying the reveal.
  const catchUp = useRef<{ header: boolean; rows: number }>({ header: false, rows: 0 });
  const catchUpInit = useRef(false);
  if (!catchUpInit.current) {
    catchUpInit.current = true;
    if (animate) {
      const anchor = toEpochMs(timestamp);
      const elapsed = anchor != null ? Math.max(0, Date.now() - anchor) : slot.elapsedMs;
      const past = elapsed - Math.max(0, delay) * 1000;
      if (past >= 0) {
        const interval = 1000 / Math.max(0.001, speed);
        const due = initialCount + Math.floor((past + ENTRANCE_MS) / interval);
        catchUp.current = { header: true, rows: Math.min(rows.length, Math.max(initialCount, due)) };
      }
    }
  }

  const [headerShown, setHeaderShown] = useState(() => !animate || catchUp.current.header);
  const [revealed, setRevealed] = useState(() => Math.max(initialCount, catchUp.current.rows));

  // Instant / reduced-motion: everything at once, and hand the timeline off now.
  useEffect(() => {
    if (!skip) return;
    setHeaderShown(true);
    setRevealed(rows.length);
    slotRef.current.finish();
  }, [skip, rows.length]);

  // Tell the enclosing list how long we'll animate, so the *next* item waits for
  // the whole table. Only once it's our slot's turn.
  useEffect(() => {
    if (skip || !active) return;
    const interval = 1000 / Math.max(0.001, speed);
    // Catch-up already consumed the header lead-in and some rows — report only
    // what's left, so an enclosing list waits by the remaining reveal time.
    const shownNow = Math.max(initialCount, catchUp.current.rows);
    const lead = catchUp.current.header ? 0 : delay * 1000 + ENTRANCE_MS;
    const n = Math.max(0, rows.length - shownNow);
    slotRef.current.report(lead + n * interval);
  }, [active, skip, speed, delay, rows.length, initialCount]);

  // Reveal the header once it's our turn (after the lead-in delay).
  useEffect(() => {
    if (!animate || headerShown || !active) return;
    const t = window.setTimeout(() => setHeaderShown(true), delay * 1000);
    return () => window.clearTimeout(t);
  }, [animate, headerShown, active, delay]);

  // Then reveal body rows one per interval.
  useEffect(() => {
    if (skip || !active || !headerShown || revealed >= rows.length) return;
    const interval = 1000 / Math.max(0.001, speed);
    const t = window.setTimeout(() => setRevealed((r) => Math.min(r + 1, rows.length)), interval);
    return () => window.clearTimeout(t);
  }, [skip, active, headerShown, revealed, rows.length, speed]);

  // Hand the timeline off the moment the last row lands.
  useEffect(() => {
    if (!skip && active && headerShown && revealed >= rows.length) slotRef.current.finish();
  }, [skip, active, headerShown, revealed, rows.length]);

  const cell = (node: ReactNode, ctx: ProgressiveTableCellContext) =>
    renderCell ? renderCell(node, ctx) : node;

  return (
    <div className={wrapperClassName}>
      <table className={className}>
        {caption != null && <caption>{caption}</caption>}
        <thead className={theadClassName}>
          <AnimatedRow animate={animate} shown={headerShown} className={headRowClassName}>
            {headers.map((h, j) => (
              <th key={j} className={headCellClassName}>
                {cell(h, { row: -1, col: j, header: true })}
              </th>
            ))}
          </AnimatedRow>
        </thead>
        <tbody className={tbodyClassName}>
          {rows.map((row, i) => {
            if (i >= revealed) return null;
            // "New" rows animate their entrance — except ones the catch-up jump
            // already placed in the past, which appear settled like history.
            const isNew = i >= Math.max(initialCount, catchUp.current.rows);
            return (
              <AnimatedRow key={i} animate={animate && isNew} shown className={rowClassName}>
                {row.map((c, j) => (
                  <td key={j} className={cellClassName}>
                    {cell(c, { row: i, col: j, header: false })}
                  </td>
                ))}
              </AnimatedRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A `<tr>` that fades + slides in on mount when `animate` — the reveal classes
 * live on the row itself (a table row can't be wrapped in a `<div>`). `shown`
 * lets a caller (the header) drive the target state externally.
 */
function AnimatedRow({
  animate,
  shown,
  className,
  children,
}: {
  animate: boolean;
  shown: boolean;
  className?: string;
  children: ReactNode;
}) {
  // Mount hidden, then flip on the next frame so the transition runs.
  const [entered, setEntered] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const visible = animate ? entered && shown : true;
  return (
    <tr
      className={cn(
        animate && 'transition-all duration-300 ease-out',
        animate && (visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'),
        className,
      )}
    >
      {children}
    </tr>
  );
}
