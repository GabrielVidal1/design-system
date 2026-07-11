import * as React from 'react';

/**
 * Lock body scroll while `active`.
 *
 * Reference-counted, so nesting a modal inside a viewer (or opening two at
 * once) doesn't unlock the page when only the inner one closes. Compensates for
 * the scrollbar width so the page doesn't jump on lock.
 */
export function useScrollLock(active = true) {
  React.useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const body = document.body;

    if (locks === 0) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      body.style.overflow = 'hidden';
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    locks += 1;

    return () => {
      locks -= 1;
      if (locks === 0 && previous) {
        body.style.overflow = previous.overflow;
        body.style.paddingRight = previous.paddingRight;
        previous = null;
      }
    };
  }, [active]);
}

let locks = 0;
let previous: { overflow: string; paddingRight: string } | null = null;

/** Call `onEscape` when Escape is pressed (while `active`). */
export function useEscape(onEscape: () => void, active = true) {
  const cb = React.useRef(onEscape);
  cb.current = onEscape;

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

/**
 * Close when a click (or focus) lands outside the referenced element.
 *
 * Listens on `pointerdown` so the menu closes before the click resolves — the
 * behaviour every hand-rolled popover forgets, which is why a click on a link
 * behind an open dropdown otherwise gets eaten.
 */
export function useOutsideClick<T extends HTMLElement = HTMLElement>(
  onOutside: () => void,
  active = true,
) {
  const ref = React.useRef<T | null>(null);
  const cb = React.useRef(onOutside);
  cb.current = onOutside;

  React.useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as globalThis.Node)) cb.current();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active]);

  return ref;
}
