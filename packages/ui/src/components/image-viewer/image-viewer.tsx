import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * A reusable full-screen image viewer with zoom/pan + a swipe/arrow carousel.
 *
 * Wrap the app in {@link ImageViewerProvider}; anywhere inside, call
 * `useImageViewer().open(images, index)` to launch the overlay over a group of
 * image URLs. The {@link ViewableImage} wrapper does this on click. The overlay
 * is portalled to `<body>`, locks page scroll, and supports:
 *   • wheel / pinch / double-tap / +− keys to zoom (about the cursor/midpoint)
 *   • drag to pan when zoomed
 *   • horizontal swipe (touch) or ←/→ arrows + on-screen chevrons to browse
 *   • Escape or a tap on the backdrop to close
 *   • a vertical swipe to dismiss (with a live backdrop fade)
 *
 * Styling lives in `@gabvdl/ui/image-viewer.css` (all `.viewer-*` classes),
 * themeable through the `--ds-viewer-*` custom properties.
 */
interface ImageViewerContextValue {
  /** Open the overlay over `images`, starting at `index` (default 0). */
  open: (images: string[], index?: number) => void;
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
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);

  const open = useCallback((imgs: string[], i = 0) => {
    if (!imgs.length) return;
    setImages(imgs);
    setIndex(clamp(i, 0, imgs.length - 1));
  }, []);
  const close = useCallback(() => setImages(null), []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {images &&
        createPortal(
          <Overlay images={images} index={index} setIndex={setIndex} close={close} />,
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
  images,
  index,
  setIndex,
  close,
}: {
  images: string[];
  index: number;
  setIndex: (updater: (i: number) => number) => void;
  close: () => void;
}) {
  const count = images.length;
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const t = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef(0);
  const [zoomed, setZoomed] = useState(false);

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count, setIndex]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count, setIndex]);

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

  // Reset zoom/pan whenever the shown image changes.
  useEffect(() => {
    reset();
  }, [index, reset]);

  // Lock page scroll while the viewer is open + preload the neighbours.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);
  useEffect(() => {
    if (count < 2) return;
    [images[(index + 1) % count], images[(index - 1 + count) % count]].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [images, index, count]);

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
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTransition(false);
      zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, e.clientX, e.clientY);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Keyboard: arrows browse, +/- zoom, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === '+' || e.key === '=') zoomCenter(1.25);
      else if (e.key === '-') zoomCenter(0.8);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, next, prev]);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setTransition(false);

    if (pointers.current.size === 2) {
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

    gesture.current = {
      mode: t.current.scale > 1.01 ? 'pan' : 'swipe',
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

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;

    if (g.mode === 'pan') {
      t.current.x = g.baseX + dx;
      t.current.y = g.baseY + dy;
      clampPan();
      apply();
    } else if (g.mode === 'swipe') {
      // Horizontal → carousel feedback; vertical → drag-to-dismiss feedback.
      const vertical = Math.abs(dy) > Math.abs(dx);
      t.current.x = count > 1 ? dx : dx * 0.25;
      t.current.y = dy;
      apply();
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
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
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
        // A stationary tap on the empty backdrop (not the image) closes.
        if (!g.moved && e.target === stageRef.current) close();
      }
    } else if (g.mode === 'pan') {
      setTransition(true);
      clampPan();
      apply();
    }
    gesture.current = null;
  };

  // Tapping the empty backdrop (not the image) closes.
  const onStageClick = (e: React.MouseEvent) => {
    if (e.target === stageRef.current) close();
  };

  return (
    <div className="viewer-overlay" ref={overlayRef} role="dialog" aria-modal="true">
      <div
        ref={stageRef}
        className={`viewer-stage${zoomed ? ' is-zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClick={onStageClick}
      >
        <img
          ref={imgRef}
          key={index}
          src={images[index]}
          alt={`Image ${index + 1} of ${count}`}
          className="viewer-img"
          draggable={false}
        />
      </div>

      <button className="viewer-ctl viewer-close" onClick={close} aria-label="Close">
        <X />
      </button>

      <div className="viewer-zoom">
        <button className="viewer-ctl" onClick={() => zoomCenter(1 / 1.25)} aria-label="Zoom out">
          <ZoomOut />
        </button>
        <button className="viewer-ctl" onClick={() => zoomCenter(1.25)} aria-label="Zoom in">
          <ZoomIn />
        </button>
      </div>

      {count > 1 && (
        <>
          <button
            className="viewer-ctl viewer-nav viewer-nav--prev"
            onClick={prev}
            aria-label="Previous image"
          >
            <ChevronLeft />
          </button>
          <button
            className="viewer-ctl viewer-nav viewer-nav--next"
            onClick={next}
            aria-label="Next image"
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
