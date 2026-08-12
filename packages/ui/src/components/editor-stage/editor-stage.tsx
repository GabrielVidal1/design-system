import * as React from 'react';

import { cn } from '../../lib/utils';

/** screen px = content units × `scale` + (`x`, `y`), relative to the stage box */
export interface StageViewport {
  scale: number;
  x: number;
  y: number;
}

export interface StagePointerEvent {
  /** position in content units — fractional; floor it for a tile index */
  x: number;
  y: number;
  button: number;
  buttons: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  pointerType: string;
  /** the pointer is on the stage but outside the content box */
  outside: boolean;
}

export interface EditorStageHandle {
  /** centre the content and zoom it to fill the stage, minus `padding` */
  fit: () => void;
  /** zoom about the middle of the stage */
  zoomBy: (factor: number) => void;
  setViewport: (v: StageViewport) => void;
  /** put a content point in the middle of the stage, keeping the zoom */
  centerOn: (x: number, y: number) => void;
  /** the live viewport, for handlers that run between renders */
  viewport: () => StageViewport;
}

export interface EditorStageProps {
  /** the content's size in its own units — px, tiles, millimetres, anything */
  contentWidth: number;
  contentHeight: number;
  /** Controlled viewport. Pair with `onViewportChange`; omit to let the stage
   *  own it. */
  viewport?: StageViewport;
  onViewportChange?: (v: StageViewport) => void;
  /** @default 0.25 */
  minScale?: number;
  /** @default 64 */
  maxScale?: number;
  /** empty space `fit` leaves around the content, in screen px. @default 24 */
  padding?: number;
  /** re-fit whenever the stage or the content changes size. @default true */
  autoFit?: boolean;
  /** wheel + pinch zoom. @default true */
  zoomable?: boolean;
  /** space-drag, middle-drag and two-finger pan. @default true */
  pannable?: boolean;
  /** Pointer gestures that are *not* a pan, with coordinates already converted
   *  into content units. */
  onStagePointerDown?: (e: StagePointerEvent) => void;
  onStagePointerMove?: (e: StagePointerEvent) => void;
  onStagePointerUp?: (e: StagePointerEvent) => void;
  /** the pointer left the surface with no button down — clear a hover preview */
  onStagePointerLeave?: () => void;
  /** the stage's own box whenever it changes — size a screen-space overlay to it */
  onResize?: (size: { width: number; height: number }) => void;
  /** cursor over the content while not panning. @default 'default' */
  cursor?: string;
  /** Drawn inside the transformed layer, in content units. */
  children?: React.ReactNode;
  /** Drawn on top, untransformed — grid hairlines, selection ants, a HUD.
   *  Called with the live viewport and the stage's size. */
  overlay?: (viewport: StageViewport, size: { width: number; height: number }) => React.ReactNode;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The canvas surface an editor is built on: content lives in its own
 * coordinate space and the stage owns the single transform between that space
 * and the screen — wheel and pinch zoom about the cursor, space-drag /
 * middle-drag / two-finger pan, and a fit-to-view that re-runs whenever the
 * surface or the content is resized.
 *
 * It knows nothing about what it is showing. `children` render inside the
 * transformed layer (so a 1-px-per-tile canvas can simply be scaled up with
 * `image-rendering: pixelated`), while `overlay` is called with the live
 * viewport for anything that must stay screen-sized — hairlines that should not
 * thicken with the zoom, selection ants, a HUD. Pointer gestures that are not a
 * pan arrive already converted into content units, so the consumer never does
 * the arithmetic itself.
 *
 * @summary Zoom/pan canvas surface for editors — wheel/pinch zoom about the
 * cursor, space- and two-finger pan, fit-to-view, and pointer events converted
 * into content coordinates.
 */
export const EditorStage = React.forwardRef<EditorStageHandle, EditorStageProps>(
  function EditorStage(
    {
      contentWidth,
      contentHeight,
      viewport: controlled,
      onViewportChange,
      minScale = 0.25,
      maxScale = 64,
      padding = 24,
      autoFit = true,
      zoomable = true,
      pannable = true,
      onStagePointerDown,
      onStagePointerMove,
      onStagePointerUp,
      onStagePointerLeave,
      onResize,
      cursor = 'default',
      children,
      overlay,
      className,
    },
    ref,
  ) {
    const boxRef = React.useRef<HTMLDivElement>(null);
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const [inner, setInner] = React.useState<StageViewport>({ scale: 1, x: 0, y: 0 });
    const vp = controlled ?? inner;
    // the viewport as of *now*, for handlers that fire faster than React renders
    const vpRef = React.useRef(vp);
    vpRef.current = vp;
    // through a ref so the ResizeObserver is installed once, not per render
    const onResizeRef = React.useRef(onResize);
    onResizeRef.current = onResize;

    const apply = React.useCallback(
      (next: StageViewport) => {
        vpRef.current = next;
        if (!controlled) setInner(next);
        onViewportChange?.(next);
      },
      [controlled, onViewportChange],
    );

    React.useLayoutEffect(() => {
      const el = boxRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => {
        const r = entry.contentRect;
        const next = { width: r.width, height: r.height };
        setSize(next);
        onResizeRef.current?.(next);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const fit = React.useCallback(() => {
      const { width, height } = size;
      if (!width || !height || !contentWidth || !contentHeight) return;
      const scale = clamp(
        Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight),
        minScale,
        maxScale,
      );
      apply({
        scale,
        x: (width - contentWidth * scale) / 2,
        y: (height - contentHeight * scale) / 2,
      });
    }, [size, contentWidth, contentHeight, padding, minScale, maxScale, apply]);

    // fit on the first measure and whenever the content changes shape — but
    // never again, or panning would be undone on the next render
    const fitKey = `${size.width}x${size.height}:${contentWidth}x${contentHeight}`;
    const lastFit = React.useRef('');
    React.useEffect(() => {
      if (!autoFit || !size.width || !size.height) return;
      if (lastFit.current === fitKey) return;
      lastFit.current = fitKey;
      fit();
    }, [autoFit, fitKey, fit, size.width, size.height]);

    const zoomAt = React.useCallback(
      (factor: number, sx: number, sy: number) => {
        const v = vpRef.current;
        const scale = clamp(v.scale * factor, minScale, maxScale);
        if (scale === v.scale) return;
        // keep the content point under (sx, sy) pinned there
        const k = scale / v.scale;
        apply({ scale, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k });
      },
      [apply, minScale, maxScale],
    );

    React.useEffect(() => {
      const el = boxRef.current;
      if (!el || !zoomable) return;
      // registered by hand because React's wheel listener is passive, and a
      // passive handler cannot preventDefault — the page would scroll instead
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        // a trackpad pinch arrives as ctrl+wheel with small deltas; the shared
        // exponential makes a mouse notch and a pinch feel alike
        const step = e.ctrlKey ? 0.01 : 0.0025;
        zoomAt(Math.exp(-e.deltaY * step), e.clientX - r.left, e.clientY - r.top);
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [zoomable, zoomAt]);

    const [spaceHeld, setSpaceHeld] = React.useState(false);
    React.useEffect(() => {
      if (!pannable) return;
      const isTyping = (t: EventTarget | null) =>
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
      const down = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isTyping(e.target)) {
          e.preventDefault(); // or the page scrolls under the stage
          setSpaceHeld(true);
        }
      };
      const up = (e: KeyboardEvent) => {
        if (e.code === 'Space') setSpaceHeld(false);
      };
      const blur = () => setSpaceHeld(false);
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      window.addEventListener('blur', blur);
      return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        window.removeEventListener('blur', blur);
      };
    }, [pannable]);

    /** live touches, so two fingers can be told from one */
    const touches = React.useRef(new Map<number, { x: number; y: number }>());
    const panFrom = React.useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
    const pinchFrom = React.useRef<{ dist: number } | null>(null);
    const drawing = React.useRef(false);

    const local = (e: { clientX: number; clientY: number }) => {
      const r = boxRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const stageEvent = (
      e: React.PointerEvent,
      sx: number,
      sy: number,
    ): StagePointerEvent => {
      const v = vpRef.current;
      const x = (sx - v.x) / v.scale;
      const y = (sy - v.y) / v.scale;
      return {
        x,
        y,
        button: e.button,
        buttons: e.buttons,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        pointerType: e.pointerType,
        outside: x < 0 || y < 0 || x >= contentWidth || y >= contentHeight,
      };
    };

    const handleDown = (e: React.PointerEvent) => {
      const p = local(e);
      if (e.pointerType === 'touch') touches.current.set(e.pointerId, p);
      e.currentTarget.setPointerCapture(e.pointerId);

      // a second finger turns the gesture into a pinch/pan and cancels
      // whatever the first one had started drawing
      if (pannable && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        pinchFrom.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
        const v = vpRef.current;
        panFrom.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: v.x, vy: v.y };
        if (drawing.current) {
          drawing.current = false;
          onStagePointerUp?.(stageEvent(e, p.x, p.y));
        }
        return;
      }

      if (pannable && (e.button === 1 || spaceHeld)) {
        const v = vpRef.current;
        panFrom.current = { x: p.x, y: p.y, vx: v.x, vy: v.y };
        return;
      }
      drawing.current = true;
      onStagePointerDown?.(stageEvent(e, p.x, p.y));
    };

    const handleMove = (e: React.PointerEvent) => {
      const p = local(e);
      if (e.pointerType === 'touch' && touches.current.has(e.pointerId))
        touches.current.set(e.pointerId, p);

      if (pinchFrom.current && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        if (pinchFrom.current.dist > 0) zoomAt(dist / pinchFrom.current.dist, cx, cy);
        const pan = panFrom.current;
        if (pan) {
          const v = vpRef.current;
          apply({ scale: v.scale, x: v.x + (cx - pan.x), y: v.y + (cy - pan.y) });
          panFrom.current = { x: cx, y: cy, vx: v.x, vy: v.y };
        }
        pinchFrom.current = { dist };
        return;
      }

      if (panFrom.current && !drawing.current) {
        const from = panFrom.current;
        const v = vpRef.current;
        apply({ scale: v.scale, x: from.vx + (p.x - from.x), y: from.vy + (p.y - from.y) });
        return;
      }

      onStagePointerMove?.(stageEvent(e, p.x, p.y));
    };

    const endPointer = (e: React.PointerEvent) => {
      const p = local(e);
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinchFrom.current = null;
      if (touches.current.size === 0) panFrom.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      if (drawing.current) {
        drawing.current = false;
        onStagePointerUp?.(stageEvent(e, p.x, p.y));
      }
    };

    React.useImperativeHandle(
      ref,
      () => ({
        fit,
        zoomBy: (factor: number) => zoomAt(factor, size.width / 2, size.height / 2),
        setViewport: apply,
        centerOn: (x: number, y: number) => {
          const v = vpRef.current;
          apply({
            scale: v.scale,
            x: size.width / 2 - x * v.scale,
            y: size.height / 2 - y * v.scale,
          });
        },
        viewport: () => vpRef.current,
      }),
      [fit, zoomAt, apply, size.width, size.height],
    );

    return (
      <div
        ref={boxRef}
        className={cn('relative select-none overflow-hidden', className)}
        style={{ touchAction: 'none', cursor: spaceHeld ? 'grab' : cursor }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => {
          if (!drawing.current && !panFrom.current) onStagePointerLeave?.();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: contentWidth,
            height: contentHeight,
            transformOrigin: '0 0',
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`,
            willChange: 'transform',
          }}
        >
          {children}
        </div>
        {overlay?.(vp, size)}
      </div>
    );
  },
);
