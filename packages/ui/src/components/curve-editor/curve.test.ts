import { describe, expect, it } from 'vitest';

import {
  EASINGS,
  cubicBezierAt,
  curveFromEasing,
  curveKeyframes,
  curvesEqual,
  evalCurve,
  insertPoint,
  moveHandle,
  movePoint,
  parseCurve,
  removePoint,
  type AnimationCurve,
} from './curve';

const plateau: AnimationCurve = {
  points: [
    { x: 0, y: 0 },
    { x: 0.45, y: 0.98 },
    { x: 0.95, y: 0.98 },
    { x: 1, y: 1 },
  ],
  easings: [EASINGS.easeOutQuart, EASINGS.linear, EASINGS.easeInExpo],
};

describe('cubicBezierAt', () => {
  it('is exact at the ends and linear for linear', () => {
    expect(cubicBezierAt(EASINGS.ease, 0)).toBe(0);
    expect(cubicBezierAt(EASINGS.ease, 1)).toBe(1);
    expect(cubicBezierAt(EASINGS.linear, 0.37)).toBe(0.37);
  });

  it('matches known CSS values', () => {
    // ease-in-out is symmetric about the middle.
    expect(cubicBezierAt(EASINGS.easeInOut, 0.5)).toBeCloseTo(0.5, 5);
    // `ease` at 50% is ≈ 0.8024 (the browsers' value).
    expect(cubicBezierAt(EASINGS.ease, 0.5)).toBeCloseTo(0.8024, 3);
    // An overshooting easing goes past 1.
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => cubicBezierAt(EASINGS.easeOutBack, i / 50)))).toBeGreaterThan(1);
  });
});

describe('evalCurve', () => {
  it('walks the segments, holding flat ones exactly', () => {
    expect(evalCurve(plateau, 0)).toBe(0);
    expect(evalCurve(plateau, 0.45)).toBeCloseTo(0.98);
    expect(evalCurve(plateau, 0.7)).toBe(0.98);
    expect(evalCurve(plateau, 1)).toBe(1);
    expect(evalCurve(plateau, 2)).toBe(1);
    expect(evalCurve(plateau, -1)).toBe(0);
  });

  it('is monotonic for a monotonic curve', () => {
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const v = evalCurve(plateau, i / 200);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});

describe('curveKeyframes', () => {
  it('emits one keyframe per point with the opening segment easing', () => {
    const k = curveKeyframes(plateau, (y) => ({ opacity: y }));
    expect(k).toHaveLength(4);
    expect(k[0]).toEqual({ opacity: 0, offset: 0, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
    expect(k[1]!.easing).toBe('linear');
    expect(k[3]).toEqual({ opacity: 1, offset: 1 });
  });
});

describe('parseCurve', () => {
  it('accepts a good curve and rejects broken ones', () => {
    expect(parseCurve(plateau)).toEqual(plateau);
    expect(parseCurve(null)).toBeNull();
    expect(parseCurve({ points: [{ x: 0, y: 0 }], easings: [] })).toBeNull();
    expect(parseCurve({ ...plateau, easings: plateau.easings.slice(1) })).toBeNull();
    expect(parseCurve({ ...plateau, points: [{ x: 0.1, y: 0 }, ...plateau.points.slice(1)] })).toBeNull();
    expect(parseCurve({ ...curveFromEasing([1.5, 0, 1, 1]) })).toBeNull();
  });
});

describe('editing', () => {
  it('inserting a point keeps the curve shape', () => {
    const c = curveFromEasing(EASINGS.ease);
    const split = insertPoint(c, 0.3);
    expect(split.points).toHaveLength(3);
    expect(split.easings).toHaveLength(2);
    for (let i = 0; i <= 40; i++) {
      expect(evalCurve(split, i / 40)).toBeCloseTo(evalCurve(c, i / 40), 3);
    }
  });

  it('removing a point merges its segments', () => {
    const c = removePoint(plateau, 2);
    expect(c.points).toHaveLength(3);
    expect(c.easings).toHaveLength(2);
    expect(removePoint(plateau, 0)).toBe(plateau);
    expect(removePoint(plateau, 3)).toBe(plateau);
  });

  it('a point stays between its neighbours and the ends keep their x', () => {
    expect(movePoint(plateau, 1, { x: 0.99, y: 0.5 }).points[1]).toEqual({ x: 0.95, y: 0.5 });
    expect(movePoint(plateau, 0, { x: 0.3, y: 0.2 }).points[0]).toEqual({ x: 0, y: 0.2 });
    expect(movePoint(plateau, 3, { x: 0.3, y: 1.4 }).points[3]).toEqual({ x: 1, y: 1 });
  });

  it('a handle keeps its x inside the segment but may overshoot in y', () => {
    const c = moveHandle(curveFromEasing(EASINGS.linear), 0, 0, { x: -0.5, y: 1.6 });
    expect(c.easings[0]).toEqual([0, 1.6, 1, 1]);
    expect(curvesEqual(c, curveFromEasing([0, 1.6, 1, 1]))).toBe(true);
  });

  it('a flat segment keeps its handles on the line', () => {
    const c = moveHandle(plateau, 1, 0, { x: 0.6, y: 0.2 });
    expect(c.easings[1]![1]).toBe(0);
    expect(c.easings[1]![0]).toBeCloseTo(0.3);
  });
});
