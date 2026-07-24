import * as React from 'react';

/**
 * Fire `onIntersect` while a sentinel element is (near) the viewport.
 *
 * The paged-reveal counterpart to `VirtualList`'s `onEndReached`: put the
 * returned ref on a div at the bottom of a plain grid and it loads the next
 * page before the user reaches it (`rootMargin` looks ahead by default).
 *
 * @summary IntersectionObserver as a ref + boolean.
 */
export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  onIntersect: () => void,
  {
    enabled = true,
    rootMargin = '600px',
    threshold = 0,
  }: { enabled?: boolean; rootMargin?: string; threshold?: number } = {},
) {
  const ref = React.useRef<T | null>(null);
  const cb = React.useRef(onIntersect);
  cb.current = onIntersect;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cb.current();
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, rootMargin, threshold]);

  return ref;
}

export interface UseInfiniteScrollOptions {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

/**
 * `useIntersection` wired for pagination: it stops observing once there is
 * nothing more to load, and never re-enters while a page is in flight.
 *
 * @summary Fire a callback when a sentinel scrolls into view.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>({
  hasMore,
  loading = false,
  onLoadMore,
  rootMargin,
}: UseInfiniteScrollOptions) {
  return useIntersection<T>(
    () => {
      if (hasMore && !loading) onLoadMore();
    },
    { enabled: hasMore && !loading, rootMargin },
  );
}
