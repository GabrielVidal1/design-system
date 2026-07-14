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

/** True below the `md` breakpoint (768px) — the phone/desktop split. */
export function useIsMobile(breakpoint = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

/** True on a coarse pointer (finger) — use for tap targets, not for width. */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** The OS colour-scheme preference. See `useTheme` for the resolved theme. */
export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/** True when the user asked for less motion — gate animations on it. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
