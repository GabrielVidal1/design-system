/**
 * Animation curves: keyframes joined by cubic-bézier segments — the model the
 * Web Animations API and CSS `@keyframes` already speak, so a curve edited in
 * {@link CurveEditor} plays back exactly (`curveKeyframes`) with no sampling.
 *
 * A curve maps the animation's time fraction `x` (0 → 1) to its progress `y`.
 * Each segment's easing is a CSS `cubic-bezier(x1, y1, x2, y2)` normalised to
 * that segment's box (from one keyframe to the next) — exactly the `easing` of
 * the keyframe that opens it.
 */

/** One keyframe: `x` the time fraction (0 → 1), `y` the progress there. */
export interface CurvePoint {
  x: number;
  y: number;
}

/** A segment's CSS `cubic-bezier(x1, y1, x2, y2)`, normalised to its box. */
export type CurveEasing = readonly [number, number, number, number];

/**
 * A piecewise cubic-bézier curve. `points` are sorted by `x`, run from
 * `x = 0` to `x = 1`, and number one more than `easings` — `easings[i]`
 * shapes the segment from `points[i]` to `points[i + 1]`.
 */
export interface AnimationCurve {
  points: CurvePoint[];
  easings: CurveEasing[];
}

export const LINEAR_EASING: CurveEasing = [0, 0, 1, 1];

/** The everyday single-segment curves, in CSS's own names. */
export const EASINGS = {
  linear: LINEAR_EASING,
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  easeOutQuart: [0.25, 1, 0.5, 1],
  easeInExpo: [0.7, 0, 0.84, 0],
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeOutBack: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, CurveEasing>;

/** A one-segment curve from 0 to 1 with this easing. */
export function curveFromEasing(easing: CurveEasing): AnimationCurve {
  return {
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    easings: [easing],
  };
}

/* ── Evaluation ──────────────────────────────────────────────────────────── */

const bez = (a: number, b: number, t: number) => {
  // B(t) for P0 = 0, P1 = a, P2 = b, P3 = 1.
  const s = 1 - t;
  return 3 * s * s * t * a + 3 * s * t * t * b + t * t * t;
};
const bezSlope = (a: number, b: number, t: number) => {
  const s = 1 - t;
  return 3 * s * s * a + 6 * s * t * (b - a) + 3 * t * t * (1 - b);
};

/**
 * The value of `cubic-bezier(x1, y1, x2, y2)` at input `u` (0 → 1) — what the
 * browser computes for a CSS timing function: solve `x(t) = u` (Newton, with a
 * bisection fallback for flat spots), then return `y(t)`.
 */
export function cubicBezierAt(easing: CurveEasing, u: number): number {
  const [x1, y1, x2, y2] = easing;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (x1 === y1 && x2 === y2) return u;
  let t = u;
  for (let i = 0; i < 8; i++) {
    const err = bez(x1, x2, t) - u;
    if (Math.abs(err) < 1e-7) return bez(y1, y2, t);
    const d = bezSlope(x1, x2, t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = u;
  for (let i = 0; i < 40; i++) {
    const x = bez(x1, x2, t);
    if (Math.abs(x - u) < 1e-7) break;
    if (x < u) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return bez(y1, y2, t);
}

/** The curve's progress at time fraction `f` (clamped to 0 → 1). */
export function evalCurve(curve: AnimationCurve, f: number): number {
  const { points, easings } = curve;
  if (points.length === 0) return f;
  const x = Math.min(1, Math.max(0, f));
  const last = points[points.length - 1]!;
  if (x >= last.x) return last.y;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (x > b.x) continue;
    const w = b.x - a.x;
    if (w <= 0) return b.y;
    if (a.y === b.y) return a.y;
    return a.y + (b.y - a.y) * cubicBezierAt(easings[i] ?? LINEAR_EASING, (x - a.x) / w);
  }
  return points[0]!.y;
}

/* ── Output ──────────────────────────────────────────────────────────────── */

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** A segment's easing as CSS: `linear` or `cubic-bezier(…)`. */
export function easingToCss(easing: CurveEasing): string {
  const [x1, y1, x2, y2] = easing;
  if (x1 === y1 && x2 === y2) return 'linear';
  return `cubic-bezier(${num(x1)}, ${num(y1)}, ${num(x2)}, ${num(y2)})`;
}

/**
 * The curve as Web Animations keyframes: one per point, at `offset = x`,
 * carrying `frame(y)` (e.g. `y => ({ transform: \`scaleX(${y})\` })`) and the
 * easing of the segment it opens. Play them with `easing: 'linear'` on the
 * animation itself so the curve's timing is the only one applied.
 */
export function curveKeyframes(
  curve: AnimationCurve,
  frame: (y: number) => Keyframe,
): Keyframe[] {
  return curve.points.map((p, i) => ({
    ...frame(p.y),
    offset: p.x,
    ...(i < curve.easings.length ? { easing: easingToCss(curve.easings[i]!) } : {}),
  }));
}

/* ── Validation ──────────────────────────────────────────────────────────── */

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * `value` as a well-formed curve, or `null` — for curves read back from
 * storage: at least two points, `x` non-decreasing from 0 to 1, one easing
 * per segment with its `x` handles inside 0 → 1 (CSS rejects them otherwise).
 */
export function parseCurve(value: unknown): AnimationCurve | null {
  if (!value || typeof value !== 'object') return null;
  const { points, easings } = value as Partial<AnimationCurve>;
  if (!Array.isArray(points) || !Array.isArray(easings)) return null;
  if (points.length < 2 || easings.length !== points.length - 1) return null;
  let prev = -Infinity;
  for (const p of points) {
    if (!p || !finite(p.x) || !finite(p.y) || p.x < prev || p.x < 0 || p.x > 1) return null;
    prev = p.x;
  }
  if (points[0]!.x !== 0 || points[points.length - 1]!.x !== 1) return null;
  for (const e of easings) {
    if (!Array.isArray(e) || e.length !== 4 || !e.every(finite)) return null;
    if (e[0] < 0 || e[0] > 1 || e[2] < 0 || e[2] > 1) return null;
  }
  return {
    points: points.map((p) => ({ x: p.x, y: p.y })),
    easings: easings.map((e) => [e[0], e[1], e[2], e[3]] as const),
  };
}

/** Whether two curves are the same, to 3 decimals. */
export function curvesEqual(a: AnimationCurve, b: AnimationCurve): boolean {
  const r = (n: number) => Math.round(n * 1000);
  return (
    a.points.length === b.points.length &&
    a.points.every((p, i) => r(p.x) === r(b.points[i]!.x) && r(p.y) === r(b.points[i]!.y)) &&
    a.easings.every((e, i) => e.every((v, j) => r(v) === r(b.easings[i]![j]!)))
  );
}

/* ── Editing ─────────────────────────────────────────────────────────────── */

type Vec = { x: number; y: number };
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** A segment's four control points in the curve's own space. */
export function segmentControls(curve: AnimationCurve, i: number): [Vec, Vec, Vec, Vec] {
  const a = curve.points[i]!;
  const b = curve.points[i + 1]!;
  const [x1, y1, x2, y2] = curve.easings[i] ?? LINEAR_EASING;
  const w = b.x - a.x;
  const h = b.y - a.y;
  return [a, { x: a.x + x1 * w, y: a.y + y1 * h }, { x: a.x + x2 * w, y: a.y + y2 * h }, b];
}

/** Four absolute control points back to a normalised easing (x clamped for CSS). */
function easingFromControls([a, c1, c2, b]: [Vec, Vec, Vec, Vec]): CurveEasing {
  const w = b.x - a.x;
  const h = b.y - a.y;
  const nx = (x: number) => (w <= 0 ? 0 : Math.min(1, Math.max(0, (x - a.x) / w)));
  // A flat segment has no height to normalise against; its handles' y can't
  // show — keep them on the line.
  const ny = (y: number, fallback: number) => (h === 0 ? fallback : (y - a.y) / h);
  return [nx(c1.x), ny(c1.y, 0), nx(c2.x), ny(c2.y, 1)];
}

/** The parameter `t` at which segment `i` reaches time fraction `x`. */
function segmentTAt(curve: AnimationCurve, i: number, x: number): number {
  const a = curve.points[i]!;
  const b = curve.points[i + 1]!;
  const u = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
  const [x1, , x2] = curve.easings[i] ?? LINEAR_EASING;
  let lo = 0;
  let hi = 1;
  let t = u;
  for (let k = 0; k < 40; k++) {
    const v = bez(x1, x2, t);
    if (Math.abs(v - u) < 1e-7) break;
    if (v < u) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return t;
}

/**
 * Add a keyframe on the curve at time fraction `x`, splitting its segment
 * where it stands (de Casteljau) so the curve keeps its exact shape.
 */
export function insertPoint(curve: AnimationCurve, x: number): AnimationCurve {
  const i = curve.points.findIndex((p, k) => k < curve.points.length - 1 && x > p.x && x < curve.points[k + 1]!.x);
  if (i < 0) return curve;
  const t = segmentTAt(curve, i, x);
  const [p0, p1, p2, p3] = segmentControls(curve, i);
  const q0 = lerp(p0, p1, t);
  const q1 = lerp(p1, p2, t);
  const q2 = lerp(p2, p3, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const m = lerp(r0, r1, t);
  const mid = { x, y: m.y };
  const left = easingFromControls([p0, q0, r0, mid]);
  const right = easingFromControls([mid, r1, q2, p3]);
  return {
    points: [...curve.points.slice(0, i + 1), mid, ...curve.points.slice(i + 1)],
    easings: [...curve.easings.slice(0, i), left, right, ...curve.easings.slice(i + 1)],
  };
}

/**
 * Remove keyframe `i` (never an end), merging its two segments into one that
 * keeps the outer handles where they were.
 */
export function removePoint(curve: AnimationCurve, i: number): AnimationCurve {
  if (i <= 0 || i >= curve.points.length - 1) return curve;
  const [a, c1] = segmentControls(curve, i - 1);
  const [, , c2, b] = segmentControls(curve, i);
  return {
    points: curve.points.filter((_, k) => k !== i),
    easings: [
      ...curve.easings.slice(0, i - 1),
      easingFromControls([a, c1, c2, b]),
      ...curve.easings.slice(i + 1),
    ],
  };
}

/**
 * Move keyframe `i` to `to` — clamped between its neighbours (the ends keep
 * their `x`), its segments' handles following it so their shapes hold.
 */
export function movePoint(
  curve: AnimationCurve,
  i: number,
  to: Vec,
  yRange: readonly [number, number] = [0, 1],
): AnimationCurve {
  const n = curve.points.length;
  const prev = curve.points[i - 1];
  const next = curve.points[i + 1];
  const x = i === 0 ? 0 : i === n - 1 ? 1 : Math.min(next!.x, Math.max(prev!.x, to.x));
  const y = Math.min(yRange[1], Math.max(yRange[0], to.y));
  const points = curve.points.map((p, k) => (k === i ? { x, y } : p));
  return { points, easings: curve.easings };
}

/**
 * Drag one handle of segment `seg` (`end` 0: the one leaving its start, 1:
 * the one arriving at its end) to `to`, in the curve's own space. Its `x` is
 * kept inside the segment (CSS requires it); its `y` is free — overshoot.
 */
export function moveHandle(curve: AnimationCurve, seg: number, end: 0 | 1, to: Vec): AnimationCurve {
  const c = segmentControls(curve, seg);
  c[end === 0 ? 1 : 2] = to;
  const easing = easingFromControls(c);
  const prev = curve.easings[seg] ?? LINEAR_EASING;
  // Keep the other handle's numbers as they were (no rounding drift), and a
  // flat segment's untouched y.
  // A flat segment's handle heights can't show: they keep their numbers.
  const flat = c[0].y === c[3].y;
  const next: CurveEasing =
    end === 0
      ? [easing[0], flat ? prev[1] : easing[1], prev[2], prev[3]]
      : [prev[0], prev[1], easing[2], flat ? prev[3] : easing[3]];
  return { points: curve.points, easings: curve.easings.map((e, k) => (k === seg ? next : e)) };
}

/** Round every number to 3 decimals — what gets stored. */
export function roundCurve(curve: AnimationCurve): AnimationCurve {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    points: curve.points.map((p) => ({ x: r(p.x), y: r(p.y) })),
    easings: curve.easings.map((e) => [r(e[0]), r(e[1]), r(e[2]), r(e[3])] as const),
  };
}
