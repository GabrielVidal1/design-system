import * as React from 'react';

import { parseElement } from './parse';
import type { PickedElement } from './types';

/** Stable ids, so re-picking the same node doesn't churn React keys. */
const IDS = new WeakMap<HTMLElement, string>();
let seq = 0;
const idOf = (el: HTMLElement) => {
  let id = IDS.get(el);
  if (!id) {
    id = `el-${++seq}`;
    IDS.set(el, id);
  }
  return id;
};

export interface UseElementPickerOptions {
  /** The subtree you can pick from. Defaults to `document.body`. */
  root?: HTMLElement | null;
  /** Keep picking after the first hit. Default true. */
  multiple?: boolean;
  /** Controlled selection. */
  value?: PickedElement[];
  defaultValue?: PickedElement[];
  /** Called with the full selection whenever it changes. */
  onValueChange?: (picked: PickedElement[]) => void;
  /** @deprecated Use `onValueChange`. */
  onChange?: (picked: PickedElement[]) => void;
  onPick?: (picked: PickedElement) => void;
  /** Controlled picking mode. */
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
  /**
   * Which elements may be picked. When an element fails, the picker walks up to
   * the nearest ancestor that passes — so `(el) => el.matches('.card')` turns it
   * into a card picker, however deep the pointer actually lands.
   */
  filter?: (el: HTMLElement) => boolean;
  /** Subtrees the picker won't look at — your own toolbar, typically. */
  ignoreSelector?: string;
  /** Override which computed properties get captured. */
  styleProps?: string[];
  /** Touch: how long to hold before hover mode engages, in ms. Default 350. */
  holdDelay?: number;
  /** Touch: movement (px) that reads as a scroll and cancels the hold. Default 12. */
  moveTolerance?: number;
  /** Cap the selection. Picking past it drops the oldest. */
  max?: number;
}

export interface UseElementPickerResult {
  active: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** What the pointer is over right now — the live preview target. */
  hovered: HTMLElement | null;
  /** True while a touch hold has engaged hover mode. */
  holding: boolean;
  picked: PickedElement[];
  pick: (el: HTMLElement) => void;
  remove: (id: string) => void;
  clear: () => void;
  isPicked: (el: HTMLElement) => boolean;
  root: HTMLElement | null;
  /** Put this on any UI of your own that must stay clickable while picking. */
  ignoreProps: Record<string, string>;
}

const IGNORE_ATTR = 'data-element-picker-ignore';

/** How long after a touch pick a click is still assumed to be its replay. */
const COMPAT_CLICK_MS = 700;

/**
 * The machinery behind {@link ElementPicker}: hover tracking, click-to-select,
 * and the press-and-hold gesture that turns a touchscreen — which has no hover
 * — into one. Use it directly when you want the behaviour without the overlay.
 */
export function useElementPicker(options: UseElementPickerOptions = {}): UseElementPickerResult {
  const {
    root: rootProp,
    multiple = true,
    value,
    defaultValue = [],
    onValueChange,
    onChange,
    onPick,
    active: activeProp,
    onActiveChange,
    filter,
    ignoreSelector = `[${IGNORE_ATTR}]`,
    styleProps,
    holdDelay = 350,
    moveTolerance = 12,
    max,
  } = options;

  // The deprecated `onChange` alias still fires; `onValueChange` wins when both are given.
  const handleValueChange = onValueChange ?? onChange;

  const [activeState, setActiveState] = React.useState(false);
  const active = activeProp ?? activeState;

  const [pickedState, setPickedState] = React.useState<PickedElement[]>(defaultValue);
  const picked = value ?? pickedState;

  const [hovered, setHoveredState] = React.useState<HTMLElement | null>(null);
  const [holding, setHolding] = React.useState(false);
  const [root, setRoot] = React.useState<HTMLElement | null>(null);

  // Mirrored into a ref so the listeners below can read the hover without being
  // torn down and rebound on every pointer move.
  const hoveredRef = React.useRef<HTMLElement | null>(null);
  const setHovered = React.useCallback((el: HTMLElement | null) => {
    hoveredRef.current = el;
    setHoveredState((prev) => (prev === el ? prev : el));
  }, []);

  // Latest props, read from listeners that are only bound once per activation.
  // `controlled` lives here too so `commit` — and therefore `pick`, and
  // therefore the listener effect — stays referentially stable across a pick.
  const latest = React.useRef({
    picked,
    multiple,
    max,
    filter,
    ignoreSelector,
    styleProps,
    onValueChange: handleValueChange,
    onPick,
    root,
    controlled: value !== undefined,
    stop: () => {},
  });
  latest.current = {
    ...latest.current,
    picked,
    multiple,
    max,
    filter,
    ignoreSelector,
    styleProps,
    onValueChange: handleValueChange,
    onPick,
    root,
    controlled: value !== undefined,
  };

  /**
   * Gesture state, held across effect re-binds. It cannot live inside the
   * effect: a pick changes `picked`, which can re-run the effect *between* a
   * touch's pointerup and the compatibility click it triggers — and a fresh
   * object there would lose the very stamp that click has to be checked against.
   */
  const gesture = React.useRef({
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    from: null as { x: number; y: number } | null,
    on: false,
    /**
     * When a touch ends in a pick, the browser replays it as a compatibility
     * mouse sequence — pointerdown, mousedown, mouseup, *click* — on the same
     * spot. That click would pick the element a second time, and a second pick
     * is a deselect, so the tap would appear to do nothing at all. We stamp the
     * pick and ignore any click landing in its wake. A stamp rather than a flag
     * because the replay isn't guaranteed to arrive: a flag left standing would
     * go on to eat somebody's real click.
     */
    pickedAt: 0,
  });

  React.useEffect(() => {
    setRoot(rootProp ?? (typeof document === 'undefined' ? null : document.body));
  }, [rootProp]);

  const setActive = React.useCallback(
    (next: boolean) => {
      if (activeProp === undefined) setActiveState(next);
      onActiveChange?.(next);
    },
    [activeProp, onActiveChange],
  );

  const start = React.useCallback(() => setActive(true), [setActive]);
  const stop = React.useCallback(() => setActive(false), [setActive]);
  const toggle = React.useCallback(() => setActive(!active), [active, setActive]);
  latest.current.stop = stop;

  const commit = React.useCallback((next: PickedElement[]) => {
    if (!latest.current.controlled) setPickedState(next);
    latest.current.onValueChange?.(next);
  }, []);

  const pick = React.useCallback(
    (el: HTMLElement) => {
      const { picked: current, multiple: many, max: cap, styleProps: props, root: base } = latest.current;
      const id = idOf(el);

      // A second click on a selected element unselects it — the only way back
      // out of a mis-pick without leaving the flow.
      if (current.some((p) => p.id === id)) {
        commit(current.filter((p) => p.id !== id));
        return;
      }

      const entry: PickedElement = {
        id,
        element: el,
        info: parseElement(el, { root: base ?? undefined, styleProps: props }),
      };
      let next = many ? [...current, entry] : [entry];
      if (cap && next.length > cap) next = next.slice(next.length - cap);

      commit(next);
      latest.current.onPick?.(entry);
    },
    [commit],
  );

  const remove = React.useCallback(
    (id: string) => commit(latest.current.picked.filter((p) => p.id !== id)),
    [commit],
  );
  const clear = React.useCallback(() => commit([]), [commit]);
  const isPicked = React.useCallback((el: HTMLElement) => picked.some((p) => p.element === el), [picked]);

  /** The pickable element under a viewport point, or null. */
  const resolve = React.useCallback((x: number, y: number): HTMLElement | null => {
    const { root: base, filter: pass, ignoreSelector: ignore } = latest.current;
    if (!base) return null;

    // The overlay is pointer-events:none, so elementFromPoint looks straight
    // through it at the page underneath.
    const hit = base.ownerDocument.elementFromPoint(x, y);
    if (!(hit instanceof HTMLElement)) return null;
    if (ignore && hit.closest(ignore)) return null;
    if (!base.contains(hit) || hit === base) return null;

    if (!pass) return hit;
    // Walk up to the nearest ancestor that passes, but never past the root —
    // the root is the frame, not something you can pick.
    for (let el: HTMLElement | null = hit; el && el !== base; el = el.parentElement) {
      if (pass(el)) return el;
    }
    return null;
  }, []);

  // Picking mode: swallow the page's own pointer handling, track the hover, and
  // take a click as a pick.
  React.useEffect(() => {
    if (!active || !root) return;

    const doc = root.ownerDocument;
    const html = doc.documentElement;
    const held = gesture.current;
    held.timer = undefined;
    held.from = null;
    held.on = false;

    const inIgnored = (target: EventTarget | null) => {
      const { ignoreSelector: ignore } = latest.current;
      return !!(ignore && target instanceof Element && target.closest(ignore));
    };

    const hoverAt = (x: number, y: number) => setHovered(resolve(x, y));

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (held.on) {
          hoverAt(e.clientX, e.clientY);
        } else if (held.from && Math.hypot(e.clientX - held.from.x, e.clientY - held.from.y) > moveTolerance) {
          clearTimeout(held.timer); // they're scrolling, not holding
          held.from = null;
        }
        return;
      }
      hoverAt(e.clientX, e.clientY);
    };

    const endHold = () => {
      clearTimeout(held.timer);
      held.from = null;
      if (held.on) {
        held.on = false;
        setHolding(false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (inIgnored(e.target)) return;

      if (e.pointerType === 'touch') {
        held.from = { x: e.clientX, y: e.clientY };
        held.timer = setTimeout(() => {
          held.on = true;
          held.from = null;
          setHolding(true);
          // A tick of haptics, so the hold registers without looking at the screen.
          navigator.vibrate?.(12);
          hoverAt(e.clientX, e.clientY);
        }, holdDelay);
        return;
      }

      // Mouse: keep the press off the page (no text selection, no drag start).
      e.preventDefault();
      e.stopPropagation();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (inIgnored(e.target)) return;

      if (e.pointerType === 'touch') {
        const wasHolding = held.on;
        endHold();
        // Either way the finger lifts on the element it was previewing: a hold
        // and drag commits what's under it, a plain tap commits what it hit.
        const target = resolve(e.clientX, e.clientY);
        if (target) {
          pick(target);
          held.pickedAt = performance.now();
        }
        if (wasHolding || target) setHovered(null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const onClick = (e: MouseEvent) => {
      if (inIgnored(e.target)) return;
      // Never let the page act on a pick — no navigation, no form submit.
      e.preventDefault();
      e.stopPropagation();
      if (e.detail === 0) return; // synthetic (keyboard) click, not a real one

      // The compatibility click replaying the touch we already picked from.
      if (performance.now() - held.pickedAt < COMPAT_CLICK_MS) return;

      const target = resolve(e.clientX, e.clientY);
      if (target) pick(target);
    };

    const swallow = (e: Event) => {
      if (inIgnored(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    // Non-passive: this is what stops the page scrolling under a held finger.
    const onTouchMove = (e: TouchEvent) => {
      if (!held.on) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) hoverAt(touch.clientX, touch.clientY);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        latest.current.stop();
        return;
      }
      const current = hoveredRef.current;
      if (!current) return;

      // Walk the tree without moving the mouse — the devtools reflex.
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const parent = current.parentElement;
        if (parent && parent !== root.parentElement && root.contains(parent)) setHovered(parent);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const child = current.firstElementChild;
        if (child instanceof HTMLElement) setHovered(child);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(current);
      }
    };

    const opts = { capture: true } as const;
    window.addEventListener('pointermove', onPointerMove, opts);
    window.addEventListener('pointerdown', onPointerDown, opts);
    window.addEventListener('pointerup', onPointerUp, opts);
    window.addEventListener('pointercancel', endHold, opts);
    window.addEventListener('click', onClick, opts);
    window.addEventListener('mousedown', swallow, opts);
    window.addEventListener('mouseup', swallow, opts);
    window.addEventListener('dblclick', swallow, opts);
    window.addEventListener('contextmenu', swallow, opts);
    window.addEventListener('keydown', onKeyDown, opts);
    doc.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });

    const prior = html.style.cssText;
    html.style.cursor = 'crosshair';
    html.style.userSelect = 'none';
    html.style.webkitUserSelect = 'none';
    (html.style as CSSStyleDeclaration & { webkitTouchCallout?: string }).webkitTouchCallout = 'none';

    return () => {
      clearTimeout(held.timer);
      window.removeEventListener('pointermove', onPointerMove, opts);
      window.removeEventListener('pointerdown', onPointerDown, opts);
      window.removeEventListener('pointerup', onPointerUp, opts);
      window.removeEventListener('pointercancel', endHold, opts);
      window.removeEventListener('click', onClick, opts);
      window.removeEventListener('mousedown', swallow, opts);
      window.removeEventListener('mouseup', swallow, opts);
      window.removeEventListener('dblclick', swallow, opts);
      window.removeEventListener('contextmenu', swallow, opts);
      window.removeEventListener('keydown', onKeyDown, opts);
      doc.removeEventListener('touchmove', onTouchMove, { capture: true });
      html.style.cssText = prior;
      setHovered(null);
      setHolding(false);
    };
  }, [active, root, holdDelay, moveTolerance, pick, resolve, setHovered]);

  return {
    active,
    start,
    stop,
    toggle,
    hovered,
    holding,
    picked,
    pick,
    remove,
    clear,
    isPicked,
    root,
    ignoreProps: { [IGNORE_ATTR]: '' },
  };
}
