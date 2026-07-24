import * as React from 'react';

import { usePrefersReducedMotion } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';

export interface SplitViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The layer shown on the left / top of the divide. */
  before: React.ReactNode;
  /** The layer shown on the right / bottom, revealed as the handle moves. */
  after: React.ReactNode;
  /** Controlled reveal position, 0–100. Pair with `onValueChange`. */
  value?: number;
  /** Uncontrolled initial position. @default 50 */
  defaultValue?: number;
  /** Fires on every change — while dragging, and on each key press. */
  onValueChange?: (value: number) => void;
  /**
   * Sweep the handle back and forth on its own — a passive before/after
   * showcase rather than something a visitor drags. Dragging still works
   * unless `readonly` is also set; a drag pauses the sweep and it resumes
   * from the released position. Disabled automatically under
   * `prefers-reduced-motion: reduce`, which freezes the handle at 50%.
   * @default false
   */
  autoplay?: boolean;
  /** One full sweep (0→100→0), in ms. @default 4000 */
  autoplayDurationMs?: number;
  /** Disable the drag handle entirely — for a purely animated showcase. @default false */
  readonly?: boolean;
  /** Accessible label for the handle. @default 'Comparison position' */
  label?: string;
  /** Labels shown as small captions over each side, e.g. `{ before: 'Before', after: 'After' }'. */
  captions?: { before?: React.ReactNode; after?: React.ReactNode };
}

/** Snap a raw pointer ratio to a 0–100 percentage. */
function clampPct(raw: number): number {
  return Math.min(100, Math.max(0, raw));
}

/**
 * A before/after image comparison — two layers on top of each other, the top
 * one clipped at a handle the visitor drags (or that sweeps on its own in
 * `autoplay` mode). Full pointer-capture drag plus arrow/Home/End keyboard
 * support on the handle, mirroring {@link Slider}'s track interaction.
 *
 * `before`/`after` accept any node, not just `<img>` — an `autoplay` demo
 * commonly pairs a photo with a pixelated/filtered version of itself.
 *
 * @summary Draggable (or auto-sweeping) before/after comparison of two
 * stacked layers.
 */
export function SplitView({
  before,
  after,
  value,
  defaultValue = 50,
  onValueChange,
  autoplay = false,
  autoplayDurationMs = 4000,
  readonly = false,
  label = 'Comparison position',
  captions,
  className,
  ...props
}: SplitViewProps) {
  const reducedMotion = usePrefersReducedMotion();
  const sweeping = autoplay && !reducedMotion;

  const [own, setOwn] = React.useState(() => clampPct(defaultValue));
  const current = clampPct(value ?? own);
  const container = React.useRef<HTMLDivElement>(null);
  const handle = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const latest = React.useRef(current);
  latest.current = current;

  const change = (next: number) => {
    if (next === latest.current) return;
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
    latest.current = next;
  };

  // Autoplay sweep: a rAF loop drives the handle directly via a ref, so it
  // doesn't re-render on every frame — same shape as ImageViewer's story
  // clock. Paused while dragging or once the visitor takes control.
  React.useEffect(() => {
    if (!sweeping || dragging.current) return;
    let raf = 0;
    let cancelled = false;
    const startedAt = performance.now();
    const base = latest.current;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startedAt;
      const half = autoplayDurationMs / 2;
      // Triangle wave from `base`: down to 0, up to 100, back down — so a
      // mount mid-sweep still reads as continuous motion.
      const t = (elapsed % autoplayDurationMs) / half;
      const wave = t < 1 ? t : 2 - t;
      const next = clampPct(wave * 100);
      if (next !== latest.current) {
        latest.current = next;
        if (handle.current) handle.current.style.left = `${next}%`;
        const fg = handle.current?.previousElementSibling as HTMLElement | null;
        if (fg) fg.style.clipPath = `inset(0 ${100 - next}% 0 0)`;
        if (value === undefined) setOwn(next);
        onValueChange?.(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    void base;
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweeping, autoplayDurationMs]);

  const fromPointer = (e: { clientX: number }) => {
    const el = container.current;
    if (!el) return latest.current;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return latest.current;
    return clampPct(((e.clientX - rect.left) / rect.width) * 100);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readonly) return;
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    change(fromPointer(e));
    handle.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || readonly) return;
    change(fromPointer(e));
  };

  const endDrag = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readonly) return;
    const step = 2;
    const moves: Record<string, number> = {
      ArrowRight: current + step,
      ArrowUp: current + step,
      ArrowLeft: current - step,
      ArrowDown: current - step,
      Home: 0,
      End: 100,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    change(clampPct(next));
  };

  return (
    <div
      ref={container}
      className={cn(
        'relative aspect-[3/2] w-full touch-none overflow-hidden rounded-lg select-none',
        readonly ? '' : 'cursor-ew-resize',
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      {...props}
    >
      <div className="absolute inset-0">{after}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - current}% 0 0)` }}>
        {before}
      </div>

      {captions?.before && (
        <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
          {captions.before}
        </span>
      )}
      {captions?.after && (
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
          {captions.after}
        </span>
      )}

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
        style={{ left: `${current}%` }}
      />
      <div
        ref={handle}
        role={readonly ? undefined : 'slider'}
        tabIndex={readonly ? undefined : 0}
        aria-label={readonly ? undefined : label}
        aria-valuemin={readonly ? undefined : 0}
        aria-valuemax={readonly ? undefined : 100}
        aria-valuenow={readonly ? undefined : current}
        aria-orientation={readonly ? undefined : 'horizontal'}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary bg-background shadow-md outline-none',
          readonly ? 'pointer-events-none' : 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
        style={{ left: `${current}%` }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M5 2 2 7l3 5M9 2l3 5-3 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
