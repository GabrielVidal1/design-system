import * as React from 'react';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';

import { cn } from '../../lib/utils';
import {
  curvesEqual,
  easingToCss,
  evalCurve,
  insertPoint,
  moveHandle,
  movePoint,
  removePoint,
  roundCurve,
  segmentControls,
  type AnimationCurve,
} from './curve';

/** A named curve offered as a one-tap chip above the graph. */
export interface CurvePreset {
  label: string;
  curve: AnimationCurve;
}

export interface CurveEditorProps {
  /** The curve being edited (controlled). */
  value: AnimationCurve;
  /** Every change — while dragging too. Values are rounded to 3 decimals. */
  onChange: (curve: AnimationCurve) => void;
  /** Once a gesture settles (pointer up, key press, preset, reset). */
  onCommit?: (curve: AnimationCurve) => void;
  /** What *Reset* puts back. No reset button without it. */
  defaultValue?: AnimationCurve;
  /** One-tap curves shown as chips with a thumbnail; the matching one is lit. */
  presets?: CurvePreset[];
  /**
   * The animation's length: labels the time axis in seconds (else in %) and
   * paces the preview. @default 1000
   */
  durationMs?: number;
  /** Run a playhead along the curve on a loop (pausable). @default true */
  preview?: boolean;
  /**
   * Draw what the curve animates at the playhead's progress — called on every
   * frame of the preview with the curve's value, and the time fraction.
   */
  renderPreview?: (progress: number, time: number) => React.ReactNode;
  /** Range the keyframes' values may take. @default [0, 1] */
  valueRange?: readonly [number, number];
  /** Keep the first and last keyframes' values where they are. @default true */
  lockEnds?: boolean;
  /** Graph height in px. @default 220 */
  height?: number;
  /** Caption of the value axis. @default 'progress' */
  valueLabel?: string;
  disabled?: boolean;
  className?: string;
}

type Selection = { kind: 'point'; i: number } | { kind: 'handle'; seg: number; end: 0 | 1 } | null;
type Drag = { sel: NonNullable<Selection>; pointerId: number; moved: boolean };

const PAD = { l: 34, r: 14, t: 14, b: 24 };
/** How far past the value range the graph shows (handles overshoot there). */
const OVERSHOOT = 0.25;
/** The preview's rest at full before it loops, then its beat at empty. */
const REST_FULL_MS = 650;
const REST_EMPTY_MS = 300;
const DOUBLE_TAP_MS = 320;
const UNIT_RANGE = [0, 1] as const;
/** px within which a dragged keyframe snaps to a grid line. */
const SNAP_PX = 6;

/* ── The preview clock ───────────────────────────────────────────────────── */

/** A tiny store the playhead and the preview subscribe to — the graph itself
 *  doesn't re-render on every frame. */
function createClock() {
  let t = 0;
  const subs = new Set<() => void>();
  return {
    get: () => t,
    set: (next: number) => {
      if (next === t) return;
      t = next;
      subs.forEach((s) => s());
    },
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
type Clock = ReturnType<typeof createClock>;

function useClock(clock: Clock): number {
  return React.useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}

function useLoop(clock: Clock, durationMs: number, playing: boolean) {
  React.useEffect(() => {
    if (!playing || durationMs <= 0 || typeof requestAnimationFrame !== 'function') return;
    // Pick up where a pause left the playhead.
    const start = performance.now() - clock.get() * durationMs;
    const period = durationMs + REST_FULL_MS + REST_EMPTY_MS;
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) % period;
      clock.set(t < durationMs ? t / durationMs : t < durationMs + REST_FULL_MS ? 1 : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, durationMs, playing]);
}

/* ── Geometry ────────────────────────────────────────────────────────────── */

function useWidth(ref: React.RefObject<HTMLElement | null>, fallback: number) {
  const [w, setW] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.clientWidth) setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width && setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

interface Frame {
  w: number;
  h: number;
  yMin: number;
  yMax: number;
  px: (x: number, y: number) => { x: number; y: number };
  at: (sx: number, sy: number) => { x: number; y: number };
}

/** The values a curve reaches, handles included — what the view must show. */
function extent(curve: AnimationCurve): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < curve.points.length - 1; i++)
    for (const c of segmentControls(curve, i)) {
      lo = Math.min(lo, c.y);
      hi = Math.max(hi, c.y);
    }
  return [lo, hi];
}

function frame(
  w: number,
  h: number,
  range: readonly [number, number],
  fit: readonly [number, number],
): Frame {
  const span = range[1] - range[0] || 1;
  // The overshoot band, grown to fit a curve that reaches past it (a preset
  // with a big back-ease) with a little air around its handles.
  const yMin = Math.min(range[0] - span * OVERSHOOT, fit[0] - span * 0.06);
  const yMax = Math.max(range[1] + span * OVERSHOOT, fit[1] + span * 0.06);
  const pw = Math.max(1, w - PAD.l - PAD.r);
  const ph = Math.max(1, h - PAD.t - PAD.b);
  return {
    w,
    h,
    yMin,
    yMax,
    px: (x, y) => ({ x: PAD.l + x * pw, y: PAD.t + ((yMax - y) / (yMax - yMin)) * ph }),
    at: (sx, sy) => ({ x: (sx - PAD.l) / pw, y: yMax - ((sy - PAD.t) / ph) * (yMax - yMin) }),
  };
}

function curvePath(curve: AnimationCurve, f: (x: number, y: number) => { x: number; y: number }): string {
  if (curve.points.length < 2) return '';
  const p = (v: { x: number; y: number }) => {
    const s = f(v.x, v.y);
    return `${s.x.toFixed(2)} ${s.y.toFixed(2)}`;
  };
  let d = `M ${p(curve.points[0]!)}`;
  for (let i = 0; i < curve.points.length - 1; i++) {
    const [, c1, c2, b] = segmentControls(curve, i);
    d += ` C ${p(c1)}, ${p(c2)}, ${p(b)}`;
  }
  return d;
}

/** Keyframe indices in paint order: locked ends under the rest. */
function drawOrder(n: number, lockEnds: boolean): number[] {
  const all = Array.from({ length: n }, (_, i) => i);
  if (!lockEnds || n < 3) return all;
  return [0, n - 1, ...all.slice(1, -1)];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (ms: number) => `${Number((ms / 1000).toFixed(2))}s`;

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function CurveThumb({ curve, active }: { curve: AnimationCurve; active: boolean }) {
  const d = curvePath(curve, (x, y) => ({ x: 2 + x * 24, y: 16 - y * 12 }));
  return (
    <svg viewBox="0 0 28 20" className="h-4 w-6 shrink-0" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={active ? 'var(--primary)' : 'var(--muted-foreground)'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Playhead({ clock, curve, f }: { clock: Clock; curve: AnimationCurve; f: Frame }) {
  const t = useClock(clock);
  const top = f.px(t, f.yMax);
  const dot = f.px(t, evalCurve(curve, t));
  return (
    <g pointerEvents="none" data-curve-playhead="">
      <line x1={top.x} x2={top.x} y1={PAD.t} y2={f.h - PAD.b} stroke="var(--primary)" strokeOpacity="0.25" strokeWidth="1" />
      <circle cx={dot.x} cy={dot.y} r="5" fill="var(--primary)" />
    </g>
  );
}

function PreviewSlot({
  clock,
  curve,
  render,
}: {
  clock: Clock;
  curve: AnimationCurve;
  render: (progress: number, time: number) => React.ReactNode;
}) {
  const t = useClock(clock);
  return <>{render(evalCurve(curve, t), t)}</>;
}

/* ── The editor ──────────────────────────────────────────────────────────── */

/**
 * A graph editor for an animation's timing: keyframes on a time × progress
 * plot, joined by cubic-bézier segments whose handles you drag — the model of
 * CSS `@keyframes` and the Web Animations API, so the result plays back
 * exactly through {@link curveKeyframes} (or {@link evalCurve} in JS).
 *
 * Touch-first: finger-sized hit targets on keyframes and handles, a double
 * tap on the graph adds a keyframe there (splitting its segment without
 * changing the shape), the toolbar adds / removes one too. Keyframes snap to
 * the grid lines, the ends keep their time (and, by default, their value),
 * handles may overshoot. Arrow keys nudge the focused keyframe or handle
 * (Shift: ×5), Delete removes a keyframe. A playhead loops along the curve
 * while `renderPreview` draws what it animates at the same instant.
 *
 * @summary Keyframe + bézier-handle graph editor for an animation's timing
 * curve (CSS / Web Animations compatible), with presets, reset and a live
 * looping preview.
 */
export function CurveEditor({
  value,
  onChange,
  onCommit,
  defaultValue,
  presets,
  durationMs = 1000,
  preview = true,
  renderPreview,
  valueRange = UNIT_RANGE,
  lockEnds = true,
  height = 220,
  valueLabel = 'progress',
  disabled = false,
  className,
}: CurveEditorProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const width = useWidth(wrapRef, 320);
  // The view fits the curve, but holds still while something is dragged —
  // the graph rescaling under the finger would move what it is holding.
  const [held, setHeld] = React.useState<[number, number] | null>(null);
  const [fitLo, fitHi] = held ?? extent(value);
  const f = React.useMemo(
    () => frame(width, height, valueRange, [fitLo, fitHi]),
    [width, height, valueRange, fitLo, fitHi],
  );

  const [sel, setSel] = React.useState<Selection>(null);
  const [playing, setPlaying] = React.useState(preview);
  const [clock] = React.useState(createClock);
  useLoop(clock, durationMs, preview && playing);

  // The latest curve, for pointer handlers between renders.
  const latest = React.useRef(value);
  latest.current = value;
  const drag = React.useRef<Drag | null>(null);
  const lastTap = React.useRef<{ t: number; x: number; y: number } | null>(null);

  // A selection that no longer exists (a preset swapped the keyframes).
  const n = value.points.length;
  const live: Selection =
    sel?.kind === 'point' ? (sel.i < n ? sel : null) : sel?.kind === 'handle' ? (sel.seg < n - 1 ? sel : null) : null;

  const emit = (next: AnimationCurve, commit: boolean) => {
    const r = roundCurve(next);
    latest.current = r;
    onChange(r);
    if (commit) onCommit?.(r);
  };

  const svgPoint = (e: { clientX: number; clientY: number }) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { sx: e.clientX - box.left, sy: e.clientY - box.top };
  };

  /** Snap a keyframe's position to the grid lines it is within SNAP_PX of. */
  const snap = (p: { x: number; y: number }) => {
    const s = f.px(p.x, p.y);
    const lines = [0, 0.25, 0.5, 0.75, 1];
    let { x, y } = p;
    for (const g of lines) {
      if (Math.abs(f.px(g, 0).x - s.x) < SNAP_PX) x = g;
      const gy = valueRange[0] + g * (valueRange[1] - valueRange[0]);
      if (Math.abs(f.px(0, gy).y - s.y) < SNAP_PX) y = gy;
    }
    return { x, y };
  };

  const apply = (s: NonNullable<Selection>, to: { x: number; y: number }, commit: boolean) => {
    const c = latest.current;
    if (s.kind === 'point') {
      const last = c.points.length - 1;
      const end = s.i === 0 || s.i === last;
      const target = lockEnds && end ? { x: to.x, y: c.points[s.i]!.y } : to;
      emit(movePoint(c, s.i, target, valueRange), commit);
    } else {
      // Dragged: no further than the view shows. Nudged by key: a step past
      // it is fine, the view grows to fit.
      const span = valueRange[1] - valueRange[0] || 1;
      const y = commit
        ? Math.min(valueRange[1] + span, Math.max(valueRange[0] - span, to.y))
        : Math.min(f.yMax, Math.max(f.yMin, to.y));
      emit(moveHandle(c, s.seg, s.end, { x: to.x, y }), commit);
    }
  };

  const startDrag = (s: NonNullable<Selection>) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    setSel(s);
    setHeld([f.yMin, f.yMax]);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    drag.current = { sel: s, pointerId: e.pointerId, moved: false };
    (e.currentTarget as SVGElement).focus?.({ preventScroll: true } as FocusOptions);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.moved = true;
    const { sx, sy } = svgPoint(e);
    const at = f.at(sx, sy);
    apply(d.sel, d.sel.kind === 'point' ? snap(at) : at, false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setHeld(null);
    if (d.moved) onCommit?.(latest.current);
  };

  const add = (x: number) => {
    const next = insertPoint(latest.current, x);
    if (next === latest.current) return;
    emit(next, true);
    setSel({ kind: 'point', i: next.points.findIndex((p) => p.x === Math.round(x * 1000) / 1000) });
  };

  /** A double tap (or click) on the graph adds a keyframe at that time. */
  const onBackgroundDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const { sx, sy } = svgPoint(e);
    const now = e.timeStamp;
    const prev = lastTap.current;
    if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(prev.x - sx, prev.y - sy) < 24) {
      lastTap.current = null;
      const x = f.at(sx, sy).x;
      if (x > 0 && x < 1) add(x);
      return;
    }
    lastTap.current = { t: now, x: sx, y: sy };
    setSel(null);
  };

  /** The toolbar's +: a keyframe in the middle of the selected (else the longest) segment. */
  const addFromToolbar = () => {
    const c = latest.current;
    let seg = 0;
    if (live?.kind === 'handle') seg = live.seg;
    else if (live?.kind === 'point') seg = Math.min(live.i, c.points.length - 2);
    else
      c.points.slice(0, -1).forEach((p, i) => {
        const w = c.points[i + 1]!.x - p.x;
        if (w > c.points[seg + 1]!.x - c.points[seg]!.x) seg = i;
      });
    add((c.points[seg]!.x + c.points[seg + 1]!.x) / 2);
  };

  const removeSelected = () => {
    if (live?.kind !== 'point') return;
    const next = removePoint(latest.current, live.i);
    if (next === latest.current) return;
    emit(next, true);
    setSel(null);
  };

  const onKey = (s: NonNullable<Selection>) => (e: React.KeyboardEvent) => {
    if (disabled) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && s.kind === 'point') {
      e.preventDefault();
      removeSelected();
      return;
    }
    const step = e.shiftKey ? 0.05 : 0.01;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowDown' ? -step : e.key === 'ArrowUp' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const c = latest.current;
    const from = s.kind === 'point' ? c.points[s.i]! : segmentControls(c, s.seg)[s.end === 0 ? 1 : 2];
    apply(s, { x: from.x + dx, y: from.y + dy }, true);
  };

  /* ── drawing ── */
  const curve = value;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  const vr = valueRange;
  const isEnd = (i: number) => i === 0 || i === n - 1;
  const canRemove = live?.kind === 'point' && !isEnd(live.i);

  const readout = (() => {
    if (live?.kind === 'point') {
      const p = curve.points[live.i]!;
      return `${durationMs ? secs(p.x * durationMs) : pct(p.x)} · ${pct((p.y - vr[0]) / (vr[1] - vr[0] || 1))} ${valueLabel}`;
    }
    if (live?.kind === 'handle') return easingToCss(curve.easings[live.seg]!);
    return null;
  })();

  return (
    <div className={cn('space-y-2', disabled && 'pointer-events-none opacity-60', className)}>
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Curve presets">
          {presets.map((p) => {
            const on = curvesEqual(p.curve, curve);
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => {
                  setSel(null);
                  emit(p.curve, true);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  on
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <CurveThumb curve={p.curve} active={on} />
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl border border-border bg-background">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block select-none"
          role="group"
          aria-label="Animation curve"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: 'pan-y' }}
        >
          {/* plot background — the double-tap target */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={onBackgroundDown}
            data-curve-background=""
          />
          {/* grid */}
          {grid.map((g) => {
            const gx = f.px(g, 0).x;
            const gy = f.px(0, vr[0] + g * (vr[1] - vr[0])).y;
            return (
              <g key={g} pointerEvents="none">
                <line x1={gx} x2={gx} y1={PAD.t} y2={height - PAD.b} stroke="var(--border)" strokeWidth="1" />
                <line x1={PAD.l} x2={width - PAD.r} y1={gy} y2={gy} stroke="var(--border)" strokeWidth="1" strokeDasharray={g === 0 || g === 1 ? undefined : '3 3'} />
                <text x={gx} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                  {durationMs ? secs(g * durationMs) : pct(g)}
                </text>
                {(g === 0 || g === 0.5 || g === 1) && (
                  <text x={PAD.l - 6} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
                    {pct(g)}
                  </text>
                )}
              </g>
            );
          })}

          {/* handles */}
          {curve.easings.map((_, seg) => {
            const [a, c1, c2, b] = segmentControls(curve, seg);
            return ([0, 1] as const).map((end) => {
              const from = f.px(end === 0 ? a.x : b.x, end === 0 ? a.y : b.y);
              const c = end === 0 ? c1 : c2;
              const h = f.px(c.x, c.y);
              const on = live?.kind === 'handle' && live.seg === seg && live.end === end;
              const s = { kind: 'handle', seg, end } as const;
              return (
                <g key={`${seg}-${end}`}>
                  <line x1={from.x} y1={from.y} x2={h.x} y2={h.y} stroke="var(--muted-foreground)" strokeOpacity="0.6" strokeWidth="1" pointerEvents="none" />
                  <circle
                    cx={h.x}
                    cy={h.y}
                    r="14"
                    fill="transparent"
                    tabIndex={disabled ? -1 : 0}
                    role="button"
                    aria-label={`Segment ${seg + 1} ${end === 0 ? 'out' : 'in'} handle: ${easingToCss(curve.easings[seg]!)}`}
                    className="cursor-grab outline-none"
                    style={{ touchAction: 'none' }}
                    onPointerDown={startDrag(s)}
                    onKeyDown={onKey(s)}
                    onFocus={() => setSel(s)}
                    data-curve-handle={`${seg}-${end}`}
                  />
                  <circle cx={h.x} cy={h.y} r={on ? 5 : 4} fill="var(--card)" stroke={on ? 'var(--primary)' : 'var(--muted-foreground)'} strokeWidth="1.5" pointerEvents="none" />
                </g>
              );
            });
          })}

          {/* the curve */}
          <path d={curvePath(curve, f.px)} fill="none" stroke="var(--primary)" strokeWidth="2.25" strokeLinecap="round" pointerEvents="none" />

          {preview && <Playhead clock={clock} curve={curve} f={f} />}

          {/* keyframes — locked ends drawn first, so a keyframe crowding one
              (the un-send plateau's end, 5 % before the end) wins the tap */}
          {drawOrder(n, lockEnds).map((i) => {
            const p = curve.points[i]!;
            const s = f.px(p.x, p.y);
            const on = live?.kind === 'point' && live.i === i;
            const sel = { kind: 'point', i } as const;
            return (
              <g key={i}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={lockEnds && isEnd(i) ? 10 : 16}
                  fill="transparent"
                  tabIndex={disabled ? -1 : 0}
                  role="button"
                  aria-label={`Keyframe ${i + 1}: ${pct(p.x)} time, ${pct(p.y)} ${valueLabel}`}
                  className="cursor-grab outline-none"
                  style={{ touchAction: 'none' }}
                  onPointerDown={startDrag(sel)}
                  onKeyDown={onKey(sel)}
                  onFocus={() => setSel(sel)}
                  data-curve-point={i}
                />
                {on && <circle cx={s.x} cy={s.y} r="10" fill="var(--primary)" fillOpacity="0.15" pointerEvents="none" />}
                <rect
                  x={s.x - 5}
                  y={s.y - 5}
                  width="10"
                  height="10"
                  rx="2"
                  transform={`rotate(45 ${s.x} ${s.y})`}
                  fill={on ? 'var(--primary)' : 'var(--card)'}
                  stroke="var(--primary)"
                  strokeWidth="2"
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </svg>
        <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {valueLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" aria-live="polite">
          {readout ?? 'Drag points & handles · double-tap to add'}
        </span>
        <IconBtn label="Add keyframe" onClick={addFromToolbar} disabled={disabled}>
          <Plus className="size-3.5" />
        </IconBtn>
        <IconBtn label="Remove keyframe" onClick={removeSelected} disabled={disabled || !canRemove}>
          <Minus className="size-3.5" />
        </IconBtn>
        {preview && (
          <IconBtn label={playing ? 'Pause preview' : 'Play preview'} onClick={() => setPlaying((v) => !v)}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </IconBtn>
        )}
        {defaultValue && (
          <IconBtn
            label="Reset curve"
            disabled={disabled || curvesEqual(defaultValue, curve)}
            onClick={() => {
              setSel(null);
              emit(defaultValue, true);
            }}
          >
            <RotateCcw className="size-3.5" />
          </IconBtn>
        )}
      </div>

      {preview && renderPreview && <PreviewSlot clock={clock} curve={curve} render={renderPreview} />}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
