import * as React from 'react';

import { cn } from '../../lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  /**
   * Persist the input's value under this key so it survives a page reload.
   * The value is restored on mount and written on every change. Works with
   * uncontrolled inputs (restores via `defaultValue`); a controlled `value`
   * is still mirrored to storage on change. Omit to disable caching.
   */
  cacheKey?: string;
  /** Where to cache when `cacheKey` is set. Default: `"local"`. */
  cacheLocation?: 'local' | 'session';
}

/** Resolve the requested Web Storage, tolerating SSR and blocked cookies. */
function getStore(location: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return location === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** A minimal Tailwind text input, styled from the shared design tokens. */
export function Input({
  className,
  type,
  cacheKey,
  cacheLocation = 'local',
  onChange,
  defaultValue,
  ...props
}: InputProps) {
  const store = cacheKey ? getStore(cacheLocation) : null;

  // Read the cached value once, synchronously, so the first render already
  // shows it (avoids a flash of empty input on reload).
  const [cached] = React.useState<string | null>(() => {
    if (!store || !cacheKey) return null;
    try {
      return store.getItem(cacheKey);
    } catch {
      return null;
    }
  });

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (store && cacheKey) {
        try {
          store.setItem(cacheKey, e.target.value);
        } catch {
          /* storage full or unavailable — degrade to a plain input */
        }
      }
      onChange?.(e);
    },
    [store, cacheKey, onChange],
  );

  return (
    <input
      type={type}
      defaultValue={cacheKey ? (cached ?? defaultValue) : defaultValue}
      onChange={cacheKey ? handleChange : onChange}
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}
