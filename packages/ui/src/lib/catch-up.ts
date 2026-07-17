/**
 * Smooth "catch-up" for the progressive animations.
 *
 * When a progressive reveal is anchored to a `timestamp` (see ProgressiveText),
 * re-mounting it long after the anchor means there's a large *backlog* of
 * animation already due. Snapping straight to the due position skips the
 * animation entirely — which is what happens almost always. This helper instead
 * plays through the tail of that backlog quickly but with an ease-in / ease-out
 * velocity ramp that settles back into live (1×) speed.
 *
 * The trick is a **virtual clock**: `virtualElapsed(realMs)` maps real time since
 * the reveal mounted to the amount of *animation* time that should have played.
 * The components already drive their reveal off elapsed animation time, so they
 * just read this clock instead of raw wall time and get the eased fast-forward
 * for free.
 */

/**
 * Smootherstep (Ken Perlin's 2nd-order smoothstep): 0→1 with **zero first and
 * second derivative at both ends**, so a ramp built on it accelerates and
 * decelerates gently. Clamped to [0,1].
 */
export function smootherstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Easing for the catch-up ramp: 0→1, ideally flat-derivative at both ends. */
export type CatchUpEasing = (t: number) => number;

/**
 * How to ease through a catch-up backlog. As a **number** it's the shorthand for
 * `{ ms }` — the duration of the ramp. `ms <= 0` disables easing (instant snap,
 * the pre-0.21 behaviour).
 */
export type CatchUpConfig =
  | number
  | {
      /** Real milliseconds to spend easing through the backlog. */
      ms: number;
      /**
       * Max *content* (ms of animation) to actually play during the ramp; any
       * backlog beyond this is snapped instantly at mount so the ramp stays
       * short and bounded. @default `ms * 2`
       */
      window?: number;
      /** 0→1 ramp. @default {@link smootherstep} */
      easing?: CatchUpEasing;
    };

export interface NormalizedCatchUp {
  ms: number;
  window: number;
  easing: CatchUpEasing;
}

/** Resolve a {@link CatchUpConfig} (number shorthand or object) to its fields. */
export function normalizeCatchUp(config: CatchUpConfig | undefined): NormalizedCatchUp {
  if (config == null || config === 0) return { ms: 0, window: 0, easing: smootherstep };
  if (typeof config === 'number') {
    const ms = Math.max(0, config);
    return { ms, window: ms * 2, easing: smootherstep };
  }
  const ms = Math.max(0, config.ms);
  return {
    ms,
    window: config.window != null ? Math.max(0, config.window) : ms * 2,
    easing: config.easing ?? smootherstep,
  };
}

export interface CatchUpClock {
  /** True when the reveal was behind and an eased ramp is (or was) in play. */
  readonly easing: boolean;
  /** Virtual animation ms already played at mount (the instantly-snapped part). */
  readonly seedMs: number;
  /** Total backlog (ms) that was due at mount. */
  readonly backlogMs: number;
  /**
   * Virtual animation time (ms) that should be shown `realMs` after mount.
   * Monotonic; converges to `backlogMs + realMs` once the ramp completes, so a
   * still-growing (streaming) reveal is never double-counted.
   */
  virtualElapsed(realMs: number): number;
}

/**
 * Build a {@link CatchUpClock} for a reveal that is `backlogMs` behind at mount.
 *
 * With easing off (or no backlog) the clock is the identity plus an instant
 * snap: `seedMs = backlogMs`, `virtualElapsed(r) = backlogMs + r`.
 *
 * With easing on, the backlog is split into a **snapped** part (shown at once)
 * and an **eased window** played over `ms` real milliseconds along `easing`:
 *
 *   virtualElapsed(r) = seed + r + easedWindow · E(clamp(r / ms))
 *
 * `E` (smootherstep) has zero slope at 0 and 1, so the ramp starts and ends at
 * exactly live (1×) speed with a faster bulge in between — a gentle "whoosh to
 * now" rather than a hard cut or a full replay.
 */
export function makeCatchUpClock(backlogMs: number, config: CatchUpConfig | undefined): CatchUpClock {
  const backlog = Math.max(0, backlogMs);
  const { ms, window, easing } = normalizeCatchUp(config);

  // No easing, or nothing/too little to ease → instant snap to the due position.
  if (ms <= 0 || window <= 0 || backlog <= 0) {
    return {
      easing: false,
      seedMs: backlog,
      backlogMs: backlog,
      virtualElapsed: (realMs) => backlog + Math.max(0, realMs),
    };
  }

  const easedWindow = Math.min(window, backlog);
  const seed = backlog - easedWindow; // snapped instantly at mount

  return {
    easing: true,
    seedMs: seed,
    backlogMs: backlog,
    virtualElapsed: (realMs) => {
      const r = Math.max(0, realMs);
      const p = r >= ms ? 1 : easing(r / ms);
      return seed + r + easedWindow * p;
    },
  };
}
