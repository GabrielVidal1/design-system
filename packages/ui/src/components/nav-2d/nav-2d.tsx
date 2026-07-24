import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * `Nav2D` — a spatial, joystick-driven way to navigate an interface with one
 * thumb, built for touch.
 *
 * Wrap a tree in {@link Nav2DProvider} and mark the reachable targets with
 * {@link Nav2DItem}. The provider drops a full-page invisible **blocker** that
 * captures every touch and turns it into one of three gestures:
 *
 *   • **hold + drag** — the press point becomes the base of an invisible
 *     joystick; dragging shows its direction. A 2-D ray is cast from the centre
 *     of the currently selected item along that direction and the first target
 *     it reaches lights up as the *preview*. Releasing commits the preview as
 *     the new selection.
 *   • **single tap** — selects the item under the finger, if any.
 *   • **double tap** — "clicks" (activates) the currently selected item.
 *
 * Each {@link Nav2DItem} shows one of three states as a ring around it:
 * *selected* (solid), *preview* (dashed, pulsing) or nothing. The whole thing
 * is dependency-free inline styles + a couple of injected keyframes, themeable
 * through the `--ds-nav2d-*` custom properties.
 */

/* ─── Context ────────────────────────────────────────────────────────────── */

type ItemState = 'selected' | 'preview' | 'idle';

interface RegisteredItem {
  id: string;
  el: HTMLElement;
  onActivate?: () => void;
}

export interface Nav2DContextValue {
  /** The id of the item currently selected (the ray's origin). */
  selectedId: string | null;
  /** The id currently previewed mid-drag (committed on release), or null. */
  previewId: string | null;
  /** Whether the capture blocker is live. */
  enabled: boolean;
  /** Turn the navigation blocker on/off (e.g. from a toolbar toggle). */
  setEnabled: (v: boolean) => void;
  /** Programmatically select an item (or clear with null). */
  select: (id: string | null) => void;
  /** Fire an item's `onActivate` — defaults to the current selection. */
  activate: (id?: string | null) => void;
  /** @internal registration used by {@link Nav2DItem}. */
  register: (id: string, el: HTMLElement, onActivate?: () => void) => () => void;
  /** @internal keep an item's activate handler fresh across renders. */
  setActivate: (id: string, onActivate?: () => void) => void;
}

const Ctx = createContext<Nav2DContextValue | null>(null);

/** Access the ambient {@link Nav2DProvider}. Throws if used outside one. */
export function useNav2D(): Nav2DContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav2D must be used within <Nav2DProvider>');
  return v;
}

/* ─── Tunables ───────────────────────────────────────────────────────────── */

/** Finger travel (px) before a press turns into a joystick drag. */
const DRAG_THRESHOLD = 12;
/** Visual joystick radius (px) the knob is clamped inside. */
const JOYSTICK_RADIUS = 56;
/** Half-angle (deg) of the cone a target must fall inside to be a candidate. */
const CONE_DEG = 55;
/** How strongly to punish a target that sits off the ray line. */
const PERP_WEIGHT = 1.6;
/** Max ms / px between two taps for them to count as a double tap. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 34;

const cos = (deg: number) => Math.cos((deg * Math.PI) / 180);

/**
 * Pick the best target reached by a ray from `origin` in `dir`.
 *
 * Classic D-pad-style spatial scoring rather than a brittle exact ray/rect hit:
 * a target counts if it is in front of the ray and within a cone, and among
 * those we prefer the one that is both near along the ray and close to the ray
 * line. Returns its id, or null if the ray hits nothing.
 */
function pickInDirection(
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  items: RegisteredItem[],
  excludeId: string | null,
): { id: string; cx: number; cy: number } | null {
  const len = Math.hypot(dir.x, dir.y);
  if (len < 1e-3) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const minCos = cos(CONE_DEG);

  let best: { id: string; cx: number; cy: number } | null = null;
  let bestScore = Infinity;
  for (const it of items) {
    if (it.id === excludeId) continue;
    const r = it.el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const vx = cx - origin.x;
    const vy = cy - origin.y;
    const dist = Math.hypot(vx, vy);
    if (dist < 1) continue;
    const proj = vx * dx + vy * dy; // distance along the ray
    if (proj <= 0) continue; // behind the origin
    if (proj / dist < minCos) continue; // outside the cone
    const perp = Math.abs(vx * dy - vy * dx); // offset from the ray line
    const score = proj + perp * PERP_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = { id: it.id, cx, cy };
    }
  }
  return best;
}

/** The item whose box contains the point, if any (topmost wins). */
function itemAtPoint(x: number, y: number, items: RegisteredItem[]): string | null {
  let hit: string | null = null;
  for (const it of items) {
    const r = it.el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = it.id;
  }
  return hit;
}

const center = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/* ─── Provider ───────────────────────────────────────────────────────────── */

export interface Nav2DProviderProps {
  children: ReactNode;
  /** Start with this item selected (else the first to register wins). */
  defaultSelectedId?: string | null;
  /** Start with the capture blocker off. */
  defaultEnabled?: boolean;
  /**
   * Where the capture blocker lives. `'viewport'` (default) covers the whole
   * page — the intended full-screen navigation mode. `'container'` scopes the
   * blocker to a positioned wrapper around `children`, so navigation only takes
   * over a panel and the rest of the page stays interactive (used by the docs
   * demo, and handy for scoping nav to one region).
   */
  bounds?: 'viewport' | 'container';
  /** Called whenever the selection changes (via joystick, tap or code). */
  onSelect?: (id: string | null) => void;
  /** Called when an item is activated (double tap / `activate()`). */
  onActivate?: (id: string) => void;
}

interface DragViz {
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  originX: number;
  originY: number;
  targetX: number | null;
  targetY: number | null;
  active: boolean;
}

/**
 * @summary Joystick navigation over a 2-D field of targets: hold and drag to ray-cast
 * a selection, release to commit. Built for TV/gamepad-ish and one-handed
 * touch.
 */
export function Nav2DProvider({
  children,
  defaultSelectedId = null,
  defaultEnabled = true,
  bounds = 'viewport',
  onSelect,
  onActivate,
}: Nav2DProviderProps) {
  const items = useRef(new Map<string, RegisteredItem>());
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [drag, setDrag] = useState<DragViz | null>(null);

  // Latest values for use inside pointer handlers without re-binding them.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  const select = useCallback((id: string | null) => {
    setSelectedId((prev) => {
      if (prev !== id) onSelectRef.current?.(id);
      return id;
    });
  }, []);

  const activate = useCallback((id?: string | null) => {
    const target = id ?? selectedRef.current;
    if (!target) return;
    const it = items.current.get(target);
    it?.onActivate?.();
    onActivateRef.current?.(target);
  }, []);

  const register = useCallback((id: string, el: HTMLElement, onAct?: () => void) => {
    items.current.set(id, { id, el, onActivate: onAct });
    // First target to register becomes the origin unless one was preset.
    setSelectedId((prev) => prev ?? id);
    return () => {
      items.current.delete(id);
      setSelectedId((prev) => (prev === id ? null : prev));
      setPreviewId((prev) => (prev === id ? null : prev));
    };
  }, []);

  const setActivate = useCallback((id: string, onAct?: () => void) => {
    const it = items.current.get(id);
    if (it) it.onActivate = onAct;
  }, []);

  // Gesture bookkeeping kept in refs — no re-render on every move.
  const gesture = useRef<{
    baseX: number;
    baseY: number;
    origin: { x: number; y: number };
    dragging: boolean;
    preview: string | null;
  } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const sel = selectedRef.current ? items.current.get(selectedRef.current) : null;
    const origin = sel ? center(sel.el) : { x: e.clientX, y: e.clientY };
    gesture.current = {
      baseX: e.clientX,
      baseY: e.clientY,
      origin,
      dragging: false,
      preview: null,
    };
    setDrag({
      baseX: e.clientX,
      baseY: e.clientY,
      knobX: e.clientX,
      knobY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      targetX: null,
      targetY: null,
      active: false,
    });
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dxTotal = e.clientX - g.baseX;
    const dyTotal = e.clientY - g.baseY;
    if (!g.dragging && Math.hypot(dxTotal, dyTotal) < DRAG_THRESHOLD) return;
    g.dragging = true;

    // The origin tracks the *live* selected element (it may have scrolled).
    const sel = selectedRef.current ? items.current.get(selectedRef.current) : null;
    const origin = sel ? center(sel.el) : { x: g.baseX, y: g.baseY };
    g.origin = origin;

    const hit = pickInDirection(origin, { x: dxTotal, y: dyTotal }, [...items.current.values()], selectedRef.current);
    g.preview = hit?.id ?? null;
    setPreviewId(hit?.id ?? null);

    // Clamp the joystick knob to its radius for the visual.
    const dist = Math.hypot(dxTotal, dyTotal);
    const k = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
    setDrag({
      baseX: g.baseX,
      baseY: g.baseY,
      knobX: g.baseX + dxTotal * k,
      knobY: g.baseY + dyTotal * k,
      originX: origin.x,
      originY: origin.y,
      targetX: hit?.cx ?? origin.x + (dxTotal / dist || 0) * 360,
      targetY: hit?.cy ?? origin.y + (dyTotal / dist || 0) * 360,
      active: true,
    });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    setDrag(null);
    setPreviewId(null);
    if (!g) return;

    if (g.dragging) {
      if (g.preview) select(g.preview); // commit the previewed selection
      return;
    }

    // A stationary press: single vs. double tap.
    const t = performance.now();
    const prev = lastTap.current;
    const isDouble =
      prev &&
      t - prev.t < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_PX;
    if (isDouble) {
      activate();
      lastTap.current = null;
    } else {
      const hit = itemAtPoint(e.clientX, e.clientY, [...items.current.values()]);
      if (hit) select(hit);
      lastTap.current = { t, x: e.clientX, y: e.clientY };
    }
  }, [select, activate]);

  const value = useMemo<Nav2DContextValue>(
    () => ({ selectedId, previewId, enabled, setEnabled, select, activate, register, setActivate }),
    [selectedId, previewId, enabled, select, activate, register, setActivate],
  );

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
  const canPortal = typeof document !== 'undefined';

  return (
    <Ctx.Provider value={value}>
      <StyleOnce />
      {bounds === 'container' ? (
        <div style={{ position: 'relative' }}>
          {children}
          {enabled && <CaptureRegion mode="absolute" active={!!drag?.active} handlers={handlers} />}
        </div>
      ) : (
        <>
          {children}
          {enabled &&
            canPortal &&
            createPortal(<CaptureRegion mode="fixed" active={!!drag?.active} handlers={handlers} />, document.body)}
        </>
      )}
      {enabled && canPortal && createPortal(<VizOverlay drag={drag} />, document.body)}
    </Ctx.Provider>
  );
}

/* ─── The capture blocker ────────────────────────────────────────────────── */

/**
 * The transparent layer that swallows pointer input and turns it into
 * navigation gestures. `fixed` for the whole viewport, or `absolute` to fill a
 * `container`-bounded provider wrapper.
 */
function CaptureRegion({
  mode,
  active,
  handlers,
}: {
  mode: 'fixed' | 'absolute';
  active: boolean;
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
  };
}) {
  return (
    <div
      aria-hidden
      {...handlers}
      style={{
        position: mode,
        inset: 0,
        zIndex: 2147483000,
        touchAction: 'none',
        cursor: active ? 'grabbing' : 'default',
        background: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
}

/* ─── Joystick + ray visuals ─────────────────────────────────────────────── */

/** Full-viewport, pointer-transparent overlay drawing the ray and joystick. */
function VizOverlay({ drag }: { drag: DragViz | null }) {
  if (!drag?.active) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483001, pointerEvents: 'none' }}>
      <>
        {/* The 2-D ray, from the selected element toward the preview. */}
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
            <defs>
              <linearGradient id="ds-nav2d-ray" gradientUnits="userSpaceOnUse" x1={drag.originX} y1={drag.originY} x2={drag.targetX ?? drag.originX} y2={drag.targetY ?? drag.originY}>
                <stop offset="0%" stopColor="var(--ds-nav2d-ray-from, rgba(94,198,232,0.15))" />
                <stop offset="100%" stopColor="var(--ds-nav2d-ray-to, rgba(245,166,35,0.9))" />
              </linearGradient>
            </defs>
            <line
              x1={drag.originX}
              y1={drag.originY}
              x2={drag.targetX ?? drag.originX}
              y2={drag.targetY ?? drag.originY}
              stroke="url(#ds-nav2d-ray)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="2 8"
            />
            <circle cx={drag.originX} cy={drag.originY} r={5} fill="var(--ds-nav2d-selected, #5ec6e8)" />
            {drag.targetX != null && drag.targetY != null && (
              <circle cx={drag.targetX} cy={drag.targetY} r={7} fill="none" stroke="var(--ds-nav2d-preview, #f5a623)" strokeWidth={2} />
            )}
          </svg>

          {/* The invisible-until-touched joystick. */}
          <div
            style={{
              position: 'absolute',
              left: drag.baseX,
              top: drag.baseY,
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
              marginLeft: -JOYSTICK_RADIUS,
              marginTop: -JOYSTICK_RADIUS,
              borderRadius: '50%',
              border: '1.5px solid var(--ds-nav2d-joystick, rgba(94,198,232,0.4))',
              background: 'radial-gradient(circle, rgba(94,198,232,0.08), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: drag.knobX,
              top: drag.knobY,
              width: 44,
              height: 44,
              marginLeft: -22,
              marginTop: -22,
              borderRadius: '50%',
              background: 'var(--ds-nav2d-knob, rgba(94,198,232,0.9))',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}
          />
      </>
    </div>
  );
}

/* ─── Item wrapper ───────────────────────────────────────────────────────── */

export interface Nav2DItemProps {
  children: ReactNode;
  /** Fired when the item is activated (double tap while selected). */
  onActivate?: () => void;
  /** Stable id — auto-generated if omitted. */
  id?: string;
  /** Ring corner radius (px) — match the wrapped element for a snug ring. */
  radius?: number;
  className?: string;
  style?: CSSProperties;
}

function ringStyle(state: ItemState, radius: number): CSSProperties {
  const base: CSSProperties = {
    borderRadius: radius,
    transition: 'box-shadow 140ms ease',
  };
  if (state === 'selected')
    return {
      ...base,
      boxShadow:
        '0 0 0 2px var(--ds-nav2d-selected, #5ec6e8), 0 0 0 6px var(--ds-nav2d-selected-glow, rgba(94,198,232,0.22))',
    };
  if (state === 'preview')
    return {
      ...base,
      boxShadow: '0 0 0 2px var(--ds-nav2d-preview, #f5a623)',
      animation: 'ds-nav2d-pulse 900ms ease-in-out infinite',
    };
  return base;
}

/**
 * Marks a subtree as a reachable navigation target. Shows a ring reflecting its
 * state (selected / preview / idle) without shifting layout, and registers with
 * the nearest {@link Nav2DProvider}.
 */
export function Nav2DItem({ children, onActivate, id: idProp, radius = 12, className, style }: Nav2DItemProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useNav2D();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return ctx.register(id, el, onActivate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    ctx.setActivate(id, onActivate);
  }, [ctx, id, onActivate]);

  const state: ItemState =
    ctx.selectedId === id ? 'selected' : ctx.previewId === id ? 'preview' : 'idle';

  return (
    <div
      ref={ref}
      data-nav2d-item={id}
      data-nav2d-state={state}
      className={className}
      style={{ ...ringStyle(state, radius), ...style }}
    >
      {children}
    </div>
  );
}

/* ─── One-shot keyframes injection ───────────────────────────────────────── */

let injected = false;
function StyleOnce() {
  useEffect(() => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const el = document.createElement('style');
    el.dataset.dsNav2d = '';
    el.textContent =
      '@keyframes ds-nav2d-pulse{0%,100%{box-shadow:0 0 0 2px var(--ds-nav2d-preview,#f5a623)}50%{box-shadow:0 0 0 2px var(--ds-nav2d-preview,#f5a623),0 0 0 7px var(--ds-nav2d-preview-glow,rgba(245,166,35,0.28))}}';
    document.head.appendChild(el);
  }, []);
  return null;
}
