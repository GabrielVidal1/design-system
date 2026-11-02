import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

/**
 * The composer's motion — "make room, then enter". Nothing on the composer
 * snaps into place: a row that appears first opens its room (the content
 * below glides down), then its pills pop in from 40 % with a small overshoot;
 * a pill that goes shrinks out, then its neighbours glide into the gap.
 *
 * Plain Web Animations on DOM nodes: React renders the final layout and the
 * animations only interpolate towards it. Everything skips itself when the
 * composer's `motion` prop is off, under `prefers-reduced-motion`, in a
 * background tab, and where there is no `Element.animate` (jsdom).
 */

export const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
export const EASE_IN = 'cubic-bezier(.55,0,.75,.2)';
/** Room: a row opening from 0 to its height. */
export const ROOM_MS = 240;
/** A pill popping in. */
export const POP_MS = 320;
/** Between two pills of a cascade. */
export const STAGGER_MS = 25;
/** A pill shrinking out, before its gap closes. */
export const EXIT_MS = 180;
/** Neighbours gliding to their new place. */
export const GLIDE_MS = 300;

const POP: Keyframe[] = [
  { transform: 'scale(.4)', opacity: 0 },
  { transform: 'scale(1.08)', opacity: 1, offset: 0.6 },
  { transform: 'scale(1)', opacity: 1 },
];

/** Whether anything may move right now (the caller's switch aside). */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return false;
  if (document.visibilityState === 'hidden') return false;
  return !(
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A pill arriving: pops up from 40 % with a small overshoot. */
export function popIn(el: Element, delay = 0): Animation {
  return el.animate(POP, { duration: POP_MS, delay, easing: 'ease-out', fill: 'backwards' });
}

/** A control arriving in the toolbar: rises from the row's bottom edge. */
export function riseIn(el: Element, delay = 0): Animation {
  return el.animate(
    [
      { transform: 'translateY(10px)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: POP_MS, delay, easing: EASE_OUT, fill: 'backwards' },
  );
}

/**
 * A row appearing: its room opens (height 0 → its own, pushing what is below
 * down), then its `items` pop in one after the other. The items are held
 * invisible while the room opens.
 */
export function openRoom(row: HTMLElement, items: Element[]): void {
  const h = row.offsetHeight;
  if (h === 0) return;
  const hide = items.map((el) =>
    el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: ROOM_MS, fill: 'forwards' }),
  );
  row.style.overflow = 'hidden';
  const room = row.animate([{ height: '0px' }, { height: `${h}px` }], {
    duration: ROOM_MS,
    easing: EASE_OUT,
  });
  const done = () => {
    row.style.overflow = '';
    hide.forEach((a) => a.cancel());
  };
  room.finished.then(
    () => {
      done();
      items.forEach((el, i) => popIn(el, i * STAGGER_MS));
    },
    done,
  );
}

/** A row going: its content fades as its room closes. Leaves it at 0 height
 * (`fill: forwards`) for the caller to unmount. */
export function foldRoom(row: HTMLElement): Animation {
  row.style.overflow = 'hidden';
  return row.animate(
    [
      { height: `${row.offsetHeight}px`, opacity: 1 },
      { height: '0px', opacity: 0 },
    ],
    { duration: ROOM_MS, easing: EASE_OUT, fill: 'forwards' },
  );
}

/** The animated children of `box`, by key: its `[data-motion-key]` nodes. */
function keyedChildren(box: HTMLElement): [string, HTMLElement][] {
  return [...box.querySelectorAll<HTMLElement>('[data-motion-key]')].map((k) => [k.dataset.motionKey!, k]);
}

/** Where a child sat at the last commit, and what to rebuild its exit from. */
interface Place {
  /** Its layout offset from its parent — not its screen position, which moves
   * when the whole row does (the textarea above growing a line) and includes
   * a glide still in flight. */
  x: number;
  y: number;
  /** Its own offset and size, where its ghost goes if it leaves. */
  left: number;
  top: number;
  width: number;
  height: number;
  el: HTMLElement;
  parent: HTMLElement | null;
}

function placeOf(k: HTMLElement): Place {
  const p = k.parentElement;
  const rel = !p || k.offsetParent === p;
  return {
    x: rel ? k.offsetLeft : k.offsetLeft - p.offsetLeft,
    y: rel ? k.offsetTop : k.offsetTop - p.offsetTop,
    left: k.offsetLeft,
    top: k.offsetTop,
    width: k.offsetWidth,
    height: k.offsetHeight,
    el: k,
    parent: p,
  };
}

/**
 * A child React has already removed, shrinking out where it stood: a copy of
 * its last node, laid back into its parent (out of the flow, inert, stripped
 * of the attributes that would make it count as a row item).
 */
function shrinkGhost(place: Place): boolean {
  const { el, parent } = place;
  if (el.isConnected || !parent?.isConnected || place.width === 0) return false;
  const ghost = el.cloneNode(true) as HTMLElement;
  for (const n of [ghost, ...ghost.querySelectorAll('*')]) {
    for (const a of [...n.attributes]) {
      if (a.name === 'id' || a.name.startsWith('data-')) n.removeAttribute(a.name);
    }
  }
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${place.left}px`,
    top: `${place.top}px`,
    width: `${place.width}px`,
    height: `${place.height}px`,
    margin: '0',
    transform: '',
    pointerEvents: 'none',
  });
  parent.appendChild(ghost);
  const out = ghost.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(.4)', opacity: 0 },
    ],
    { duration: EXIT_MS, easing: EASE_IN, fill: 'forwards' },
  );
  out.finished.then(
    () => ghost.remove(),
    () => ghost.remove(),
  );
  return true;
}

/**
 * Children of `box` (by `data-motion-key`, or as `collect` lists them) glide
 * from where they were to where this commit put them (FLIP), and the ones that
 * just arrived pop in (or as `enter` animates them). With `ghosts`, one that
 * went shrinks out first, and only then do its neighbours close the gap. With
 * `mount`, the first paint animates its children in too (staggered). Runs
 * after every commit; `on` false only records the places.
 */
export function useFlipPop(
  box: RefObject<HTMLElement | null>,
  on: boolean,
  {
    collect = keyedChildren,
    enter = popIn,
    ghosts = false,
    mount,
  }: {
    collect?: (box: HTMLElement) => [string, HTMLElement][] | null;
    enter?: (el: Element, delay: number) => void;
    ghosts?: boolean;
    mount?: (el: Element, delay: number) => void;
  } = {},
): void {
  const last = useRef<Map<string, Place> | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const el = box.current;
    const kids = el ? collect(el) : null;
    if (!kids) {
      last.current = null;
      return;
    }
    const next = new Map<string, Place>();
    for (const [key, k] of kids) next.set(key, placeOf(k));
    const prev = last.current;
    last.current = next;
    const moving = on && motionAllowed();
    if (!prev) {
      // The first paint of the box just shows what it has — unless `mount`
      // asks for an entrance.
      if (!mounted.current && mount && moving) {
        kids.filter(([, k]) => k.offsetWidth > 0).forEach(([, k], i) => mount(k, i * STAGGER_MS));
      }
      mounted.current = true;
      return;
    }
    if (!moving) return;
    let gone = false;
    if (ghosts) {
      for (const [key, place] of prev) if (!next.has(key) && shrinkGhost(place)) gone = true;
    }
    let fresh = 0;
    for (const [key, k] of kids) {
      if (k.dataset.motionLeaving != null) continue;
      const was = prev.get(key);
      const now = next.get(key)!;
      if (!was) {
        enter(k, fresh++ * STAGGER_MS);
        continue;
      }
      const dx = was.x - now.x;
      const dy = was.y - now.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      // Behind a leaver, a neighbour holds its old place until the leaver is gone.
      k.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: GLIDE_MS,
        delay: gone ? EXIT_MS : 0,
        easing: EASE_OUT,
        fill: 'backwards',
      });
    }
  });
}

/** One entry of a {@link usePresence} list. */
export interface PresenceEntry<T> {
  key: string;
  item: T;
  /** On its way out: render it (marked `data-motion-leaving`), then it goes. */
  leaving: boolean;
}

/**
 * A keyed list that keeps a removed item on screen while it shrinks out. The
 * leaving entry is derived *during* the render that drops it — in an effect
 * there would be one commit without it, unmounting the node and mounting a
 * fresh copy for the exit. `exited(key)` drops it once its exit is over;
 * {@link usePopOut} plays that exit.
 */
export function usePresence<T>(items: T[], getKey: (item: T) => string, on: boolean) {
  const [track, setTrack] = useState<{ items: T[]; leaving: Map<string, { item: T; index: number }> }>(
    () => ({ items, leaving: new Map() }),
  );
  let leaving = track.leaving;
  if (track.items !== items) {
    const now = new Set(items.map(getKey));
    const n = new Map(leaving);
    for (const k of n.keys()) if (now.has(k)) n.delete(k);
    if (on && motionAllowed()) {
      track.items.forEach((item, index) => {
        const k = getKey(item);
        if (!now.has(k)) n.set(k, { item, index });
      });
    }
    leaving = n;
    setTrack({ items, leaving });
  }

  const entries = useMemo(() => {
    const out: PresenceEntry<T>[] = items.map((item) => ({ key: getKey(item), item, leaving: false }));
    for (const [key, { item, index }] of leaving) {
      out.splice(Math.min(index, out.length), 0, { key, item, leaving: true });
    }
    return out;
    // getKey is stable for a given list; items/leaving drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, leaving]);

  const exited = useCallback((key: string) => {
    setTrack((t) => {
      if (!t.leaving.has(key)) return t;
      const n = new Map(t.leaving);
      n.delete(key);
      return { ...t, leaving: n };
    });
  }, []);

  return { entries, exited };
}

/**
 * Plays the exit of every `[data-motion-leaving]` child of `box` that isn't
 * already going: it shrinks out, then `exited(key)` drops it (its neighbours
 * then glide into the gap through {@link useFlipPop}).
 */
export function usePopOut(
  box: RefObject<HTMLElement | null>,
  exited: (key: string) => void,
  deps: unknown,
): void {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    // Came back before it was gone: it stays, whole again.
    for (const k of el.querySelectorAll<HTMLElement>('[data-motion-going]:not([data-motion-leaving])')) {
      delete k.dataset.motionGoing;
      k.getAnimations().forEach((a) => a.cancel());
    }
    for (const k of el.querySelectorAll<HTMLElement>('[data-motion-leaving]')) {
      if (k.dataset.motionGoing != null) continue;
      k.dataset.motionGoing = '';
      const key = k.dataset.motionKey!;
      const out = k.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(.4)', opacity: 0 },
        ],
        { duration: EXIT_MS, easing: EASE_IN, fill: 'forwards' },
      );
      out.finished.then(
        () => exited(key),
        () => exited(key),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
}
