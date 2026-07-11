import * as React from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * SSR-safe (`false` on the server, resolved on hydration) and driven by
 * `useSyncExternalStore`, so several components watching the same query share
 * one listener and never tear.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
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
