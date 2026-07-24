import { useEffect, useRef, useState } from 'react';

export interface UseDebouncedValueOptions {
  /**
   * Skip the delay when the value becomes "empty" (empty string / null /
   * undefined / empty array), so clearing a search box repaints the full list
   * immediately instead of after the debounce window. Default true.
   */
  leadingOnEmpty?: boolean;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Trail a fast-changing value (a search query, a slider) by `delay` ms so the
 * expensive consumer downstream only sees it once the user pauses.
 *
 * Returns the debounced value plus `pending` — true while the live value has
 * moved on but the debounced one hasn't caught up yet, which is what a search
 * box hangs its spinner on.
 *
 * ```tsx
 * const [debounced, pending] = useDebouncedValue(query, 400);
 * const results = useMemo(() => search(debounced), [debounced]);
 * ```
 *
 * @summary Debounced mirror of a fast-changing value.
 */
export function useDebouncedValue<T>(
  value: T,
  delay = 400,
  { leadingOnEmpty = true }: UseDebouncedValueOptions = {},
): [T, boolean] {
  const [debounced, setDebounced] = useState(value);
  // Keep the latest value in a ref so the flush on unmount/delay-change can't
  // resurrect a stale one.
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (delay <= 0 || (leadingOnEmpty && isEmpty(value))) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(latest.current), delay);
    return () => clearTimeout(t);
  }, [value, delay, leadingOnEmpty]);

  return [debounced, !Object.is(debounced, value)];
}
