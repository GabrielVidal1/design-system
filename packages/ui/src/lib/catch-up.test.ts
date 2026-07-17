import { describe, expect, it } from 'vitest';

import { makeCatchUpClock, normalizeCatchUp, smootherstep } from './catch-up';

describe('smootherstep', () => {
  it('is clamped and hits the endpoints exactly', () => {
    expect(smootherstep(-1)).toBe(0);
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(2)).toBe(1);
  });

  it('is symmetric about the midpoint (0.5 → 0.5)', () => {
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smootherstep(0.25) + smootherstep(0.75)).toBeCloseTo(1, 6);
  });

  it('has ~zero slope at both ends (gentle ease)', () => {
    const d = 1e-4;
    const slopeStart = (smootherstep(d) - smootherstep(0)) / d;
    const slopeEnd = (smootherstep(1) - smootherstep(1 - d)) / d;
    expect(slopeStart).toBeLessThan(0.01);
    expect(slopeEnd).toBeLessThan(0.01);
  });
});

describe('normalizeCatchUp', () => {
  it('treats 0 / undefined as disabled', () => {
    expect(normalizeCatchUp(undefined).ms).toBe(0);
    expect(normalizeCatchUp(0).ms).toBe(0);
  });

  it('number shorthand → ms with window = 2·ms', () => {
    expect(normalizeCatchUp(600)).toMatchObject({ ms: 600, window: 1200 });
  });

  it('object form keeps ms/window/easing', () => {
    const e = (t: number) => t;
    expect(normalizeCatchUp({ ms: 400, window: 500, easing: e })).toMatchObject({
      ms: 400,
      window: 500,
      easing: e,
    });
  });
});

describe('makeCatchUpClock', () => {
  it('with easing off, snaps instantly and then tracks live time', () => {
    const c = makeCatchUpClock(5000, 0);
    expect(c.easing).toBe(false);
    expect(c.seedMs).toBe(5000);
    expect(c.virtualElapsed(0)).toBe(5000);
    expect(c.virtualElapsed(1000)).toBe(6000);
  });

  it('with no backlog, is the identity even when easing is on', () => {
    const c = makeCatchUpClock(0, 600);
    expect(c.easing).toBe(false);
    expect(c.virtualElapsed(0)).toBe(0);
    expect(c.virtualElapsed(250)).toBe(250);
  });

  it('eases: starts at the snapped seed, converges to backlog+real at the ramp end', () => {
    // backlog 5000, ms 600 → window 1200, so easedWindow=1200, seed=3800.
    const c = makeCatchUpClock(5000, 600);
    expect(c.easing).toBe(true);
    expect(c.seedMs).toBe(3800);
    expect(c.virtualElapsed(0)).toBeCloseTo(3800, 6); // starts near-due, a window behind
    expect(c.virtualElapsed(600)).toBeCloseTo(5600, 6); // caught up: backlog + ms
    expect(c.virtualElapsed(1000)).toBeCloseTo(6000, 6); // then live: backlog + real
  });

  it('is monotonic across the ramp', () => {
    const c = makeCatchUpClock(4000, 800);
    let prev = -1;
    for (let r = 0; r <= 1600; r += 40) {
      const v = c.virtualElapsed(r);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('starts and ends the ramp at ~live (1×) velocity', () => {
    const c = makeCatchUpClock(4000, 800); // easedWindow 1600
    const d = 1;
    const vStart = (c.virtualElapsed(d) - c.virtualElapsed(0)) / d;
    const vEnd = (c.virtualElapsed(800) - c.virtualElapsed(800 - d)) / d;
    // both ends near 1 ms virtual per ms real; the middle bulges above 1
    expect(vStart).toBeCloseTo(1, 1);
    expect(vEnd).toBeCloseTo(1, 1);
    const vMid = (c.virtualElapsed(401) - c.virtualElapsed(400)) / d;
    expect(vMid).toBeGreaterThan(1.5);
  });

  it('a small backlog (< window) eases the whole backlog with no snap', () => {
    const c = makeCatchUpClock(300, 600); // window 1200 > backlog → seed 0
    expect(c.seedMs).toBe(0);
    expect(c.virtualElapsed(0)).toBeCloseTo(0, 6);
    expect(c.virtualElapsed(600)).toBeCloseTo(900, 6); // 300 backlog + 600 real
  });
});
