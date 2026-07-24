import * as React from 'react';

/**
 * `useState` backed by `localStorage` (or `sessionStorage`).
 *
 * Reads once on mount, writes on every change, and swallows quota/private-mode
 * errors so a full disk can never crash the app. Tabs stay in sync: a `storage`
 * event from another tab, or a write from another hook instance on the same
 * key, updates every subscriber.
 *
 * @summary State persisted to localStorage, synced across tabs.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  { session = false }: { session?: boolean } = {},
): [T, (value: T | ((prev: T) => T)) => void] {
  const store = () =>
    typeof window === 'undefined' ? null : session ? window.sessionStorage : window.localStorage;

  const read = React.useCallback((): T => {
    try {
      const raw = store()?.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
    // `initial` is intentionally not a dep: it is the mount-time default only.
  }, [key, session]);

  const [value, setValue] = React.useState<T>(read);

  // A key change (or a cross-tab write) re-reads from storage.
  React.useEffect(() => {
    setValue(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) setValue(read());
    };
    const onLocal = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(read());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SYNC_EVENT, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SYNC_EVENT, onLocal);
    };
  }, [key, read]);

  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          store()?.setItem(key, JSON.stringify(resolved));
          window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: key }));
        } catch {
          /* quota exceeded / storage disabled — keep the in-memory value */
        }
        return resolved;
      });
    },
    [key, session],
  );

  return [value, set];
}

const SYNC_EVENT = 'gabvdl-ui:storage';
