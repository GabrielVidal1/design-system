import * as React from 'react';

/** The environments without `matchMedia` — the server, and test DOMs that don't
 *  implement it. Both answer "no query matches", which is the safe default: a
 *  responsive layout falls back to its base (smallest) breakpoint. */
function mql(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

/**
 * Subscribe to a CSS media query.
 *
 * SSR-safe (`false` on the server, resolved on hydration) and driven by
 * `useSyncExternalStore`, so several components watching the same query share
 * one listener and never tear. Degrades to `false` where `matchMedia` doesn't
 * exist at all, rather than throwing.
 *
 * @summary Subscribe to any media query.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const m = mql(query);
      if (!m) return () => {};
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => mql(query)?.matches ?? false,
    () => false,
  );
}

/** True below the `md` breakpoint (768px) — the phone/desktop split.
 *
 * @summary True on phone-sized viewports — the mobile/desktop branch used
 * across the library.
 */
export function useIsMobile(breakpoint = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

/** True on a coarse pointer (finger) — use for tap targets, not for width.
 *
 * @summary True when the primary input is touch.
 */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** The OS colour-scheme preference. See `useTheme` for the resolved theme.
 *
 * @summary The OS dark-mode preference.
 */
export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/** True when the user asked for less motion — gate animations on it.
 *
 * @summary The OS reduced-motion preference — gate animations on it.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
