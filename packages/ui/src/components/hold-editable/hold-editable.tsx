import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils';

/** How long the reorder glide (items shuffling into their new slots) runs, in ms. */
const SHUFFLE_MS = 220;
/** How long the picked-up item takes to land in its slot on release, in ms. */
const DROP_MS = 220;
/**
 * Finger travel (px) that cancels a pending hold — that's a scroll, not a hold.
 * Touch and pen only: a mouse can't scroll with the button down (see `onMove`).
 */
const MOVE_CANCEL_PX = 12;
/** How far into a slot the pointer must reach to claim it (fraction of its extent). */
const CROSS_FRACTION = 0.45;
/** Clicks fired within this window after a drop are swallowed (see below). */
const CLICK_SUPPRESS_MS = 500;
/**
 * Sub-trees a press must not turn into a pickup: native text entry (a hold
 * there means "select text"), plus an explicit `data-hold-editable-ignore`
 * escape hatch for anything else the caller wants to keep pressable.
 */
const NO_HOLD_SELECTOR =
  "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-hold-editable-ignore]";

export interface HoldEditableItemState {
  /** This item is the one picked up and following the pointer. */
  held: boolean;
  /** The group is in edit mode (some item is being held). */
  editing: boolean;
  /** The pointer is down on this item, waiting out the hold delay. */
  pressing: boolean;
  /**
   * The item's index. While a drag is in flight this is its **live slot** —
   * where it would land right now — not its position in the DOM.
   */
  index: number;
  /** Number of items in the group. */
  count: number;
}

export interface HoldEditableProps<T> {
  /** The items, in their current order. */
  items: T[];
  /** Stable identity for an item — also the React key. */
  getKey: (item: T) => string;
  /** Called once, on drop, with the reordered items. Not called if nothing moved. */
  onReorder: (items: T[]) => void;
  /** Renders one item. Receives its live drag state (see {@link HoldEditableItemState}). */
  children: (item: T, state: HoldEditableItemState) => ReactNode;
  /** Classes for the group container — this is where the layout lives. */
  className?: string;
  /** Classes for each item's wrapper (rarely needed; the item renders its own box). */
  itemClassName?: string;
  /** Hold duration before an item is picked up, in ms. */
  holdDelay?: number;
  /** Jump cycle of the non-held items while editing, in ms. */
  jumpInterval?: number;
  /** Turns the whole interaction off — items render, nothing is draggable. */
  disabled?: boolean;
  /** Fired when an item is picked up. */
  onEditStart?: () => void;
  /** Fired when the pointer is released (or the drag is cancelled). */
  onEditEnd?: () => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Everything frozen at pickup. `dom` is the DOM order for the whole drag;
 * `order` is the live arrangement the drop will commit; `home` is each slot's
 * geometry **relative to the group container**, so a page or panel that scrolls
 * mid-drag doesn't invalidate it.
 */
interface Arrangement {
  dom: string[];
  order: string[];
  home: Rect[];
  horizontal: boolean;
}

interface DragState {
  key: string;
  /** Size of the picked-up item, frozen at pickup. */
  w: number;
  h: number;
  /** Where inside the item the pointer grabbed it. */
  grabX: number;
  grabY: number;
  /** Live pointer position, in viewport coordinates. */
  x: number;
  y: number;
}

interface DropState {
  key: string;
  w: number;
  h: number;
  /** Viewport position of the slot the item is landing in. */
  x: number;
  y: number;
}

const STYLE_ID = 'hold-editable-styles';

/**
 * The keyframes live in a stylesheet rather than inline styles because a
 * `@keyframes` rule can't be expressed inline, and pulling in a CSS file would
 * make the component non-portable. Injected once, on first mount.
 */
const CSS = `
@keyframes hold-editable-jump {
  0%   { transform: translateY(0)     rotate(0deg);    }
  8%   { transform: translateY(-24%)  rotate(-1.2deg); }
  17%  { transform: translateY(0)     rotate(0deg);    }
  24%  { transform: translateY(-8%)   rotate(0.8deg);  }
  31%  { transform: translateY(0)     rotate(0deg);    }
  100% { transform: translateY(0)     rotate(0deg);    }
}
[data-hold-editable-item] {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
[data-hold-editable-dragging] {
  cursor: grabbing;
}
@media (prefers-reduced-motion: reduce) {
  .hold-editable-jump { animation: none !important; }
}
`;

function useHoldEditableStyles(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

const hits = (r: Rect, x: number, y: number) =>
  x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;

/**
 * How much a picked-up item swells. A fixed ratio reads as a tasteful lift on a
 * 64px navbar tab and as a jarring 100px growth spurt on a full-width card, so
 * scale the *absolute* overhang instead and clamp it.
 */
const liftScale = (w: number, h: number) =>
  1 + Math.min(0.08, Math.max(0.02, 8 / Math.max(w, h, 1)));

/**
 * Which way the group runs, read off the first two slots that sit apart. Rows
 * and columns need the reflow computed on different axes, and this beats asking
 * the caller to declare an orientation it already expressed in its CSS.
 */
function isHorizontal(rects: Rect[]): boolean {
  for (let i = 1; i < rects.length; i++) {
    const dx = Math.abs(rects[i].left - rects[0].left);
    const dy = Math.abs(rects[i].top - rects[0].top);
    if (dx > 1 || dy > 1) return dx > dy;
  }
  return true;
}

/**
 * Where every item sits, along the main axis, for a given order — the layout a
 * real reflow would produce, derived from the frozen slot geometry. Each item
 * keeps its own size and the original inter-slot gaps are preserved, so a list
 * of unequal items (an expanded card among collapsed ones) still lands right.
 */
function positionsFor(order: string[], a: Arrangement): Map<string, number> {
  const { dom, home, horizontal } = a;
  const sizeOf = new Map<string, number>();
  dom.forEach((k, i) => sizeOf.set(k, horizontal ? home[i].width : home[i].height));

  const out = new Map<string, number>();
  let p = horizontal ? home[0].left : home[0].top;
  for (let j = 0; j < order.length; j++) {
    out.set(order[j], p);
    const size = sizeOf.get(order[j]) ?? 0;
    const gap =
      j + 1 < home.length
        ? horizontal
          ? home[j + 1].left - (home[j].left + home[j].width)
          : home[j + 1].top - (home[j].top + home[j].height)
        : 0;
    p += size + gap;
  }
  return out;
}

/**
 * iOS-springboard-style "hold to rearrange" for small lists.
 *
 * Press and hold any item of the group for {@link HoldEditableProps.holdDelay}
 * (1.4s by default) and it is *picked up*: it lifts out of the flow and follows
 * the pointer, and every other item starts jumping in place (0.8s cycle, each
 * with its own random phase offset, so the group doesn't pulse in lockstep).
 * Dragging into another item's slot hands that slot over: the displaced items
 * glide out of the way and the held item's slot — a jumping ghost outline —
 * follows the pointer. Releasing drops the held item into that slot, ends edit
 * mode and commits the new order via `onReorder`.
 *
 * **The DOM order never changes during a drag.** Slots are measured once at
 * pickup and the rearrangement is expressed purely as transforms; only the drop
 * commits a real reorder, once the pointer is gone. That is not an optimisation
 * — it is what makes the drag work at all. Reordering the list live means React
 * moves the pressed node (and re-renders whichever item now occupies a
 * position-dependent slot), and a browser cancels the touch whose target was
 * detached: the drag died on the first hand-over. Freezing the DOM also means
 * slot geometry is fixed, so hit-testing needs no re-measuring and no animation
 * lock, and a fast drag can't outrun the shuffle.
 *
 * It is layout-agnostic on purpose: the group container gets whatever flex/grid
 * classes the caller passes, so the same component reorders a horizontal
 * navbar, a vertical panel of links or a column of cards. It only ever renders
 * one wrapper `<div>` per item. (The transform model assumes a single row or
 * column — it does not handle a wrapping grid.)
 *
 * ```tsx
 * <HoldEditable
 *   items={tabs}
 *   getKey={(t) => t.id}
 *   onReorder={(next) => save(next.map((t) => t.id))}
 *   className="flex items-stretch justify-between"
 * >
 *   {(tab, { editing }) => <Tab tab={tab} muted={editing} />}
 * </HoldEditable>
 * ```
 *
 * @summary iOS-springboard "hold to rearrange": press-and-hold picks an item
 * up, the rest jump in place, drag hands slots over, drop commits the new
 * order. For small rows/columns (navbars, panels, card stacks).
 */
export function HoldEditable<T>({
  items,
  getKey,
  onReorder,
  children,
  className,
  itemClassName,
  holdDelay = 1400,
  jumpInterval = 800,
  disabled = false,
  onEditStart,
  onEditEnd,
}: HoldEditableProps<T>) {
  useHoldEditableStyles();

  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [pressKey, setPressKey] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);

  const byKey = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of items) m.set(getKey(it), it);
    return m;
  }, [items, getKey]);

  // While a drag is in flight we render the frozen DOM order; otherwise the
  // parent's. The frozen order is dropped if it no longer describes exactly the
  // items we were handed (the parent may add or remove one mid-drag).
  const list = useMemo(() => {
    const dom = arrangement?.dom;
    if (!dom || dom.length !== items.length) return items;
    if (dom.some((k) => !byKey.has(k))) return items;
    return dom.map((k) => byKey.get(k)!);
  }, [arrangement, items, byKey]);

  const keys = useMemo(() => list.map(getKey), [list, getKey]);
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Wrapper element per key — the measurable "slot". */
  const slots = useRef(new Map<string, HTMLDivElement>());
  /** Order at pickup, so Escape / pointercancel can put everything back. */
  const orderAtPickup = useRef<string[]>([]);
  /** Timestamp of the last drop — see the click-suppression effect below. */
  const droppedAt = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const dropTimer = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const arrangementRef = useRef<Arrangement | null>(null);
  arrangementRef.current = arrangement;
  const pressPos = useRef({ x: 0, y: 0 });
  /** Last pointer position seen during a drag, in viewport coordinates. */
  const lastPointer = useRef({ x: 0, y: 0 });
  /** Pointer that started the press — needed to capture it at pickup. */
  const pointerId = useRef<number | null>(null);

  /** Per-item jump phase, so the group jumps out of sync. Stable per key. */
  const jumpPhase = useRef(new Map<string, number>());
  const phaseOf = (key: string) => {
    let p = jumpPhase.current.get(key);
    if (p === undefined) {
      p = -Math.random() * jumpInterval;
      jumpPhase.current.set(key, p);
    }
    return p;
  };

  const clearHoldTimer = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  /* ---------------------------------------------------------------- pickup */

  const beginDrag = useCallback(
    (key: string, x: number, y: number) => {
      const el = slots.current.get(key);
      const container = containerRef.current;
      if (!el || !container) return;

      // Measure every slot once, relative to the container. These rects are the
      // drop hitboxes and the layout model for the rest of the drag; nothing
      // re-measures, because nothing in the DOM moves.
      const c = rectOf(container);
      const dom = [...keysRef.current];
      const home: Rect[] = [];
      for (const k of dom) {
        const slot = slots.current.get(k);
        if (!slot) return;
        const r = rectOf(slot);
        home.push({ left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height });
      }

      const r = rectOf(el);
      // Capture the pointer on the slot wrapper: with the DOM frozen it stays
      // put for the whole drag, so every later event is guaranteed to reach us
      // even if the item's own content re-renders.
      if (pointerId.current !== null) {
        try {
          el.setPointerCapture(pointerId.current);
        } catch {
          /* pointer already gone — the drag will end on the next event */
        }
      }
      lastPointer.current = { x, y };
      orderAtPickup.current = dom;
      setArrangement({ dom, order: [...dom], home, horizontal: isHorizontal(home) });
      setPressKey(null);
      setDrag({ key, w: r.width, h: r.height, grabX: x - r.left, grabY: y - r.top, x, y });
      navigator.vibrate?.(12);
      onEditStart?.();
    },
    [onEditStart],
  );

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    if (disabled || dragRef.current || drop) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Text fields (and anything explicitly opted out) keep their own press
    // semantics: holding inside a textarea must select text, not lift the card.
    const target = e.target as Element | null;
    if (target?.closest?.(NO_HOLD_SELECTOR)) return;
    pressPos.current = { x: e.clientX, y: e.clientY };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    pointerId.current = e.pointerId;
    setPressKey(key);
    clearHoldTimer();
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      // Pick up wherever the pointer is *now*, not where it went down: over
      // 1.4s a mouse drifts, and starting the drag at a stale point would make
      // the item jump out from under the cursor.
      beginDrag(key, lastPointer.current.x, lastPointer.current.y);
    }, holdDelay);
  };

  /* ------------------------------------------------------------ reordering */

  /**
   * Hit-test the pointer against the frozen slots and re-file the held item if
   * it has moved into someone else's. The held item is *moved* to that index
   * (the items in between shift by one) rather than swapped with it: for the
   * neighbour-by-neighbour hops a real drag produces the two are the same, but
   * only "move" converges on the slot the pointer is over when a fast drag
   * crosses several at once.
   */
  const considerMove = useCallback(() => {
    const d = dragRef.current;
    const a = arrangementRef.current;
    const container = containerRef.current;
    if (!d || !a || !container) return;

    // Slot geometry is frozen, but the group itself can scroll or reflow under
    // the pointer — one container rect per move is enough to stay exact.
    const c = rectOf(container);
    const x = lastPointer.current.x - c.left;
    const y = lastPointer.current.y - c.top;

    const held = a.order.indexOf(d.key);
    const over = a.home.findIndex((r) => hits(r, x, y));
    if (over < 0 || held < 0 || over === held) return;

    // Hysteresis: the pointer has to travel a little way into the target before
    // it takes the slot over, so items of unequal size can't ping-pong on the
    // boundary. The threshold sits just *short* of the middle on purpose —
    // aiming at the centre of the item you want is the most natural thing to
    // do, and an exact midpoint rule turns that into a coin flip that leaves
    // the item one slot short.
    const r = a.home[over];
    const pos = a.horizontal ? x : y;
    const near = a.horizontal ? r.left : r.top;
    const span = a.horizontal ? r.width : r.height;
    const threshold = near + span * (over > held ? CROSS_FRACTION : 1 - CROSS_FRACTION);
    if (over > held ? pos < threshold : pos > threshold) return;

    const next = [...a.order];
    next.splice(over, 0, next.splice(held, 1)[0]);
    setArrangement({ ...a, order: next });
  }, []);

  /* --------------------------------------------------------- drag lifetime */

  const endDrag = useCallback(
    (cancelled: boolean) => {
      clearHoldTimer();
      setPressKey(null);
      const d = dragRef.current;
      const a = arrangementRef.current;
      if (!d || !a) return;

      const finalOrder = cancelled ? orderAtPickup.current : a.order;
      const settled: Arrangement = { ...a, order: finalOrder };
      setArrangement(settled);

      // Land the ghost on the slot the item is taking, in viewport coordinates.
      const c = containerRef.current ? rectOf(containerRef.current) : { left: 0, top: 0 };
      const pos = positionsFor(finalOrder, settled).get(d.key) ?? 0;
      const homeRect = a.home[a.dom.indexOf(d.key)];
      const x = a.horizontal ? c.left + pos : c.left + homeRect.left;
      const y = a.horizontal ? c.top + homeRect.top : c.top + pos;

      setDrag(null);
      setDrop({ key: d.key, w: d.w, h: d.h, x, y });
      droppedAt.current = Date.now();

      if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
      dropTimer.current = window.setTimeout(() => {
        dropTimer.current = null;
        setDrop(null);
        // Only now does the DOM reorder — into exactly the arrangement the
        // transforms were already showing, so the swap is invisible.
        setArrangement(null);
      }, DROP_MS);

      const changed =
        !cancelled && finalOrder.some((k, i) => k !== orderAtPickup.current[i]);
      if (changed) {
        const next = finalOrder.map((k) => byKey.get(k)).filter(Boolean) as T[];
        if (next.length === finalOrder.length) onReorder(next);
      }
      onEditEnd?.();
    },
    [byKey, onReorder, onEditEnd],
  );

  // Window-level pointer handling: a drag must survive the pointer leaving the
  // item (and the group) entirely.
  useEffect(() => {
    if (!pressKey && !drag) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) {
        // Still waiting out the hold. Travel only cancels it for a *finger*,
        // where it means "I'm scrolling, not holding". A mouse can't scroll
        // with the button down, and a hand resting on one drifts well past any
        // sane threshold over 1.4s — cancelling on that made hold-to-drag
        // essentially impossible on desktop. So the mouse keeps holding, and
        // the pickup simply happens wherever the cursor ended up.
        lastPointer.current = { x: e.clientX, y: e.clientY };
        if (e.pointerType === 'mouse') return;
        const dx = e.clientX - pressPos.current.x;
        const dy = e.clientY - pressPos.current.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          clearHoldTimer();
          setPressKey(null);
        }
        return;
      }
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setDrag({ ...d, x: e.clientX, y: e.clientY });
      considerMove();
    };
    const onUp = () => endDrag(false);
    const onCancel = () => (dragRef.current ? endDrag(true) : setPressKey(null));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) endDrag(true);
    };
    // Once an item is picked up the finger owns it: stop the page scrolling
    // under it. Must be non-passive to be allowed to preventDefault.
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [pressKey, drag, endDrag, considerMove]);

  // A hold-then-release still fires a click on whatever was under the pointer.
  // These items are usually links or buttons, so swallow the click that closes
  // a drag — reordering the navbar must not also navigate.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (Date.now() - droppedAt.current > CLICK_SUPPRESS_MS) return;
      droppedAt.current = 0;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);

  useEffect(
    () => () => {
      clearHoldTimer();
      if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
    },
    [],
  );

  /* ------------------------------------------------------------- rendering */

  const editing = drag !== null;
  const ghostKey = drag?.key ?? drop?.key ?? null;
  const ghostItem = ghostKey ? byKey.get(ghostKey) : undefined;

  // Where each item currently sits, versus where its DOM node actually is.
  const offsets = useMemo(() => {
    if (!arrangement || arrangement.dom.length !== arrangement.order.length) return null;
    const pos = positionsFor(arrangement.order, arrangement);
    const out = new Map<string, number>();
    arrangement.dom.forEach((k, i) => {
      const home = arrangement.horizontal ? arrangement.home[i].left : arrangement.home[i].top;
      out.set(k, (pos.get(k) ?? home) - home);
    });
    return out;
  }, [arrangement]);

  const slotIndex = (key: string) =>
    arrangement ? arrangement.order.indexOf(key) : keys.indexOf(key);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        data-hold-editable-dragging={editing || undefined}
      >
        {list.map((item, domIndex) => {
          const key = keys[domIndex];
          const held = key === ghostKey;
          const pressing = key === pressKey;
          const shift = offsets?.get(key) ?? 0;
          const index = slotIndex(key);
          return (
            <div
              key={key}
              data-hold-editable-item=""
              ref={(el) => {
                if (el) slots.current.set(key, el);
                else slots.current.delete(key);
              }}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => {
                // A long press pops the OS context menu / selection callout on
                // touch, which would fight the pickup.
                if (pressing || editing) e.preventDefault();
              }}
              onPointerDown={(e) => onPointerDown(e, key)}
              className={itemClassName}
              style={
                arrangement
                  ? {
                      position: 'relative',
                      transform: arrangement.horizontal
                        ? `translateX(${shift}px)`
                        : `translateY(${shift}px)`,
                      transition: `transform ${SHUFFLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
                    }
                  : undefined
              }
            >
              {/* The item's own subtree is rendered in every state and is never
                  swapped out — a held item is only made invisible, and it keeps
                  rendering with exactly the props it had before the pickup.
                  That last part matters: a caller whose markup depends on the
                  index (the navbar's centre tab is a different element) would
                  otherwise have this very node — the one the pointer went down
                  on — unmounted the moment the held item changed slot, and the
                  browser cancels a touch whose target left the document. The
                  copy is invisible, so freezing it costs nothing. */}
              <div
                className={cn('h-full w-full', editing && !held && 'hold-editable-jump')}
                style={
                  held
                    ? { visibility: 'hidden' }
                    : editing
                      ? {
                          animation: `hold-editable-jump ${jumpInterval}ms ease-in-out infinite`,
                          animationDelay: `${phaseOf(key)}ms`,
                        }
                      : pressing
                        ? {
                            transform: 'scale(0.94)',
                            transition: `transform ${holdDelay}ms cubic-bezier(0.4, 0, 0.6, 1)`,
                          }
                        : { transition: 'transform 140ms ease-out' }
                }
              >
                {children(
                  item,
                  held
                    ? { held: false, editing: false, pressing: false, index: domIndex, count: list.length }
                    : { held: false, editing, pressing, index, count: list.length },
                )}
              </div>

              {/* Where the held item will land: a jumping outline over its slot. */}
              {held && (
                <div
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 rounded-xl border border-dashed border-primary/40 bg-primary/5',
                    editing && 'hold-editable-jump',
                  )}
                  style={
                    editing
                      ? {
                          animation: `hold-editable-jump ${jumpInterval}ms ease-in-out infinite`,
                          animationDelay: `${phaseOf(key)}ms`,
                        }
                      : undefined
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {/* The picked-up item, lifted out of the flow into a body-level layer so
          no `overflow: hidden` ancestor can clip it while it roams. */}
      {ghostItem !== undefined &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: drag?.w ?? drop?.w,
              height: drag?.h ?? drop?.h,
              zIndex: 100,
              pointerEvents: 'none',
              willChange: 'transform',
              transform: drag
                ? `translate3d(${drag.x - drag.grabX}px, ${drag.y - drag.grabY}px, 0) scale(${liftScale(drag.w, drag.h)})`
                : `translate3d(${drop!.x}px, ${drop!.y}px, 0) scale(1)`,
              transition: drag
                ? 'none'
                : `transform ${DROP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), filter ${DROP_MS}ms ease-out`,
              // The lift shadow fades as the item lands, so it doesn't blink
              // out when the ghost unmounts and the real slot takes over.
              filter: drag
                ? 'drop-shadow(0 10px 18px rgb(0 0 0 / 0.28))'
                : 'drop-shadow(0 0 0 rgb(0 0 0 / 0))',
            }}
          >
            {children(ghostItem, {
              held: true,
              editing,
              pressing: false,
              index: ghostKey ? slotIndex(ghostKey) : -1,
              count: list.length,
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
