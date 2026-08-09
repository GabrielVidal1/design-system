import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
 * Hold duration once the group is already in edit mode. The deliberate
 * {@link HoldEditableProps.holdDelay} guards *entering* edit mode; once
 * everything is jumping, picking the next item up should feel immediate.
 */
const EDIT_HOLD_MS = 150;
/** Gap between the group and the stash popover, in px. */
const STASH_GAP = 10;
/**
 * Sub-trees a press must not turn into a pickup: native text entry (a hold
 * there means "select text"), plus an explicit `data-hold-editable-ignore`
 * escape hatch for anything else the caller wants to keep pressable.
 */
const NO_HOLD_SELECTOR =
  "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-hold-editable-ignore]";

export type HoldEditableStashPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface HoldEditableItemState {
  /** This item is the one picked up and following the pointer. */
  held: boolean;
  /** The group is in edit mode (an item is being held, or the persistent edit mode is on). */
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
  /**
   * Classes for each item's wrapper (rarely needed; the item renders its own
   * box). A function receives the item, for per-item layout classes (e.g. a
   * `flex-1` spacer among fixed-size buttons).
   */
  itemClassName?: string | ((item: T) => string | undefined);
  /** Hold duration before an item is picked up, in ms. */
  holdDelay?: number;
  /**
   * First-stage hold action. Fired once when a press has been held for
   * {@link holdActionDelay} ms — well before the {@link holdDelay} pickup — so
   * an item can own a "hold for options" gesture (a popover, a menu) *and*
   * still be reorderable: keep holding through the action and the pickup
   * happens as usual (close the popover in {@link onEditStart}). Return
   * `false` for items with no hold action. When the action ran and the press
   * ends before the pickup, the trailing click is swallowed — releasing into
   * the popover must not also activate the item. Skipped while the group is
   * already in (persistent) edit mode.
   */
  onItemHold?: (item: T) => boolean | void;
  /** Hold duration before {@link onItemHold} fires, in ms. Default 500. */
  holdActionDelay?: number;
  /**
   * Whether an item may be benched into the stash. Dragging a `false` item
   * over the popover neither highlights it nor benches on release (the item
   * flies back). Only consulted when the stash system is on. E.g. a toolbar's
   * send button stays un-stashable so the group can't lose its last control.
   */
  canStash?: (item: T) => boolean;
  /** Jump cycle of the non-held items while editing, in ms. */
  jumpInterval?: number;
  /** Turns the whole interaction off — items render, nothing is draggable. */
  disabled?: boolean;
  /** Fired when edit mode starts (first pickup). */
  onEditStart?: () => void;
  /** Fired when edit mode ends (drop — or, with a stash, when edit mode is dismissed). */
  onEditEnd?: () => void;
  /**
   * The benched items — everything that could fill a slot but currently
   * doesn't. Passing this (even `[]`) turns on the **stash system**: edit mode
   * becomes persistent (it survives a drop, until a tap outside or Escape
   * dismisses it) and, while editing, a popover of tags opens beside the
   * group. Slotted items dragged onto the popover are benched; a tag dragged
   * onto a slot swaps in and benches the item it displaces; a tag dropped on
   * the group's empty space is appended. See {@link onStashChange}.
   */
  stash?: T[];
  /** Called when an item crosses the stash boundary, with both updated lists. */
  onStashChange?: (items: T[], stash: T[]) => void;
  /**
   * Which side of the group the stash popover opens on. This is the only
   * customization the stash offers — its look is part of the component.
   * @default 'bottom'
   */
  stashPlacement?: HoldEditableStashPlacement;
  /** Tag label for a stashed item. Defaults to the item's key. */
  stashLabel?: (item: T) => ReactNode;
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
  /** The slots wrap into a real grid — reflow is 2D slot-hopping, not axis shifts. */
  grid: boolean;
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
  /** Landing in the stash: shrink and fade out instead of settling full-size. */
  fade?: boolean;
}

/** A tag being dragged out of the stash popover. */
interface StashDragState {
  key: string;
  w: number;
  h: number;
  grabX: number;
  grabY: number;
  x: number;
  y: number;
}

/** The released tag flying to where its drop resolved (a slot, or back home). */
interface ChipDropState {
  key: string;
  label: ReactNode;
  w: number;
  h: number;
  x: number;
  y: number;
  fade: boolean;
}

/** What a dragged stash tag is currently over. */
type StashOver = { type: 'slot'; key: string } | { type: 'append' };

/** Frozen slot geometry for a stash-tag drag (no reflow — pure hit-testing). */
interface StashSlotModel {
  keys: string[];
  home: Rect[];
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
 * Whether the slots form a wrapping grid (several distinct rows AND columns).
 * A grid can't reflow along one axis; instead items hop between the frozen
 * slot rects, so the transform model switches to 2D (see `offsets` below).
 * 4px buckets absorb sub-pixel layout jitter.
 */
function isGrid(rects: Rect[]): boolean {
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const r of rects) {
    xs.add(Math.round(r.left / 4));
    ys.add(Math.round(r.top / 4));
  }
  return xs.size > 1 && ys.size > 1;
}

/**
 * Where every item sits, along the main axis, for a given order — the layout a
 * real reflow would produce, derived from the frozen slot geometry. Each item
 * keeps its own size and the original inter-slot gaps are preserved, so a list
 * of unequal items (an expanded card among collapsed ones) still lands right.
 * (Single-axis layouts only; a grid uses the slot rects directly.)
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

/** The stash popover's fixed-position style for a placement, off the group's rect. */
function stashPositionStyle(c: Rect, placement: HoldEditableStashPlacement): CSSProperties {
  switch (placement) {
    case 'top':
      return {
        left: c.left,
        top: c.top - STASH_GAP,
        width: c.width,
        transform: 'translateY(-100%)',
      };
    case 'left':
      return {
        left: c.left - STASH_GAP,
        top: c.top,
        maxWidth: 260,
        transform: 'translateX(-100%)',
      };
    case 'right':
      return { left: c.left + c.width + STASH_GAP, top: c.top, maxWidth: 260 };
    case 'bottom':
    default:
      return { left: c.left, top: c.top + c.height + STASH_GAP, width: c.width };
  }
}

/** Stash tag chrome — fixed by design; only the popover's placement is configurable. */
const TAG_CLASS =
  'mono inline-flex max-w-full cursor-grab items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] leading-4 text-foreground shadow-sm';

const sameOver = (a: StashOver | null, b: StashOver | null) =>
  a === b || (!!a && !!b && a.type === b.type && (a.type !== 'slot' || a.key === (b as { key?: string }).key));

/**
 * iOS-springboard-style "hold to rearrange" for small lists and grids.
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
 * navbar, a vertical panel of links, a column of cards — or a wrapping grid.
 * A grid is detected from the measured slots (several distinct rows *and*
 * columns) and switches the reflow to 2D slot-hopping: each displaced item
 * glides to the rect of the slot it now occupies. Grid cells are assumed
 * roughly equal-sized.
 *
 * **The stash.** Pass {@link HoldEditableProps.stash} and the group gains an
 * overflow bench for when there are more candidate items than visible slots.
 * Edit mode becomes persistent — a drop no longer ends it; a tap outside or
 * Escape does — and while editing a popover of tags (one per benched item)
 * opens beside the group ({@link HoldEditableProps.stashPlacement} picks the
 * side; that placement is the only customization). Drag a slotted item onto
 * the popover to bench it; drag a tag onto a slot to swap it in (the displaced
 * item takes the tag's place in the stash) or onto empty group space to append
 * it. Both directions commit through {@link HoldEditableProps.onStashChange}.
 *
 * **Two-stage holds.** {@link HoldEditableProps.onItemHold} gives an item a
 * *first-stage* hold action, fired part-way through the hold (500ms by
 * default): a send button can open its long-press menu there, and a user who
 * keeps holding still reaches the pickup — one gesture, two depths. The
 * release click after a fired action is swallowed, so releasing into the
 * popover never also activates the item.
 *
 * ```tsx
 * <HoldEditable
 *   items={tiles}
 *   getKey={(t) => t.id}
 *   onReorder={setTiles}
 *   stash={benched}
 *   onStashChange={(items, stash) => { setTiles(items); setBenched(stash); }}
 *   stashLabel={(t) => t.label}
 *   className="grid grid-cols-4 gap-2"
 * >
 *   {(tile, { editing }) => <StatTile {...tile} muted={editing} />}
 * </HoldEditable>
 * ```
 *
 * @summary iOS-springboard "hold to rearrange": press-and-hold picks an item
 * up, the rest jump in place, drag hands slots over, drop commits the new
 * order. Rows, columns and grids; an optional stash popover benches the
 * overflow items and swaps them in and out by drag.
 */
export function HoldEditable<T>({
  items,
  getKey,
  onReorder,
  children,
  className,
  itemClassName,
  holdDelay = 1400,
  onItemHold,
  holdActionDelay = 500,
  jumpInterval = 800,
  disabled = false,
  onEditStart,
  onEditEnd,
  stash,
  onStashChange,
  canStash,
  stashPlacement = 'bottom',
  stashLabel,
}: HoldEditableProps<T>) {
  useHoldEditableStyles();

  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [pressKey, setPressKey] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);
  /** Persistent edit mode — only meaningful when the stash system is on. */
  const [editMode, setEditMode] = useState(false);
  /** A normal drag is hovering the stash popover (release would bench the item). */
  const [overStash, setOverStash] = useState(false);
  /** A stash tag in flight, and what it is over. */
  const [stashDrag, setStashDrag] = useState<StashDragState | null>(null);
  const [stashOver, setStashOver] = useState<StashOver | null>(null);
  const [chipDrop, setChipDrop] = useState<ChipDropState | null>(null);
  /** Bumped on scroll/resize while the stash is open, to re-anchor the popover. */
  const [anchorTick, setAnchorTick] = useState(0);

  const stashEnabled = stash !== undefined;
  const stashItems = useMemo(() => stash ?? [], [stash]);
  const activeEdit = stashEnabled && editMode;
  const stashLabelOf = useCallback(
    (item: T): ReactNode => (stashLabel ? stashLabel(item) : getKey(item)),
    [stashLabel, getKey],
  );

  const byKey = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of items) m.set(getKey(it), it);
    return m;
  }, [items, getKey]);

  const stashByKey = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of stashItems) m.set(getKey(it), it);
    return m;
  }, [stashItems, getKey]);

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
  /** Tag element per key, inside the stash popover. */
  const tagEls = useRef(new Map<string, HTMLDivElement>());
  /** The stash popover element, for hit-testing and outside-tap detection. */
  const stashRef = useRef<HTMLDivElement | null>(null);
  /** Order at pickup, so Escape / pointercancel can put everything back. */
  const orderAtPickup = useRef<string[]>([]);
  /** Timestamp of the last drop — see the click-suppression effect below. */
  const droppedAt = useRef(0);
  const holdTimer = useRef<number | null>(null);
  /** Pending first-stage hold action (see {@link HoldEditableProps.onItemHold}). */
  const actionTimer = useRef<number | null>(null);
  /** The first-stage action ran for the current press — swallow the release click. */
  const actionFired = useRef(false);
  const dropTimer = useRef<number | null>(null);
  const chipTimer = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const arrangementRef = useRef<Arrangement | null>(null);
  arrangementRef.current = arrangement;
  const stashDragRef = useRef<StashDragState | null>(null);
  stashDragRef.current = stashDrag;
  const stashOverRef = useRef<StashOver | null>(null);
  stashOverRef.current = stashOver;
  const overStashRef = useRef(false);
  const editModeRef = useRef(false);
  editModeRef.current = activeEdit;
  /** Slot geometry frozen at stash-tag pickup (container-relative). */
  const stashSlots = useRef<StashSlotModel | null>(null);
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
    if (actionTimer.current !== null) {
      window.clearTimeout(actionTimer.current);
      actionTimer.current = null;
    }
  };

  /** Once in edit mode, the next pickup shouldn't demand the full deliberate hold. */
  const effectiveHoldDelay = activeEdit ? Math.min(EDIT_HOLD_MS, holdDelay) : holdDelay;

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
      setArrangement({
        dom,
        order: [...dom],
        home,
        horizontal: isHorizontal(home),
        grid: isGrid(home),
      });
      setPressKey(null);
      setDrag({ key, w: r.width, h: r.height, grabX: x - r.left, grabY: y - r.top, x, y });
      navigator.vibrate?.(12);
      if (stashEnabled) {
        // With a stash, edit mode outlives the drag; onEditStart marks entering
        // the mode, not every pickup.
        if (!editModeRef.current) {
          setEditMode(true);
          onEditStart?.();
        }
      } else {
        onEditStart?.();
      }
    },
    [onEditStart, stashEnabled],
  );

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    if (disabled || dragRef.current || stashDragRef.current || drop) return;
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
    actionFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      // Pick up wherever the pointer is *now*, not where it went down: over
      // 1.4s a mouse drifts, and starting the drag at a stale point would make
      // the item jump out from under the cursor.
      beginDrag(key, lastPointer.current.x, lastPointer.current.y);
    }, effectiveHoldDelay);
    // First-stage action: only on the deliberate (non-edit-mode) hold, and only
    // when it actually lands before the pickup would.
    if (onItemHold && !editModeRef.current && holdActionDelay < effectiveHoldDelay) {
      actionTimer.current = window.setTimeout(() => {
        actionTimer.current = null;
        const item = byKey.get(key);
        if (item !== undefined && onItemHold(item) !== false) {
          actionFired.current = true;
          navigator.vibrate?.(8);
        }
      }, holdActionDelay);
    }
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
    // the item one slot short. (A grid needs none of this: its hitboxes are
    // the frozen cell rects themselves, so a claim can't oscillate.)
    if (!a.grid) {
      const r = a.home[over];
      const pos = a.horizontal ? x : y;
      const near = a.horizontal ? r.left : r.top;
      const span = a.horizontal ? r.width : r.height;
      const threshold = near + span * (over > held ? CROSS_FRACTION : 1 - CROSS_FRACTION);
      if (over > held ? pos < threshold : pos > threshold) return;
    }

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
      if (!d || !a) {
        // The first-stage hold action ran but the press never became a pickup:
        // the release lands in the caller's popover, and the click it fires
        // must not also activate the item under the pointer.
        if (actionFired.current) {
          actionFired.current = false;
          droppedAt.current = Date.now();
        }
        return;
      }

      // Released over the stash popover: the item leaves the group entirely.
      // No settle animation for the survivors — the parent's state changes and
      // the grid reflows to the remaining items at once — but the held ghost
      // flies into the popover and fades, which carries the meaning.
      if (!cancelled && stashEnabled && overStashRef.current) {
        overStashRef.current = false;
        setOverStash(false);
        setDrag(null);
        setArrangement(null);

        const item = byKey.get(d.key);
        const s = stashRef.current;
        if (s) {
          const r = rectOf(s);
          setDrop({
            key: d.key,
            w: d.w,
            h: d.h,
            x: r.left + r.width / 2 - d.w / 2,
            y: r.top + r.height / 2 - d.h / 2,
            fade: true,
          });
          if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
          dropTimer.current = window.setTimeout(() => {
            dropTimer.current = null;
            setDrop(null);
          }, DROP_MS);
        }
        droppedAt.current = Date.now();

        if (item !== undefined) {
          const remaining = a.order.filter((k) => k !== d.key);
          const nextItems = remaining
            .map((k) => byKey.get(k))
            .filter((it): it is T => it !== undefined);
          onStashChange?.(nextItems, [...stashItems, item]);
        }
        return;
      }

      const finalOrder = cancelled ? orderAtPickup.current : a.order;
      const settled: Arrangement = { ...a, order: finalOrder };
      setArrangement(settled);

      // Land the ghost on the slot the item is taking, in viewport coordinates.
      const c = containerRef.current ? rectOf(containerRef.current) : { left: 0, top: 0 };
      let x: number;
      let y: number;
      if (a.grid) {
        const slot = a.home[finalOrder.indexOf(d.key)];
        x = c.left + slot.left;
        y = c.top + slot.top;
      } else {
        const pos = positionsFor(finalOrder, settled).get(d.key) ?? 0;
        const homeRect = a.home[a.dom.indexOf(d.key)];
        x = a.horizontal ? c.left + pos : c.left + homeRect.left;
        y = a.horizontal ? c.top + homeRect.top : c.top + pos;
      }

      setDrag(null);
      setOverStash(false);
      overStashRef.current = false;
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
      // With a stash, the mode persists across drops; onEditEnd fires when the
      // user dismisses it (tap outside / Escape), in the effect below.
      if (!stashEnabled) onEditEnd?.();
    },
    [byKey, onReorder, onEditEnd, stashEnabled, stashItems, onStashChange],
  );

  /* ------------------------------------------------------ stash-tag drags */

  const beginStashDrag = (e: React.PointerEvent, key: string) => {
    if (disabled || dragRef.current || stashDragRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = tagEls.current.get(key);
    const container = containerRef.current;
    if (!el || !container) return;

    // Freeze the slot hitboxes now, container-relative — the same model a
    // normal drag uses, minus the reflow (a tag targets a slot, it doesn't
    // displace it until the drop commits the swap).
    const c = rectOf(container);
    const slotKeys = items.map(getKey);
    const home: Rect[] = [];
    for (const k of slotKeys) {
      const slot = slots.current.get(k);
      if (!slot) return;
      const r = rectOf(slot);
      home.push({ left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height });
    }
    stashSlots.current = { keys: slotKeys, home };

    const r = rectOf(el);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setStashDrag({
      key,
      w: r.width,
      h: r.height,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      x: e.clientX,
      y: e.clientY,
    });
    navigator.vibrate?.(12);
  };

  /** Hit-test a dragged tag: a slot claims it, otherwise empty group space appends. */
  const considerStashMove = useCallback(() => {
    const sd = stashDragRef.current;
    const container = containerRef.current;
    const model = stashSlots.current;
    if (!sd || !container || !model) return;
    const c = rectOf(container);
    const x = lastPointer.current.x - c.left;
    const y = lastPointer.current.y - c.top;
    const i = model.home.findIndex((r) => hits(r, x, y));
    const next: StashOver | null =
      i >= 0
        ? { type: 'slot', key: model.keys[i] }
        : x >= 0 && y >= 0 && x <= c.width && y <= c.height
          ? { type: 'append' }
          : null;
    setStashOver((prev) => (sameOver(prev, next) ? prev : next));
  }, []);

  const endStashDrag = useCallback(
    (cancelled: boolean) => {
      const sd = stashDragRef.current;
      if (!sd) return;
      const over = cancelled ? null : stashOverRef.current;
      const item = stashByKey.get(sd.key);
      const label = item !== undefined ? stashLabelOf(item) : sd.key;
      const container = containerRef.current;

      // Where the released chip flies: into the slot it claimed (and fade), or
      // back to its place in the popover (no fade — the real tag reappears).
      let flight: { x: number; y: number; fade: boolean } | null = null;

      if (item !== undefined && over && container) {
        const c = rectOf(container);
        if (over.type === 'slot') {
          const idx = items.findIndex((it) => getKey(it) === over.key);
          const model = stashSlots.current;
          const slot = model ? model.home[model.keys.indexOf(over.key)] : undefined;
          if (idx >= 0 && slot) {
            // Swap: the tag takes the slot, the displaced item takes the tag's
            // place in the stash — the bench never silently grows or shrinks.
            const nextItems = [...items];
            const displaced = nextItems[idx];
            nextItems[idx] = item;
            const nextStash = [...stashItems];
            const tagIdx = nextStash.findIndex((it) => getKey(it) === sd.key);
            if (tagIdx >= 0) nextStash[tagIdx] = displaced;
            onStashChange?.(nextItems, nextStash);
            flight = {
              x: c.left + slot.left + slot.width / 2 - sd.w / 2,
              y: c.top + slot.top + slot.height / 2 - sd.h / 2,
              fade: true,
            };
          }
        } else {
          onStashChange?.(
            [...items, item],
            stashItems.filter((it) => getKey(it) !== sd.key),
          );
          flight = { x: sd.x - sd.grabX, y: sd.y - sd.grabY, fade: true };
        }
      }
      if (!flight) {
        const el = tagEls.current.get(sd.key);
        if (el) {
          const r = rectOf(el);
          flight = { x: r.left, y: r.top, fade: false };
        }
      }

      droppedAt.current = Date.now();
      setStashDrag(null);
      setStashOver(null);
      if (flight) {
        setChipDrop({ key: sd.key, label, w: sd.w, h: sd.h, ...flight });
        if (chipTimer.current !== null) window.clearTimeout(chipTimer.current);
        chipTimer.current = window.setTimeout(() => {
          chipTimer.current = null;
          setChipDrop(null);
        }, DROP_MS);
      }
    },
    [items, stashItems, stashByKey, getKey, onStashChange, stashLabelOf],
  );

  // Window-level pointer handling: a drag must survive the pointer leaving the
  // item (and the group) entirely.
  useEffect(() => {
    if (!pressKey && !drag && !stashDrag) return;

    const onMove = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
      const sd = stashDragRef.current;
      if (sd) {
        setStashDrag({ ...sd, x: e.clientX, y: e.clientY });
        considerStashMove();
        return;
      }
      const d = dragRef.current;
      if (!d) {
        // Still waiting out the hold. Travel only cancels it for a *finger*,
        // where it means "I'm scrolling, not holding". A mouse can't scroll
        // with the button down, and a hand resting on one drifts well past any
        // sane threshold over 1.4s — cancelling on that made hold-to-drag
        // essentially impossible on desktop. So the mouse keeps holding, and
        // the pickup simply happens wherever the cursor ended up.
        if (e.pointerType === 'mouse') return;
        const dx = e.clientX - pressPos.current.x;
        const dy = e.clientY - pressPos.current.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          clearHoldTimer();
          setPressKey(null);
        }
        return;
      }
      setDrag({ ...d, x: e.clientX, y: e.clientY });
      // Over the stash popover the slots stop re-filing — releasing there
      // benches the item instead of dropping it into a slot. Items the caller
      // marked un-stashable never enter that state: the popover stays inert.
      const held = byKey.get(d.key);
      const stashable = !canStash || (held !== undefined && canStash(held) !== false);
      const s = stashEnabled && stashable ? stashRef.current : null;
      const inStash = !!s && hits(rectOf(s), e.clientX, e.clientY);
      if (inStash !== overStashRef.current) {
        overStashRef.current = inStash;
        setOverStash(inStash);
      }
      if (!inStash) considerMove();
    };
    const onUp = () => (stashDragRef.current ? endStashDrag(false) : endDrag(false));
    const onCancel = () => {
      if (stashDragRef.current) endStashDrag(true);
      else if (dragRef.current) endDrag(true);
      else setPressKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stashDragRef.current) endStashDrag(true);
      else if (dragRef.current) endDrag(true);
    };
    // Once an item is picked up the finger owns it: stop the page scrolling
    // under it. Must be non-passive to be allowed to preventDefault.
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current || stashDragRef.current) e.preventDefault();
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
  }, [pressKey, drag, stashDrag, endDrag, endStashDrag, considerMove, considerStashMove, stashEnabled, byKey, canStash]);

  /* -------------------------------------------------- edit mode (w/ stash) */

  const exitEditMode = useCallback(() => {
    clearHoldTimer();
    setPressKey(null);
    setEditMode(false);
    onEditEnd?.();
  }, [onEditEnd]);

  // Persistent edit mode is dismissed like iOS's jiggle mode: a tap anywhere
  // outside the group and its stash, or Escape when nothing is in flight.
  useEffect(() => {
    if (!activeEdit) return;
    const onDown = (e: PointerEvent) => {
      if (dragRef.current || stashDragRef.current) return;
      const t = e.target as Node | null;
      if (t && (containerRef.current?.contains(t) || stashRef.current?.contains(t))) return;
      // The tap that dismisses edit mode must not also activate what it hit.
      droppedAt.current = Date.now();
      exitEditMode();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dragRef.current && !stashDragRef.current) exitEditMode();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [activeEdit, exitEditMode]);

  // Keep the popover glued to the group across scrolls and resizes.
  useEffect(() => {
    if (!activeEdit) return;
    const bump = () => setAnchorTick((t) => t + 1);
    window.addEventListener('resize', bump);
    window.addEventListener('scroll', bump, true);
    return () => {
      window.removeEventListener('resize', bump);
      window.removeEventListener('scroll', bump, true);
    };
  }, [activeEdit]);

  useEffect(() => {
    if (disabled && editMode) exitEditMode();
  }, [disabled, editMode, exitEditMode]);

  // A hold-then-release still fires a click on whatever was under the pointer.
  // These items are usually links or buttons, so swallow the click that closes
  // a drag — reordering the navbar must not also navigate. In persistent edit
  // mode every click inside the group is swallowed (taps rearrange, they don't
  // activate — same rule as iOS's jiggle mode), except on opted-out sub-trees.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const recent = Date.now() - droppedAt.current <= CLICK_SUPPRESS_MS;
      const t = e.target as Element | null;
      const inGroup =
        !!t &&
        ((containerRef.current?.contains(t) ?? false) || (stashRef.current?.contains(t) ?? false));
      const editingTap = editModeRef.current && inGroup && !t?.closest?.(NO_HOLD_SELECTOR);
      if (!recent && !editingTap) return;
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
      if (chipTimer.current !== null) window.clearTimeout(chipTimer.current);
    },
    [],
  );

  /* ------------------------------------------------------------- rendering */

  const editing = drag !== null || stashDrag !== null || activeEdit;
  const ghostKey = drag?.key ?? drop?.key ?? null;
  // The stash paths hand items across lists mid-flight, so the ghost's item
  // may already live on the other side by the time the drop animation runs.
  const ghostItem = ghostKey ? (byKey.get(ghostKey) ?? stashByKey.get(ghostKey)) : undefined;

  // Where each item currently sits, versus where its DOM node actually is.
  // Rows and columns shift along their axis; a grid hops between slot rects.
  const offsets = useMemo(() => {
    if (!arrangement || arrangement.dom.length !== arrangement.order.length) return null;
    const out = new Map<string, { x: number; y: number }>();
    if (arrangement.grid) {
      arrangement.dom.forEach((k, i) => {
        const j = arrangement.order.indexOf(k);
        const target = arrangement.home[j] ?? arrangement.home[i];
        out.set(k, {
          x: target.left - arrangement.home[i].left,
          y: target.top - arrangement.home[i].top,
        });
      });
      return out;
    }
    const pos = positionsFor(arrangement.order, arrangement);
    arrangement.dom.forEach((k, i) => {
      const home = arrangement.horizontal ? arrangement.home[i].left : arrangement.home[i].top;
      const shift = (pos.get(k) ?? home) - home;
      out.set(k, arrangement.horizontal ? { x: shift, y: 0 } : { x: 0, y: shift });
    });
    return out;
  }, [arrangement]);

  const slotIndex = (key: string) =>
    arrangement ? arrangement.order.indexOf(key) : keys.indexOf(key);

  // The stash popover anchors to the group's live rect; `anchorTick` re-runs
  // this on scroll/resize while it is open. (Read during render on purpose —
  // the ref is always set by the time edit mode can be on.)
  void anchorTick;
  const showStash = activeEdit;
  const stashAnchor =
    showStash && containerRef.current ? rectOf(containerRef.current) : null;

  const canPortal = typeof document !== 'undefined';

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        data-hold-editable-dragging={drag !== null || stashDrag !== null || undefined}
      >
        {list.map((item, domIndex) => {
          const key = keys[domIndex];
          const held = key === ghostKey;
          const pressing = key === pressKey;
          const shift = offsets?.get(key);
          const index = slotIndex(key);
          const stashTarget = stashOver?.type === 'slot' && stashOver.key === key;
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
              className={typeof itemClassName === 'function' ? itemClassName(item) : itemClassName}
              style={
                arrangement && shift
                  ? {
                      position: 'relative',
                      transform: `translate(${shift.x}px, ${shift.y}px)`,
                      transition: `transform ${SHUFFLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
                    }
                  : stashTarget
                    ? { position: 'relative' }
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
                            transition: `transform ${effectiveHoldDelay}ms cubic-bezier(0.4, 0, 0.6, 1)`,
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

              {/* A dragged stash tag is over this slot: dropping swaps it in. */}
              {stashTarget && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-10 rounded-xl border-2 border-primary/60 bg-primary/10"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* The picked-up item, lifted out of the flow into a body-level layer so
          no `overflow: hidden` ancestor can clip it while it roams. */}
      {ghostItem !== undefined &&
        canPortal &&
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
                : `translate3d(${drop!.x}px, ${drop!.y}px, 0) scale(${drop!.fade ? 0.3 : 1})`,
              transition: drag
                ? 'none'
                : `transform ${DROP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), filter ${DROP_MS}ms ease-out, opacity ${DROP_MS}ms ease-out`,
              opacity: !drag && drop?.fade ? 0 : 1,
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

      {/* The stash: a popover of tags for the benched items, open while the
          group is in edit mode. Placement is the caller's; the look is not. */}
      {showStash &&
        stashAnchor &&
        canPortal &&
        createPortal(
          <div
            ref={stashRef}
            data-hold-editable-stash=""
            style={{ position: 'fixed', zIndex: 90, ...stashPositionStyle(stashAnchor, stashPlacement) }}
            className={cn(
              'rounded-2xl border bg-background/95 p-2 shadow-xl backdrop-blur transition-colors',
              overStash ? 'border-primary/60 bg-primary/5' : 'border-border',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {stashItems.map((item) => {
                const key = getKey(item);
                const hidden =
                  stashDrag?.key === key || (chipDrop !== null && !chipDrop.fade && chipDrop.key === key);
                return (
                  <div
                    key={key}
                    data-hold-editable-item=""
                    ref={(el) => {
                      if (el) tagEls.current.set(key, el);
                      else tagEls.current.delete(key);
                    }}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={(e) => beginStashDrag(e, key)}
                    className={TAG_CLASS}
                    style={{
                      touchAction: 'none',
                      visibility: hidden ? 'hidden' : undefined,
                    }}
                  >
                    <span className="truncate">{stashLabelOf(item)}</span>
                  </div>
                );
              })}
              {stashItems.length === 0 && (
                <span className="mono px-1.5 py-1 text-[11px] text-muted-foreground">
                  drag an item here to stash it
                </span>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* A stash tag in flight (following the pointer, or flying to its drop). */}
      {(stashDrag || chipDrop) &&
        canPortal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              zIndex: 100,
              pointerEvents: 'none',
              willChange: 'transform',
              transform: stashDrag
                ? `translate3d(${stashDrag.x - stashDrag.grabX}px, ${stashDrag.y - stashDrag.grabY}px, 0) scale(1.06)`
                : `translate3d(${chipDrop!.x}px, ${chipDrop!.y}px, 0) scale(${chipDrop!.fade ? 0.5 : 1})`,
              transition: stashDrag
                ? 'none'
                : `transform ${DROP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${DROP_MS}ms ease-out, filter ${DROP_MS}ms ease-out`,
              opacity: !stashDrag && chipDrop?.fade ? 0 : 1,
              filter: stashDrag
                ? 'drop-shadow(0 6px 12px rgb(0 0 0 / 0.25))'
                : 'drop-shadow(0 0 0 rgb(0 0 0 / 0))',
            }}
          >
            <div className={TAG_CLASS} style={{ width: stashDrag?.w ?? chipDrop?.w }}>
              <span className="truncate">
                {stashDrag
                  ? (() => {
                      const it = stashByKey.get(stashDrag.key);
                      return it !== undefined ? stashLabelOf(it) : stashDrag.key;
                    })()
                  : chipDrop!.label}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
