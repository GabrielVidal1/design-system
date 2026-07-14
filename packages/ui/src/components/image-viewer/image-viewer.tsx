import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

import { StoryProgress } from './story-progress';
import { toViewerMedia, type ViewerMedia, type ViewerOptions } from './types';
import { ViewerVideo, type ViewerVideoHandle } from './viewer-video';

/**
 * A reusable full-screen media viewer: zoom/pan images, play videos, and — in
 * story mode — auto-advance the slides behind a segmented progress bar.
 *
 * Wrap the app in {@link ImageViewerProvider}; anywhere inside, call
 * `useImageViewer().open(items, options)` to launch the overlay over a group of
 * slides. `items` is either a list of image URLs (the original image-only API)
 * or a list of {@link ViewerMedia}, which can carry video. The
 * {@link ViewableImage} wrapper opens it on click. The overlay is portalled to
 * `<body>`, locks page scroll, and supports:
 *   • wheel / pinch / double-tap / +− keys to zoom an image (about the cursor)
 *   • drag to pan when zoomed
 *   • horizontal swipe (touch) or ←/→ arrows + on-screen chevrons to browse
 *   • Escape or a tap on the backdrop to close
 *   • a vertical swipe to dismiss (with a live backdrop fade)
 *
 * Passing `{ story: true }` switches it to the Instagram/Snapchat reading of
 * the same slides: a progress bar across the top, images held for a few seconds
 * and videos played to their end, tap-left/tap-right to step, press-and-hold to
 * pause, and an auto-close when the last slide finishes. Zoom is off in story
 * mode — a press there is a pause, not a zoom.
 *
 * Styling lives in `@gabvdl/ui/image-viewer.css` (all `.viewer-*` classes),
 * themeable through the `--ds-viewer-*` custom properties.
 */
interface ImageViewerContextValue {
  /**
   * Open the overlay over `items` — image URLs, or {@link ViewerMedia} slides
   * that may include video.
   *
   * The second argument is either a start index (the original signature) or a
   * {@link ViewerOptions} object, which additionally turns on story mode.
   */
  open: (items: (string | ViewerMedia)[], options?: number | ViewerOptions) => void;
  /** Close the overlay. */
  close: () => void;
}

const Ctx = createContext<ImageViewerContextValue | null>(null);

/** Access the ambient {@link ImageViewerProvider}. Throws if used outside one. */
export function useImageViewer(): ImageViewerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useImageViewer must be used within <ImageViewerProvider>');
  return v;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SWIPE_PX = 60;
const CLOSE_PX = 90;
/** How long an image is held in story mode when the caller sets no duration. */
const DEFAULT_IMAGE_MS = 5000;
/** A press longer than this is a story-mode pause, not a tap-to-step. */
const HOLD_MS = 220;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface OpenState {
  media: ViewerMedia[];
  index: number;
  opts: ViewerOptions;
}

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenState | null>(null);

  const open = useCallback((items: (string | ViewerMedia)[], options?: number | ViewerOptions) => {
    if (!items.length) return;
    // The original signature took a bare start index; the options object is the
    // widened form. Both are still accepted.
    const opts: ViewerOptions = typeof options === 'number' ? { index: options } : (options ?? {});
    const media = items.map(toViewerMedia);
    setState({ media, index: clamp(opts.index ?? 0, 0, media.length - 1), opts });
  }, []);
  const close = useCallback(() => setState(null), []);

  const setIndex = useCallback((updater: (i: number) => number) => {
    setState((s) => (s ? { ...s, index: clamp(updater(s.index), 0, s.media.length - 1) } : s));
  }, []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {state &&
        createPortal(
          <Overlay
            media={state.media}
            index={state.index}
            opts={state.opts}
            setIndex={setIndex}
            close={close}
          />,
          document.body,
        )}
    </Ctx.Provider>
  );
}

interface Gesture {
  mode: 'pan' | 'swipe' | 'pinch';
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  startDist?: number;
  baseScale?: number;
  startMidX?: number;
  startMidY?: number;
  moved: boolean;
}

function Overlay({
  media,
  index,
  opts,
  setIndex,
  close,
}: {
  media: ViewerMedia[];
  index: number;
  opts: ViewerOptions;
  setIndex: (updater: (i: number) => number) => void;
  close: () => void;
}) {
  const count = media.length;
  const current = media[index];
  const isVideo = current.kind === 'video';
  const story = !!opts.story;

  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<ViewerVideoHandle>(null);
  const t = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef(0);
  const [zoomed, setZoomed] = useState(false);
  // Story mode: pressed and held → the slide freezes.
  const [held, setHeld] = useState(false);

  // Zoom and pan only make sense on a still image you are free to linger on. A
  // video has no transform surface of its own, and in story mode a press means
  // pause — so both opt out of the gesture stack.
  const zoomable = !isVideo && !story;

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count, setIndex]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count, setIndex]);

  // Story mode never wraps: past the last slide the story is simply over.
  const onComplete = opts.onComplete;
  const advance = useCallback(() => {
    if (index >= count - 1) {
      onComplete?.();
      close();
      return;
    }
    setIndex((i) => i + 1);
  }, [index, count, onComplete, close, setIndex]);

  const storyStep = useCallback(
    (dir: 1 | -1) => {
      if (dir === 1) advance();
      else setIndex((i) => Math.max(0, i - 1));
    },
    [advance, setIndex],
  );

  const apply = useCallback(() => {
    const el = imgRef.current;
    if (el)
      el.style.transform = `translate3d(${t.current.x}px, ${t.current.y}px, 0) scale(${t.current.scale})`;
  }, []);

  const setTransition = (on: boolean) => {
    const el = imgRef.current;
    if (el) el.style.transition = on ? 'transform 0.22s ease' : 'none';
  };

  const reset = useCallback(() => {
    t.current = { scale: 1, x: 0, y: 0 };
    setZoomed(false);
    setTransition(true);
    apply();
    if (overlayRef.current) overlayRef.current.style.opacity = '';
  }, [apply]);

  // Reset zoom/pan whenever the shown slide changes.
  useEffect(() => {
    reset();
  }, [index, reset]);

  // Lock page scroll while the viewer is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Preload the neighbouring images. A video streams on demand — there is
  // nothing to warm, and prefetching one would fight the playing clip for
  // bandwidth.
  useEffect(() => {
    if (count < 2) return;
    [media[(index + 1) % count], media[(index - 1 + count) % count]].forEach((m) => {
      if (m.kind !== 'image') return;
      const img = new Image();
      img.src = m.src;
    });
  }, [media, index, count]);

  /* ------------------------------- story clock ------------------------------ */

  // 0→1 completion of the active slide. A ref, not state: StoryProgress samples
  // it every frame, and re-rendering the overlay 60×/s to move one bar would
  // fight the video decode for the main thread.
  const progress = useRef(0);
  // A video reports its true length once metadata lands. Until then the loop has
  // nothing to divide by, so re-run it when the duration arrives.
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const imageMs = current.durationMs ?? opts.imageDurationMs ?? DEFAULT_IMAGE_MS;

  // Entering a slide rewinds its bar and forgets the previous clip's duration.
  // Kept apart from the clock below so a pause/resume — which re-runs that
  // effect — doesn't also restart the slide.
  useEffect(() => {
    progress.current = 0;
    setVideoDuration(null);
  }, [index]);

  useEffect(() => {
    if (!story || held) return;

    let raf = 0;
    let cancelled = false;

    if (isVideo) {
      // The clip is its own clock: the bar tracks playback, not wall time, so a
      // buffering video can't leave it running ahead of the picture. The
      // video's `onEnded` — not this loop — advances the slide.
      const tick = () => {
        if (cancelled) return;
        progress.current = videoRef.current?.progress() ?? 0;
        raf = requestAnimationFrame(tick);
      };
      tick();
    } else {
      // An image has no clock, so wall time drives it. Resuming from a hold
      // starts from the fraction already shown rather than rewinding the slide.
      const startedAt = performance.now();
      const base = progress.current;
      const tick = () => {
        if (cancelled) return;
        const done = base + (performance.now() - startedAt) / imageMs;
        if (done >= 1) {
          progress.current = 1;
          advance();
          return;
        }
        progress.current = done;
        raf = requestAnimationFrame(tick);
      };
      tick();
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [story, held, isVideo, index, imageMs, advance, videoDuration]);

  /* --------------------------------- zoom ---------------------------------- */

  const clampPan = () => {
    const el = imgRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const sc = t.current.scale;
    const maxX = Math.max(0, (el.clientWidth * sc - stage.clientWidth) / 2);
    const maxY = Math.max(0, (el.clientHeight * sc - stage.clientHeight) / 2);
    t.current.x = clamp(t.current.x, -maxX, maxX);
    t.current.y = clamp(t.current.y, -maxY, maxY);
  };

  // Zoom by `factor` while keeping the point (cx,cy) — in client coords — fixed.
  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const ox = cx - rect.left - rect.width / 2;
      const oy = cy - rect.top - rect.height / 2;
      const prevScale = t.current.scale;
      const nextScale = clamp(prevScale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = nextScale / prevScale;
      t.current.x = ox - (ox - t.current.x) * ratio;
      t.current.y = oy - (oy - t.current.y) * ratio;
      t.current.scale = nextScale;
      if (nextScale <= 1.001) {
        t.current.x = 0;
        t.current.y = 0;
      }
      clampPan();
      setZoomed(nextScale > 1.01);
      apply();
    },
    [apply],
  );

  const zoomCenter = (factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    setTransition(true);
    zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  };

  // Non-passive wheel listener so we can preventDefault the page zoom/scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTransition(false);
      zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, e.clientX, e.clientY);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt, zoomable]);

  // Keyboard: arrows browse, +/- zoom an image, space pauses a story, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') (story ? storyStep(1) : next());
      else if (e.key === 'ArrowLeft') (story ? storyStep(-1) : prev());
      else if (story && e.key === ' ') {
        e.preventDefault();
        setHeld((h) => !h);
      } else if (zoomable && (e.key === '+' || e.key === '=')) zoomCenter(1.25);
      else if (zoomable && e.key === '-') zoomCenter(0.8);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, next, prev, story, storyStep, zoomable]);

  /* -------------------------------- pointers -------------------------------- */

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  // Story mode: a press that outlives HOLD_MS is a pause, so the tap-to-step
  // only fires on release if the timer never got there.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (story) {
      didHold.current = false;
      holdTimer.current = setTimeout(() => {
        didHold.current = true;
        setHeld(true);
      }, HOLD_MS);
      gesture.current = {
        mode: 'swipe',
        startX: e.clientX,
        startY: e.clientY,
        baseX: 0,
        baseY: 0,
        moved: false,
      };
      return;
    }

    setTransition(false);

    if (zoomable && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        mode: 'pinch',
        startX: e.clientX,
        startY: e.clientY,
        baseX: t.current.x,
        baseY: t.current.y,
        startDist: dist(a, b),
        baseScale: t.current.scale,
        startMidX: (a.x + b.x) / 2,
        startMidY: (a.y + b.y) / 2,
        moved: false,
      };
      return;
    }

    // Double-tap / double-click toggles zoom.
    if (zoomable) {
      const now = e.timeStamp;
      if (now - lastTap.current < 300) {
        setTransition(true);
        if (t.current.scale > 1.01) reset();
        else zoomAt(2.4, e.clientX, e.clientY);
        lastTap.current = 0;
        gesture.current = null;
        return;
      }
      lastTap.current = now;
    }

    gesture.current = {
      mode: zoomable && t.current.scale > 1.01 ? 'pan' : 'swipe',
      startX: e.clientX,
      startY: e.clientY,
      baseX: t.current.x,
      baseY: t.current.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (story) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
      // A real drag is a dismiss, not a press: drop the pending hold so it
      // can't fire mid-swipe and freeze the story under the finger.
      if (g.moved && holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      // Only the vertical drag gets live feedback — a story's horizontal axis
      // belongs to the tap zones, not to a rubber-band.
      if (Math.abs(dy) > Math.abs(dx) && overlayRef.current)
        overlayRef.current.style.opacity = String(clamp(1 - Math.abs(dy) / 500, 0.35, 1));
      return;
    }

    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const ratio = dist(a, b) / (g.startDist || 1);
      t.current.scale = clamp((g.baseScale || 1) * ratio, MIN_SCALE, MAX_SCALE);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      t.current.x = g.baseX + (midX - (g.startMidX || midX));
      t.current.y = g.baseY + (midY - (g.startMidY || midY));
      clampPan();
      setZoomed(t.current.scale > 1.01);
      apply();
      g.moved = true;
      return;
    }

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;

    if (g.mode === 'pan') {
      t.current.x = g.baseX + dx;
      t.current.y = g.baseY + dy;
      clampPan();
      apply();
    } else if (g.mode === 'swipe') {
      // Horizontal → carousel feedback; vertical → drag-to-dismiss feedback. A
      // video has no transform to drag, so its slide only gets the fade.
      const vertical = Math.abs(dy) > Math.abs(dx);
      if (!isVideo) {
        t.current.x = count > 1 ? dx : dx * 0.25;
        t.current.y = dy;
        apply();
      }
      if (overlayRef.current)
        overlayRef.current.style.opacity = vertical
          ? String(clamp(1 - Math.abs(dy) / 500, 0.35, 1))
          : '1';
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (story) {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      if (overlayRef.current) overlayRef.current.style.opacity = '';
      gesture.current = null;

      // The press was a pause: releasing resumes it, and must not also step.
      if (didHold.current) {
        didHold.current = false;
        setHeld(false);
        return;
      }
      // A vertical fling still dismisses — the one drag story mode keeps.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > CLOSE_PX) {
        close();
        return;
      }
      if (g.moved) return;

      // A stationary tap steps: the left third goes back, anywhere else forward.
      const w = overlayRef.current?.clientWidth ?? window.innerWidth;
      storyStep(e.clientX < w * 0.3 ? -1 : 1);
      return;
    }

    if (g.mode === 'pinch') {
      // Lifting one finger: continue panning with the remaining one, or settle.
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        gesture.current = {
          mode: t.current.scale > 1.01 ? 'pan' : 'swipe',
          startX: p.x,
          startY: p.y,
          baseX: t.current.x,
          baseY: t.current.y,
          moved: false,
        };
      } else {
        if (t.current.scale <= 1.01) reset();
        else {
          setTransition(true);
          clampPan();
          apply();
          gesture.current = null;
        }
      }
      return;
    }

    if (g.mode === 'swipe') {
      // A vertical swipe (up or down) past the threshold dismisses the viewer.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > CLOSE_PX) {
        close();
        return;
      }
      if (count > 1 && Math.abs(dx) > SWIPE_PX) {
        if (dx < 0) next();
        else prev();
      } else {
        setTransition(true);
        t.current.x = 0;
        t.current.y = 0;
        apply();
        if (overlayRef.current) overlayRef.current.style.opacity = '';
        // A stationary tap on the empty backdrop (not the media) closes.
        if (!g.moved && e.target === stageRef.current) close();
      }
    } else if (g.mode === 'pan') {
      setTransition(true);
      clampPan();
      apply();
    }
    gesture.current = null;
  };

  // Tapping the empty backdrop (not the media) closes. Story mode owns every tap
  // on the stage — they step slides — so it opts out.
  const onStageClick = (e: React.MouseEvent) => {
    if (!story && e.target === stageRef.current) close();
  };

  const stageClass = useMemo(
    () =>
      ['viewer-stage', zoomed && 'is-zoomed', story && 'is-story', !zoomable && 'is-static']
        .filter(Boolean)
        .join(' '),
    [zoomed, story, zoomable],
  );

  return (
    <div
      className={`viewer-overlay${story ? ' is-story' : ''}`}
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
    >
      {story && <StoryProgress count={count} index={index} progress={progress} running={!held} />}

      <div
        ref={stageRef}
        className={stageClass}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClick={onStageClick}
      >
        {isVideo ? (
          <ViewerVideo
            ref={videoRef}
            key={index}
            src={current.src}
            poster={current.poster}
            active
            paused={held}
            story={story}
            onEnded={advance}
            onDuration={setVideoDuration}
          />
        ) : (
          <img
            ref={imgRef}
            key={index}
            src={current.src}
            alt={current.alt ?? `Image ${index + 1} of ${count}`}
            className="viewer-img"
            draggable={false}
          />
        )}
      </div>

      <button className="viewer-ctl viewer-close" onClick={close} aria-label="Close">
        <X />
      </button>

      {zoomable && (
        <div className="viewer-zoom">
          <button className="viewer-ctl" onClick={() => zoomCenter(1 / 1.25)} aria-label="Zoom out">
            <ZoomOut />
          </button>
          <button className="viewer-ctl" onClick={() => zoomCenter(1.25)} aria-label="Zoom in">
            <ZoomIn />
          </button>
        </div>
      )}

      {count > 1 && !story && (
        <>
          <button
            className="viewer-ctl viewer-nav viewer-nav--prev"
            onClick={prev}
            aria-label="Previous"
          >
            <ChevronLeft />
          </button>
          <button
            className="viewer-ctl viewer-nav viewer-nav--next"
            onClick={next}
            aria-label="Next"
          >
            <ChevronRight />
          </button>
          <div className="viewer-counter">
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
}
