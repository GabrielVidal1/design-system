// Playback model for ProgressiveBash: the entry shape and the timestamp → delay
// compression that turns a sparse, real-time batch of commands into a lively,
// continuous animation.

export interface BashEntry {
  /** Stable id — a growing `entries` array is diffed by id, so streaming in a
   *  new batch never re-animates what already played. */
  id: string;
  /** The command line that was typed (the input). */
  command: string;
  /** Combined stdout/stderr the command produced (the output). Optional. */
  output?: string;
  /** Short human note shown as a `# comment` above the command. */
  description?: string;
  /** Working directory / prompt shown before the command. */
  cwd?: string;
  /** Exit status, if known (non-zero paints the prompt red). */
  exitCode?: number;
  /** Marks the whole entry as failed (paints prompt + output red). */
  isError?: boolean;
  /** Wall-clock time (ms since epoch) the command ran — drives the gap timing. */
  timestamp?: number;
}

export interface PlaybackTuning {
  /** Command typing rate, characters per second. */
  typeSpeed: number;
  /** Output reveal rate, lines per second. */
  outputSpeed: number;
  /** Fixed seconds between entries; overrides timestamp-derived gaps when set. */
  fixedDelay?: number;
  /** Floor for a computed inter-entry gap (ms). */
  minGapMs: number;
  /** Ceiling for a computed inter-entry gap (ms). */
  maxGapMs: number;
  /** Real-gap size (ms) that maps to ~76% of the way to `maxGapMs`. */
  gapReferenceMs: number;
  /** Beat between finishing the command and its output starting (ms). */
  thinkMs: number;
}

export const DEFAULT_TUNING: PlaybackTuning = {
  typeSpeed: 55,
  outputSpeed: 24,
  minGapMs: 220,
  maxGapMs: 1400,
  gapReferenceMs: 45_000,
  thinkMs: 260,
};

/**
 * Compress a real time-gap into a fixed, bounded playback delay.
 *
 * A batch of commands can span seconds or many minutes of wall-clock time;
 * replaying those gaps verbatim would leave the terminal frozen. Instead we map
 * the real gap through a saturating curve so the *ordering and relative pacing*
 * of the timestamps is preserved (a long think reads as a longer pause) while
 * the animation still plays continuously: every gap lands in
 * `[minGapMs, maxGapMs]`, and `gapReferenceMs` sets how quickly it saturates.
 *
 * With no timestamps (or a `fixedDelay`) it returns a constant delay.
 */
export function computeGapMs(
  prevTs: number | undefined,
  ts: number | undefined,
  t: PlaybackTuning,
): number {
  if (t.fixedDelay != null) return Math.max(0, t.fixedDelay * 1000);
  if (prevTs == null || ts == null) return t.minGapMs;
  const delta = Math.max(0, ts - prevTs);
  // tanh saturates: delta == gapReferenceMs → ~0.76 of the min→max span.
  const frac = Math.tanh(delta / Math.max(1, t.gapReferenceMs));
  return Math.round(t.minGapMs + (t.maxGapMs - t.minGapMs) * frac);
}
