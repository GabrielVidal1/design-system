import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
 * Finger travel (px) that cancels a pending hold. **The hold is a static
 * gesture**: the press has to stay put. A finger sliding across an item is
 * scrolling — very often along a horizontally scrollable child, a chart or a
 * wide table, where the page underneath never moves at all — and lifting an
 * item out from under that gesture is wrong every time. Tight on purpose.
 */
const MOVE_CANCEL_PX = 8;
/**
 * The same threshold for a mouse, wider. A mouse can't scroll with the button
 * down, and a hand resting on one drifts several pixels over the deliberate
 * 1.4s hold — a finger-tight threshold made hold-to-drag impossible on
 * desktop. Wide enough to absorb that drift, tight enough that an actual drag
 * still reads as one.
 */
const MOUSE_MOVE_CANCEL_PX = 32;
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
 * An item longer than this along the main axis is "big" — big enough that a
 * column of them doesn't fit on screen, which is what makes drag-reordering
 * miserable. One such item switches the group into compact edit mode.
 */
const COMPACT_TRIGGER_PX = 96;
/** What every item is clipped to in compact edit mode (main axis, px). */
const COMPACT_PX = 52;
/** Native text entry — the one place a hold has always meant "select text". */
const TEXT_ENTRY_SELECTOR =
  "input, textarea, select, [contenteditable=''], [contenteditable='true']";
/**
 * Sub-trees a press must not arm at all. `data-hold-editable-ignore` is the
 * caller's escape hatch; the rest are the panels of an open overlay, which
 * portal-less components (Popover, Tooltip, a menu) render *inside* the item
 * they belong to. Content that only exists because the user already opened it
 * is content they want to use, not a surface to pick the item up by.
 */
const NEVER_HOLD_SELECTOR =
  "[data-hold-editable-ignore], .ds-popover-panel, [role='dialog'], [role='menu'], [role='listbox'], [role='tooltip']";
/**
 * Sub-trees the pickup must beat to the punch (tier `first`). A long press on
 * a link pops the OS "open in new tab" callout at ~500ms on a phone, and that
 * callout cancels the touch — so either the pickup happens before it, or it
 * never happens at all.
 */
const FIRST_HOLD_SELECTOR = "a[href], [data-hold-editable-first]";
/**
 * Sub-trees that own the *early* part of a press (tier `last`): text selection
 * in a field, a control's own long-press menu, {@link HoldEditableProps.onItemHold}.
 * The pickup queues up behind all of it.
 */
const LAST_HOLD_SELECTOR = `button, [role='button'], [data-hold-editable-last], ${TEXT_ENTRY_SELECTOR}`;
/**
 * Clicks that survive edit mode. Everything else inside the group is swallowed
 * while editing (taps rearrange, they don't activate — iOS's jiggle-mode rule),
 * but a text field the user is placing a caret in, and anything explicitly
 * opted out, have to keep working.
 */
const CLICK_THROUGH_SELECTOR = `${NEVER_HOLD_SELECTOR}, ${TEXT_ENTRY_SELECTOR}`;

/**
 * How urgently a press turns into a pickup, resolved per target — see the
 * "Hold tiers" paragraph on {@link HoldEditable}.
 */
export type HoldEditableHoldTier = 'first' | 'normal' | 'last' | 'never';

/**
 * Which tier the element a press landed on belongs to. Resolved on
 * `pointerdown` from the event target, so one item can hold several: a card's
 * chrome is `normal`, the link in it is `first`, its footer buttons `last`,
 * and the popover it opened is `never`.
 */
function holdTierOf(target: Element | null | undefined): HoldEditableHoldTier {
  if (!target || typeof target.closest !== 'function') return 'normal';
  if (target.closest(NEVER_HOLD_SELECTOR)) return 'never';
  if (target.closest(FIRST_HOLD_SELECTOR)) return 'first';
  if (target.closest(LAST_HOLD_SELECTOR)) return 'last';
  return 'normal';
}

const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  typeof target.closest === 'function' &&
  target.closest(TEXT_ENTRY_SELECTOR) !== null;

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
  /** Hold duration before an item is picked up, in ms. The `normal` tier. */
  holdDelay?: number;
  /**
   * Hold duration for the **`first` tier** — a press on an `<a href>` or on
   * anything marked `data-hold-editable-first`, in ms. Deliberately *shorter*
   * than {@link holdDelay}: a phone pops the OS link callout at around 500ms
   * and that cancels the touch, so the pickup has to land before it or not at
   * all. Keep it under ~400ms.
   * @default Math.min(holdDelay, 320)
   */
  linkHoldDelay?: number;
  /**
   * Extra hold, on top of {@link holdDelay}, for the **`last` tier** — buttons,
   * `[role=button]`, native text fields, `[contenteditable]` and anything
   * marked `data-hold-editable-last`, in ms. Those own the early part of the
   * press (selecting text, their own long-press menu,
   * {@link onItemHold}), so the pickup queues up behind them.
   * @default 600
   */
  interactiveHoldOffset?: number;
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
   * doesn't. The **stash system is on by default**: edit mode is persistent
   * (it survives a drop, until a plain tap — inside the group or out — or
   * Escape dismisses it) and,
   * while editing, a popover of tags opens beside the group. Slotted items
   * dragged onto the popover are benched; a tag dragged onto a slot swaps in
   * and benches the item it displaces; a tag dropped on the group's empty
   * space is appended. Every removal is therefore undoable — the bench is
   * where removed items wait, never a delete.
   *
   * Pass an array to **control** the bench (persist it, seed it, share it) and
   * pair it with {@link onStashChange}. Leave it out and the component keeps
   * its own bench in local state — the affordance is there with no wiring,
   * but it lives and dies with the mount. Pass `false` to turn the whole
   * system off: no popover, and edit mode ends on the drop.
   */
  stash?: T[] | false;
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
  /**
   * **Compact edit mode.** A column of tall items (cards, panels, sections) is
   * unreorderable in practice: two of them fill the screen, so every move is a
   * blind drag against an auto-scrolling edge. When the group is a single-axis
   * list — not a grid — and any item runs longer than ~96px, entering edit mode
   * collapses *every* item to a short label row, so the whole list is visible
   * at once and a reorder is one short drag. Dropping out of edit mode restores
   * the real items. Set `false` to always drag the items themselves.
   * @default true
   */
  compactEdit?: boolean;
  /**
   * Label for an item's compact row. Falls back to {@link stashLabel}, then to
   * the item's key — so a group with either one already reads well collapsed.
   */
  compactLabel?: (item: T) => ReactNode;
  /**
   * **Freeform mode.** While editing, every item becomes an inline-editable
   * text row and a free-text "add" row appears under them, so the same gesture
   * that reorders the list also renames and grows it. That is what makes a
   * *plan-like* structure — a form's questions and their answer options, a
   * checklist, a menu — editable in place instead of behind a modal.
   *
   * It implies the compact-row treatment for the whole group (the grip on the
   * left is the drag handle, the rest of the row is a text input), whatever
   * {@link compactEdit} says: the row *is* the compact row.
   *
   * **Keep the stash on.** With `stash={false}` edit mode ends at the drop, so
   * every reorder closes the very fields the user came to type in. Freeform
   * needs the persistent edit mode the stash brings; the two are not
   * independent switches.
   * @default false
   */
  freeform?: boolean;
  /**
   * Seed text for an item's inline editor. Falls back to
   * {@link compactLabel} → {@link stashLabel} → the item's key, the same chain
   * the compact row uses (a non-string label falls through to the key, since
   * an `<input>` needs a string).
   */
  getText?: (item: T) => string;
  /** Commit of an inline edit — fired on Enter and on blur, only when the text changed. */
  onTextChange?: (item: T, text: string) => void;
  /**
   * Submit of the freeform add row. Omit it and no add row is rendered — a
   * group that only renames is a legitimate configuration.
   */
  onAdd?: (text: string) => void;
  /**
   * Renders a small × on each freeform row. What a removal *means* is the
   * caller's business: the stash is still the undoable-removal story, so a
   * group that wants "take this out, maybe put it back" should bench it there
   * rather than wire this.
   */
  onRemove?: (item: T) => void;
  /** Placeholder for the freeform add row. @default 'Add…' */
  addPlaceholder?: string;
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
/* …except where the user is meant to be writing. A 'last'-tier press on a
   field has to keep selecting text and placing a caret; inheriting the group's
   user-select:none would make the field look editable and behave like a rock. */
[data-hold-editable-item] input,
[data-hold-editable-item] textarea,
[data-hold-editable-item] select,
[data-hold-editable-item] [contenteditable=''],
[data-hold-editable-item] [contenteditable='true'] {
  -webkit-touch-callout: default;
  -webkit-user-select: auto;
  user-select: auto;
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

/**
 * The anchor the popover hangs off: the group's rect, clipped to the viewport.
 *
 * A group can be taller (or wider) than the screen — a column of page sections,
 * a long panel — and then its own top edge is nowhere near the part of it you
 * are holding. Hanging the popover off the raw rect puts it off-screen, which
 * is the same as not having a stash at all. Clipping first keeps the popover
 * glued to whatever part of the group is actually on screen, and leaves the
 * common case (a group smaller than the viewport) untouched.
 */
function visibleAnchor(c: Rect): Rect {
  if (typeof window === 'undefined') return c;
  const left = Math.min(Math.max(c.left, 0), window.innerWidth);
  const right = Math.max(Math.min(c.left + c.width, window.innerWidth), 0);
  const top = Math.min(Math.max(c.top, 0), window.innerHeight);
  const bottom = Math.max(Math.min(c.top + c.height, window.innerHeight), 0);
  return { left, top, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

/**
 * The stash popover's fixed-position style for a placement, off the group's
 * (viewport-clipped) rect. A side with no room left — `top` against the top of
 * the screen, `left` against its left edge — flips to the opposite side rather
 * than rendering out of view; `popover` is the popover's own measured size,
 * absent on the first frame (before the ref lands), where no flip is applied.
 */
function stashPositionStyle(
  raw: Rect,
  placement: HoldEditableStashPlacement,
  popover?: { width: number; height: number },
): CSSProperties {
  const c = visibleAnchor(raw);
  if (typeof window !== 'undefined' && popover) {
    const before = placement === 'top' ? c.top : c.left;
    const after =
      placement === 'top' || placement === 'bottom'
        ? window.innerHeight - (c.top + c.height)
        : window.innerWidth - (c.left + c.width);
    const vertical = placement === 'top' || placement === 'bottom';
    const need = (vertical ? popover.height : popover.width) + STASH_GAP;
    const room = placement === 'top' || placement === 'left' ? before : after;
    const other =
      placement === 'top' || placement === 'left'
        ? after
        : vertical
          ? c.top
          : c.left;
    if (need > room) {
      // The chosen side is against the edge of the screen. Flip if the other
      // side has room; if neither does — a group that fills the viewport — pin
      // the popover inside it, along the screen edge the placement points at.
      if (need <= other) placement = vertical ? (placement === 'top' ? 'bottom' : 'top') : placement === 'left' ? 'right' : 'left';
      else
        return vertical
          ? { left: c.left, top: window.innerHeight - popover.height - STASH_GAP, width: c.width }
          : { left: window.innerWidth - popover.width - STASH_GAP, top: c.top, maxWidth: 260 };
    }
  }
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

/** Chrome shared by the compact row and its freeform variant. */
const ROW_CLASS =
  'flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-xs text-foreground shadow-sm';

/** The dotted handle on the left of a row — the part you pick the item up by. */
function Grip() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 10 16"
      className="h-3.5 w-2.5 shrink-0 text-muted-foreground"
      fill="currentColor"
    >
      {[3, 8, 13].map((cy) =>
        [2.5, 7.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" />),
      )}
    </svg>
  );
}

/** The collapsed stand-in an item is dragged as in compact edit mode. */
function CompactRow({ children }: { children: ReactNode }) {
  return (
    <div className={ROW_CLASS} style={{ height: COMPACT_PX - 8 }}>
      <Grip />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

/**
 * A compact row whose label is an `<input>` — freeform mode's item row.
 *
 * The input carries `data-hold-editable-ignore` (tier `never`), so a press in
 * it places a caret instead of arming a pickup; the grip and the row's padding
 * are what is left as the pickup surface, which is exactly the iOS "handle on
 * the left, text in the middle" split.
 *
 * The value is local and re-seeded whenever `text` changes: the caller may not
 * be storing what we hand it (an uncontrolled list, a debounced save), and a
 * row that snapped back to the old text on every keystroke would be unusable.
 * `committed` remembers what was last sent up so Enter-then-blur doesn't fire
 * the same edit twice.
 */
function FreeformRow({
  text,
  onCommit,
  onRemove,
}: {
  text: string;
  onCommit: (text: string) => void;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState(text);
  const committed = useRef(text);
  useEffect(() => {
    setValue(text);
    committed.current = text;
  }, [text]);

  const commit = () => {
    if (value === committed.current) return;
    committed.current = value;
    onCommit(value);
  };

  return (
    <div className={ROW_CLASS} style={{ height: COMPACT_PX - 8 }}>
      <Grip />
      <input
        data-hold-editable-ignore=""
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            // Escape belongs to the editor here: it reverts this row. Stopping
            // it keeps the group's own Escape — which dismisses edit mode
            // entirely — from firing over the top of a much smaller undo.
            e.stopPropagation();
            setValue(text);
          }
        }}
      />
      {onRemove && (
        <button
          type="button"
          data-hold-editable-ignore=""
          aria-label="Remove"
          className="shrink-0 rounded-full px-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * The freeform add row. It lives in the group's normal flow, after the last
 * item, but it is **not** a slot: it carries no `data-hold-editable-item`, so
 * nothing measures it and the frozen arrangement never sees it. It is mounted
 * with the compact rows — one commit *before* the pickup measures them — so it
 * cannot shift the geometry a drag was frozen against either.
 *
 * Submitting keeps focus: adding several rows in a row is the normal way to
 * fill an empty list, and re-tapping the field between each would be absurd.
 */
function FreeformAddRow({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div
      data-hold-editable-add=""
      data-hold-editable-ignore=""
      className={cn(ROW_CLASS, 'border-dashed bg-transparent')}
      style={{ height: COMPACT_PX - 8 }}
    >
      <span aria-hidden className="w-2.5 shrink-0 text-center text-muted-foreground">
        +
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') {
            if (e.key === 'Escape') e.stopPropagation();
            return;
          }
          e.preventDefault();
          const text = value.trim();
          if (!text) return;
          onSubmit(text);
          setValue('');
        }}
      />
    </div>
  );
}

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
 * **The stash — on by default.** Every group has an overflow bench, so any
 * item can be taken out of the group and put back: a removal is never
 * destructive. Edit mode is persistent — a drop no longer ends it; a plain
 * tap (anywhere, in the group or outside it) or Escape does — and while
 * editing a popover of tags (one per
 * benched item) opens beside the group ({@link HoldEditableProps.stashPlacement}
 * picks the side; that placement is the only customization). Drag a slotted
 * item onto the popover to bench it; drag a tag onto a slot to swap it in (the
 * displaced item takes the tag's place in the stash) or onto empty group space
 * to append it. Pass {@link HoldEditableProps.stash} to own the bench (and
 * persist it) via {@link HoldEditableProps.onStashChange}; leave it out and the
 * component keeps the bench in local state; pass `stash={false}` to opt out.
 *
 * **Compact edit mode.** A column of tall cards collapses to short label rows
 * while editing (see {@link HoldEditableProps.compactEdit}) so a reorder is one
 * short drag instead of a blind fight with the scroll edge. Grids and rows of
 * small controls are left alone.
 *
 * **Two-stage holds.** {@link HoldEditableProps.onItemHold} gives an item a
 * *first-stage* hold action, fired part-way through the hold (500ms by
 * default): a send button can open its long-press menu there, and a user who
 * keeps holding still reaches the pickup — one gesture, two depths. The
 * release click after a fired action is swallowed, so releasing into the
 * popover never also activates the item.
 *
 * **Hold tiers.** A group whose items are plain boxes can use one flat delay;
 * a group of real UI can't, because the things inside an item already answer
 * to a press. So the delay is resolved per target, on `pointerdown`:
 *
 * - `first` — an `<a href>`, or `[data-hold-editable-first]`. Picked up
 *   *before* everything else ({@link HoldEditableProps.linkHoldDelay}, ~320ms),
 *   because a phone pops the OS "open in new tab" callout at around 500ms and
 *   that cancels the touch: a link is either picked up early or never. The
 *   callout is suppressed for the duration of an armed press.
 * - `last` — `button`, `[role=button]`, `input`, `textarea`, `select`,
 *   `[contenteditable]`, `[data-hold-editable-last]`. These own the early part
 *   of the press — selecting text, their own long-press menu,
 *   {@link HoldEditableProps.onItemHold} — so the pickup waits for
 *   `holdDelay + `{@link HoldEditableProps.interactiveHoldOffset}. A press
 *   there is never `preventDefault`ed, and a selection change or a keystroke
 *   cancels it outright: someone editing a field is not holding to reorder.
 * - `normal` — everything else: `holdDelay`, as before.
 * - `never` — `[data-hold-editable-ignore]` and the panels of an open overlay
 *   inside the item (`.ds-popover-panel`, `[role=dialog|menu|listbox|tooltip]`).
 *   A press there arms nothing at all. That is what makes a Popover or a
 *   Tooltip *inside* a reorderable item usable.
 *
 * Once the group is in edit mode the short {@link EDIT_HOLD_MS} shortcut wins
 * for every tier but `never` — picking the next item up stays immediate.
 *
 * **The hold is static.** Whatever the tier, the press has to stay put: travel
 * past a few pixels cancels it, and so does *any* scroll under it. Both are
 * needed. Travel alone misses the case that actually bites — a finger panning
 * a horizontally scrollable child (a chart, a wide table) inside an item,
 * where the scroller can claim the gesture and leave the pointer stream
 * looking still enough to pass for a hold. Scrolling a graph sideways must
 * never lift the card it lives in.
 *
 * **Freeform mode.** {@link HoldEditableProps.freeform} turns edit mode into an
 * inline text editor: every item becomes a compact row whose label is an
 * `<input>` (the grip stays the drag handle), and an add row appears under the
 * list. One gesture then covers the three things a small list needs —
 * reorder, rename, grow — which is what lets a plan-like structure (a form's
 * questions and their options) be edited where it is shown.
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
 * order. Rows, columns and grids; per-target hold tiers so links, buttons and
 * popovers inside an item keep working; an optional stash popover benches the
 * overflow items; an optional freeform mode makes edit mode rename and grow
 * the list too.
 */
export function HoldEditable<T>({
  items,
  getKey,
  onReorder,
  children,
  className,
  itemClassName,
  holdDelay = 1400,
  // Evaluated after `holdDelay` above, so it tracks a caller's shorter hold
  // instead of overshooting it — the link tier is never the slow one.
  linkHoldDelay = Math.min(holdDelay, 320),
  interactiveHoldOffset = 600,
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
  compactEdit = true,
  compactLabel,
  freeform = false,
  getText,
  onTextChange,
  onAdd,
  onRemove,
  addPlaceholder = 'Add…',
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
  /** Tall items are collapsed to label rows for the duration of edit mode. */
  const [compact, setCompact] = useState(false);
  /** A pickup deferred by one commit, so it measures the *collapsed* slots. */
  const [pendingPickup, setPendingPickup] = useState<string | null>(null);
  /**
   * The armed press's hold duration — its tier's (see {@link holdTierOf}).
   * State, not a ref, because the shrink-under-the-finger transition is timed
   * to it and has to be right on the very frame the press starts.
   */
  const [pressDelay, setPressDelay] = useState(holdDelay);

  const stashEnabled = stash !== false;
  /** The caller owns the bench; otherwise it lives here, keyed, for this mount. */
  const controlledStash = Array.isArray(stash);
  const [ownStashKeys, setOwnStashKeys] = useState<string[]>([]);

  // Uncontrolled bench: `items` is still the full list, so the benched ones are
  // filtered out of the slots here. Membership is tracked by key — an item the
  // parent stopped shipping simply falls out of the bench with it.
  const ownStashed = useMemo(() => new Set(controlledStash ? [] : ownStashKeys), [
    controlledStash,
    ownStashKeys,
  ]);
  const slotted = useMemo(
    () => (ownStashed.size === 0 ? items : items.filter((it) => !ownStashed.has(getKey(it)))),
    [items, ownStashed, getKey],
  );
  const stashItems = useMemo(() => {
    if (controlledStash) return stash as T[];
    if (ownStashKeys.length === 0) return [];
    const byId = new Map(items.map((it) => [getKey(it), it]));
    return ownStashKeys.map((k) => byId.get(k)).filter((it): it is T => it !== undefined);
  }, [controlledStash, stash, ownStashKeys, items, getKey]);

  const activeEdit = stashEnabled && editMode;
  const stashLabelOf = useCallback(
    (item: T): ReactNode => (stashLabel ? stashLabel(item) : getKey(item)),
    [stashLabel, getKey],
  );
  const compactLabelOf = useCallback(
    (item: T): ReactNode => (compactLabel ? compactLabel(item) : stashLabelOf(item)),
    [compactLabel, stashLabelOf],
  );
  /**
   * Seed for a freeform row's input. An `<input>` needs a string, so the usual
   * label chain is only usable as far as it stays one — a `compactLabel` that
   * returns markup falls through to the key rather than rendering as `[object
   * Object]` inside the field.
   */
  const freeformTextOf = useCallback(
    (item: T): string => {
      if (getText) return getText(item);
      const label = compactLabelOf(item);
      return typeof label === 'string' || typeof label === 'number' ? String(label) : getKey(item);
    },
    [getText, compactLabelOf, getKey],
  );

  const byKey = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of slotted) m.set(getKey(it), it);
    return m;
  }, [slotted, getKey]);

  const stashByKey = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of stashItems) m.set(getKey(it), it);
    return m;
  }, [stashItems, getKey]);

  /**
   * Commit a bench crossing. A controlled bench goes back to the caller as
   * both lists; an uncontrolled one is recorded here, and the caller still
   * hears about the slots that remain — that's a reorder like any other.
   */
  const commitStash = useCallback(
    (nextItems: T[], nextStash: T[]) => {
      if (controlledStash) {
        onStashChange?.(nextItems, nextStash);
        return;
      }
      setOwnStashKeys(nextStash.map(getKey));
      onStashChange?.(nextItems, nextStash);
      onReorder(nextItems);
    },
    [controlledStash, onStashChange, onReorder, getKey],
  );

  // While a drag is in flight we render the frozen DOM order; otherwise the
  // parent's. The frozen order is dropped if it no longer describes exactly the
  // items we were handed (the parent may add or remove one mid-drag).
  const list = useMemo(() => {
    const dom = arrangement?.dom;
    if (!dom || dom.length !== slotted.length) return slotted;
    if (dom.some((k) => !byKey.has(k))) return slotted;
    return dom.map((k) => byKey.get(k)!);
  }, [arrangement, slotted, byKey]);

  const keys = useMemo(() => list.map(getKey), [list, getKey]);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  /** Mirror of `pressKey`, readable from the deferred-pickup layout effect. */
  const pressKeyRef = useRef<string | null>(null);
  pressKeyRef.current = pressKey;
  /**
   * Mirror of `pendingPickup`, readable from the window listeners. The
   * scroll-cancel below has to leave a deferred pickup alone: collapsing a
   * column of tall cards to label rows *shortens the page*, which the browser
   * answers with a scroll event — and cancelling on our own collapse would
   * make compact edit mode unreachable.
   */
  const pendingPickupRef = useRef<string | null>(null);
  pendingPickupRef.current = pendingPickup;

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
  /** Tier of the press currently armed — the `last` one is the cancellable kind. */
  const pressTier = useRef<HoldEditableHoldTier>('normal');
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

  /**
   * How long *this* press must be held. Once in edit mode the next pickup
   * shouldn't demand the full deliberate hold, whatever the target is — the
   * only thing the tiers guard is the way *into* the mode. (A `never` press
   * never gets here: it is dropped before a timer is armed.)
   */
  const holdDelayFor = useCallback(
    (tier: HoldEditableHoldTier): number => {
      if (activeEdit) return Math.min(EDIT_HOLD_MS, holdDelay);
      if (tier === 'first') return linkHoldDelay;
      if (tier === 'last') return holdDelay + interactiveHoldOffset;
      return holdDelay;
    },
    [activeEdit, holdDelay, linkHoldDelay, interactiveHoldOffset],
  );

  /* -------------------------------------------------- compact edit mode */

  /**
   * Whether this group should collapse to label rows while editing: a
   * single-axis list (a grid already fits — its cells are small and 2D
   * slot-hopping needs the real geometry) holding at least one item too long
   * to drag comfortably. Freeform mode short-circuits it: its editable rows
   * *are* the compact rows, so it collapses whatever the geometry says.
   */
  const shouldCompact = useCallback((): boolean => {
    if (freeform) return true;
    if (!compactEdit) return false;
    const rects: Rect[] = [];
    for (const k of keysRef.current) {
      const el = slots.current.get(k);
      if (el) rects.push(rectOf(el));
    }
    if (rects.length < 2 || isGrid(rects)) return false;
    const horizontal = isHorizontal(rects);
    return rects.some((r) => (horizontal ? r.width : r.height) > COMPACT_TRIGGER_PX);
  }, [compactEdit, freeform]);

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
      // Clamped: in compact edit mode the item collapsed under the finger, so
      // the point it was grabbed at can now sit outside it entirely.
      setDrag({
        key,
        w: r.width,
        h: r.height,
        grabX: Math.min(Math.max(x - r.left, 0), r.width),
        grabY: Math.min(Math.max(y - r.top, 0), r.height),
        x,
        y,
      });
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

  /**
   * The hold has landed. Normally that is the pickup — but a list of tall items
   * collapses to label rows first, and the pickup has to wait one commit for
   * that: `beginDrag` freezes the slot geometry, and geometry measured against
   * the full-height cards would describe a layout that no longer exists. The
   * pointer is captured on the (unchanging) slot wrapper before the collapse,
   * so swapping the item's own subtree out from under a finger can't cancel the
   * touch mid-gesture.
   */
  const requestPickup = useCallback(
    (key: string) => {
      const { x, y } = lastPointer.current;
      if (!compact && shouldCompact()) {
        const el = slots.current.get(key);
        if (el && pointerId.current !== null) {
          try {
            el.setPointerCapture(pointerId.current);
          } catch {
            /* pointer already gone — the pickup will no-op on the next event */
          }
        }
        setCompact(true);
        setPendingPickup(key);
        return;
      }
      beginDrag(key, x, y);
    },
    [compact, shouldCompact, beginDrag],
  );

  // The collapsed rows are in the DOM now — pick up against *their* geometry.
  useLayoutEffect(() => {
    if (pendingPickup === null) return;
    setPendingPickup(null);
    if (pressKeyRef.current !== pendingPickup) return; // released in between
    beginDrag(pendingPickup, lastPointer.current.x, lastPointer.current.y);
  }, [pendingPickup, beginDrag]);

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    if (disabled || dragRef.current || stashDragRef.current || drop) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // What the press landed on decides how long it has to last — and whether
    // it counts at all. An opted-out sub-tree or an open overlay's panel arms
    // nothing: no timer, no pressKey, no swallowed click.
    const tier = holdTierOf(e.target as Element | null);
    if (tier === 'never') return;
    // Groups nest — a hold-editable grid of stats inside a hold-editable stack
    // of cards. The press belongs to the innermost group that takes it, or a
    // single hold would arm both and pick up two items at once.
    e.stopPropagation();
    pressPos.current = { x: e.clientX, y: e.clientY };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    pointerId.current = e.pointerId;
    pressTier.current = tier;
    const delay = holdDelayFor(tier);
    setPressDelay(delay);
    setPressKey(key);
    clearHoldTimer();
    actionFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      // Pick up wherever the pointer is *now*, not where it went down: over
      // 1.4s a mouse drifts, and starting the drag at a stale point would make
      // the item jump out from under the cursor.
      requestPickup(key);
    }, delay);
    // First-stage action: only on the deliberate (non-edit-mode) hold, and only
    // when it actually lands before the pickup would.
    if (onItemHold && !editModeRef.current && holdActionDelay < delay) {
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

      // Never bench the last slot. An empty group has nothing left to hold, so
      // there would be no way back into edit mode — and the popover that holds
      // everything the user took out only exists while editing. The drop falls
      // through to a normal one instead.
      if (overStashRef.current && a.order.length <= 1) {
        overStashRef.current = false;
        setOverStash(false);
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
          commitStash(nextItems, [...stashItems, item]);
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
        // transforms were already showing, so the swap is invisible. Without a
        // stash the drop also ends edit mode, so the real items come back with
        // it — after the ghost has landed, never under it.
        setArrangement(null);
        if (!stashEnabled) setCompact(false);
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
    [byKey, onReorder, onEditEnd, stashEnabled, stashItems, commitStash],
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
    const slotKeys = slotted.map(getKey);
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
          const idx = slotted.findIndex((it) => getKey(it) === over.key);
          const model = stashSlots.current;
          const slot = model ? model.home[model.keys.indexOf(over.key)] : undefined;
          if (idx >= 0 && slot) {
            // Swap: the tag takes the slot, the displaced item takes the tag's
            // place in the stash — the bench never silently grows or shrinks.
            const nextItems = [...slotted];
            const displaced = nextItems[idx];
            nextItems[idx] = item;
            const nextStash = [...stashItems];
            const tagIdx = nextStash.findIndex((it) => getKey(it) === sd.key);
            if (tagIdx >= 0) nextStash[tagIdx] = displaced;
            commitStash(nextItems, nextStash);
            flight = {
              x: c.left + slot.left + slot.width / 2 - sd.w / 2,
              y: c.top + slot.top + slot.height / 2 - sd.h / 2,
              fade: true,
            };
          }
        } else {
          commitStash(
            [...slotted, item],
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
    [slotted, stashItems, stashByKey, getKey, commitStash, stashLabelOf],
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
        // Still waiting out the hold, and the hold is static: travel past the
        // threshold means the user is scrolling or dragging something else,
        // never holding. Every pointer type is held to it — a mouse just gets
        // a wider one, for the resting-hand drift the tight finger threshold
        // could not tell apart from a deliberate move.
        const limit = e.pointerType === 'mouse' ? MOUSE_MOVE_CANCEL_PX : MOVE_CANCEL_PX;
        const dx = e.clientX - pressPos.current.x;
        const dy = e.clientY - pressPos.current.y;
        if (Math.hypot(dx, dy) > limit) {
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
    /**
     * A `last`-tier press usually sits on a text field, where the very same
     * gesture means "select this". The caret moving, or a key going down, is
     * proof of what the user is actually doing — so the pickup is dropped
     * rather than fired out from under a selection.
     */
    const cancelTextPress = () => {
      if (dragRef.current || stashDragRef.current) return;
      if (pressTier.current !== 'last') return;
      clearHoldTimer();
      setPressKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      cancelTextPress();
      if (e.key !== 'Escape') return;
      if (stashDragRef.current) endStashDrag(true);
      else if (dragRef.current) endDrag(true);
    };
    /**
     * Anything scrolling under a pending press kills it. Travel alone is not
     * enough to catch this: once a scroll container claims the gesture it can
     * swallow the pointer stream, and a finger panning a *horizontally*
     * scrollable child — a wide chart, a code block, a table — then sits
     * still enough, in the events we still see, to look exactly like a hold.
     * That is the bug this closes: scrolling a graph sideways must never lift
     * the card it lives in. A scroll anywhere in the tree is proof of a
     * scroll, so this listens in the capture phase (scroll does not bubble).
     *
     * A pickup already deferred for the compact collapse is exempt — see
     * `pendingPickupRef`; that scroll is our own doing.
     */
    const onScrollCancel = () => {
      if (dragRef.current || stashDragRef.current) return;
      if (pendingPickupRef.current !== null) return;
      clearHoldTimer();
      setPressKey(null);
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
    document.addEventListener('selectionchange', cancelTextPress);
    window.addEventListener('scroll', onScrollCancel, true);
    window.addEventListener('wheel', onScrollCancel, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('selectionchange', cancelTextPress);
      window.removeEventListener('scroll', onScrollCancel, true);
      window.removeEventListener('wheel', onScrollCancel);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [pressKey, drag, stashDrag, endDrag, endStashDrag, considerMove, considerStashMove, stashEnabled, byKey, canStash]);

  /* -------------------------------------------------- edit mode (w/ stash) */

  const exitEditMode = useCallback(() => {
    clearHoldTimer();
    setPressKey(null);
    setEditMode(false);
    setCompact(false);
    onEditEnd?.();
  }, [onEditEnd]);
  /** Readable from the click listener, which is mounted once and never re-armed. */
  const exitEditModeRef = useRef(exitEditMode);
  exitEditModeRef.current = exitEditMode;

  // Dismissal by a tap *outside* the group and its stash, or by Escape when
  // nothing is in flight. (A tap *inside* dismisses too — that path is the
  // click listener further down, which also has to swallow the activation.)
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
      if (e.key !== 'Escape' || dragRef.current || stashDragRef.current) return;
      // An inline editor owns Escape: it reverts its own row. Tearing the
      // whole mode down from under it would undo far more than was asked.
      // (Freeform's inputs also stop the event, so this is the belt to that
      // brace — it covers a caller's own field inside an item.)
      if (isTextEntry(e.target)) return;
      exitEditMode();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [activeEdit, exitEditMode]);

  // Keep the popover glued to the group across scrolls and resizes. The bump on
  // entering edit mode is the one that matters for placement: the first frame
  // renders before the popover exists, so its size — and with it the decision
  // to flip to the other side — can only be read on the second.
  useEffect(() => {
    if (!activeEdit) return;
    const bump = () => setAnchorTick((t) => t + 1);
    bump();
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

  /**
   * A hold-then-release still fires a click on whatever was under the pointer.
   * These items are usually links or buttons, so swallow the click that closes
   * a drag — reordering the navbar must not also navigate.
   *
   * In persistent edit mode a tap on an item is swallowed too (it must not
   * activate what it hits) **and it leaves edit mode**. iOS's jiggle mode makes
   * a tap do nothing at all, which reads as the UI having gone dead: the only
   * ways out are a tap on empty space or Escape, and on a group that fills the
   * screen there is no empty space to find. Treating the tap as "I'm done"
   * gives the mode the obvious exit its own surface was missing.
   *
   * Two exceptions, both about staying in the mode you are working in: taps
   * inside the stash popover (picking a benched item back up is edit-mode
   * work), and taps on the opted-out sub-trees — a freeform row's text input
   * or its × — which keep their clicks and must not tear the mode down.
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const recent = Date.now() - droppedAt.current <= CLICK_SUPPRESS_MS;
      const t = e.target as Element | null;
      const inContainer = !!t && (containerRef.current?.contains(t) ?? false);
      const inStash = !!t && (stashRef.current?.contains(t) ?? false);
      const clickThrough = !!t?.closest?.(CLICK_THROUGH_SELECTOR);
      const editingTap = editModeRef.current && (inContainer || inStash) && !clickThrough;
      if (!recent && !editingTap) return;
      droppedAt.current = 0;
      e.preventDefault();
      e.stopPropagation();
      if (editingTap && inContainer) exitEditModeRef.current?.();
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
  // Its own measured size, for the edge flip in `stashPositionStyle`. Read from
  // the ref (not state) on the same tick as the anchor, so a scroll re-anchors
  // and re-decides the side together; the first frame has no ref yet and simply
  // renders on the requested side.
  const stashSize = showStash && stashRef.current ? rectOf(stashRef.current) : null;

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
                // touch, which would fight the pickup — and on a link it pops
                // early enough to cancel the touch outright, which is exactly
                // why the link tier exists. An armed press counts (`pressing`),
                // so the callout is already gone by the time it would appear.
                // A `never` sub-tree keeps its menu: that is the escape hatch.
                if (holdTierOf(e.target as Element | null) === 'never') return;
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
                            transition: `transform ${pressDelay}ms cubic-bezier(0.4, 0, 0.6, 1)`,
                          }
                        : { transition: 'transform 140ms ease-out' }
                }
              >
                {compact && freeform ? (
                  <FreeformRow
                    text={freeformTextOf(item)}
                    onCommit={(text) => onTextChange?.(item, text)}
                    onRemove={onRemove ? () => onRemove(item) : undefined}
                  />
                ) : compact ? (
                  <CompactRow>{compactLabelOf(item)}</CompactRow>
                ) : (
                  children(
                    item,
                    held
                      ? { held: false, editing: false, pressing: false, index: domIndex, count: list.length }
                      : { held: false, editing, pressing, index, count: list.length },
                  )
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

        {/* The add row rides along with the compact rows — mounted on the same
            commit, so it is already there when the pickup measures the slots
            and can never move one mid-drag. */}
        {compact && freeform && onAdd && (
          <FreeformAddRow placeholder={addPlaceholder} onSubmit={onAdd} />
        )}
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
            {/* The ghost carries the row's *text*: a second live input flying
                around under the finger would steal focus and caret from the
                one still sitting in the list. */}
            {compact ? (
              <CompactRow>
                {freeform ? freeformTextOf(ghostItem) : compactLabelOf(ghostItem)}
              </CompactRow>
            ) : (
              children(ghostItem, {
                held: true,
                editing,
                pressing: false,
                index: ghostKey ? slotIndex(ghostKey) : -1,
                count: list.length,
              })
            )}
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
            style={{
              position: 'fixed',
              zIndex: 90,
              ...stashPositionStyle(stashAnchor, stashPlacement, stashSize ?? undefined),
            }}
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
