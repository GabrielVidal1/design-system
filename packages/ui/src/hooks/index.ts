/**
 * The headless half of the library: gestures, storage, media queries,
 * clipboard, intersection — the behaviour without the markup.
 *
 * @summary The headless half of the library — see the Hooks table below.
 */

export { useCopyToClipboard } from './use-copy-to-clipboard';
export type { UseCopyOptions } from './use-copy-to-clipboard';
export { useDebouncedValue } from './use-debounced-value';
export type { UseDebouncedValueOptions } from './use-debounced-value';
export { useInfiniteScroll, useIntersection } from './use-intersection';
export type { UseInfiniteScrollOptions } from './use-intersection';
export { useLocalStorage } from './use-local-storage';
export { useLongPress } from './use-long-press';
export type { LongPressPoint, UseLongPressOptions } from './use-long-press';
export {
  useIsMobile,
  useIsTouch,
  useMediaQuery,
  usePrefersDark,
  usePrefersReducedMotion,
} from './use-media-query';
export { useEscape, useOutsideClick, useScrollLock } from './use-overlay';
