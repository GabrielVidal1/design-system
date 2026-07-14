import { useEffect, useRef } from 'react';

/**
 * The segmented progress bar that sits across the top of story mode — one
 * segment per slide, filled for the ones already seen, animating for the
 * current one, empty for the rest.
 *
 * The fill is driven imperatively (a CSS transform written straight to the
 * node) rather than through React state: the current segment repaints every
 * frame, and re-rendering the whole overlay 60×/s to move one bar would stall
 * the video decode and the pan gesture running beside it.
 *
 * `progress` is a ref the parent keeps up to date (0→1 for the active slide);
 * this component samples it on a rAF loop while `running`.
 */
export function StoryProgress({
  count,
  index,
  progress,
  running,
}: {
  count: number;
  index: number;
  /** Live 0→1 completion of the active slide, read every frame. */
  progress: { current: number };
  /** Whether to keep sampling (false while paused / seeking). */
  running: boolean;
}) {
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      // Paint even when paused, so a pause lands the bar at its true position;
      // the loop simply stops re-scheduling.
      el.style.transform = `scaleX(${Math.min(1, Math.max(0, progress.current))})`;
      if (running) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [progress, running, index]);

  return (
    <div className="viewer-story-bars" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="viewer-story-bar">
          {i < index && <span className="viewer-story-fill is-done" />}
          {i === index && <span ref={fillRef} className="viewer-story-fill" />}
        </span>
      ))}
    </div>
  );
}
