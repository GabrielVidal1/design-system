import * as React from 'react';

import { cn } from '../../lib/utils';

export interface SliderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  /** Controlled value. Pair with `onValueChange`. */
  value?: number;
  /** Uncontrolled initial value. Default: `min`. */
  defaultValue?: number;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /** Snap increment. @default 1 */
  step?: number;
  /** Fires on every change — while dragging, and on each key press. */
  onValueChange?: (value: number) => void;
  /** Fires once the interaction settles (pointer released / key released). */
  onValueCommit?: (value: number) => void;
  disabled?: boolean;
  /** Caption above the track, left-aligned. */
  label?: React.ReactNode;
  /** Show the current value above the track, right-aligned. @default false */
  showValue?: boolean;
  /** Text for `showValue` (and `aria-valuetext`). */
  format?: (value: number) => string;
}

/** Snap to the step grid without float dust (0.1 + 0.2 …). */
function snap(raw: number, min: number, max: number, step: number): number {
  const clamped = Math.min(Math.max(raw, min), max);
  const steps = Math.round((clamped - min) / step);
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Math.min(max, Number((min + steps * step).toFixed(decimals)));
}

/**
 * A touch-first range slider — the `type="range"` every settings panel and
 * editor restyles. Full-track pointer capture (tap anywhere to jump, then
 * drag), a finger-sized thumb, and arrow/Page/Home/End keys on the focusable
 * thumb. Controlled (`value` + `onValueChange`) or uncontrolled
 * (`defaultValue`); `onValueCommit` fires when the gesture ends.
 */
export function Slider({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onValueCommit,
  disabled,
  label,
  showValue = false,
  format = String,
  className,
  ...props
}: SliderProps) {
  const [own, setOwn] = React.useState(() => snap(defaultValue ?? min, min, max, step));
  const current = snap(value ?? own, min, max, step);
  const track = React.useRef<HTMLDivElement>(null);
  const thumb = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  // The latest value, for commit handlers that fire from native listeners.
  const latest = React.useRef(current);
  latest.current = current;

  const range = max - min;
  const pct = range <= 0 ? 0 : ((current - min) / range) * 100;

  const change = (next: number) => {
    if (next === latest.current) return;
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
    // Track what was last emitted, so a controlled parent that hasn't
    // re-rendered yet doesn't get the same value again on the next move.
    latest.current = next;
  };

  const fromPointer = (e: { clientX: number }) => {
    const el = track.current;
    if (!el) return latest.current;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return latest.current;
    const ratio = (e.clientX - rect.left) / rect.width;
    return snap(min + ratio * range, min, max, step);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    change(fromPointer(e));
    thumb.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled) return;
    change(fromPointer(e));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onValueCommit?.(latest.current);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const page = Math.max(step, range / 10);
    const moves: Record<string, number> = {
      ArrowRight: current + step,
      ArrowUp: current + step,
      ArrowLeft: current - step,
      ArrowDown: current - step,
      PageUp: current + page,
      PageDown: current - page,
      Home: min,
      End: max,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const snapped = snap(next, min, max, step);
    change(snapped);
    onValueCommit?.(snapped);
  };

  const text = format(current);

  return (
    <div className={cn('w-full', disabled && 'opacity-50', className)} {...props}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-3">
          {label ? <span className="text-xs text-muted-foreground">{label}</span> : <span />}
          {showValue && (
            <span className="mono text-[11px] tabular-nums text-muted-foreground">{text}</span>
          )}
        </div>
      )}
      <div
        className={cn(
          'relative flex h-8 items-center select-none',
          disabled ? 'pointer-events-none' : 'cursor-pointer touch-none',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div ref={track} className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div
          ref={thumb}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={text}
          aria-disabled={disabled || undefined}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="absolute size-5 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow-sm transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
