import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'rich-input:draft:';
const DEFAULT_DEBOUNCE_MS = 250;

type Where = 'local' | 'session';

function store(where: Where): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return where === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string | null, where: Where): string {
  const s = key ? store(where) : null;
  if (!s || !key) return '';
  try {
    return s.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/**
 * A debounced, storage-backed draft. Returns `[value, setValue, clear]`. When
 * `key` is falsy the value is kept purely in memory. An empty value removes the
 * stored key; changing `key` re-loads its draft.
 */
export function useDraft(
  key: string | null | undefined,
  where: Where = 'local',
  debounceMs = DEFAULT_DEBOUNCE_MS,
): readonly [string, (v: string) => void, () => void] {
  const storageKey = key ? PREFIX + key : null;
  const [value, setValue] = useState<string>(() => read(storageKey, where));

  // Re-load when the key changes (reset during render, no effect flash).
  const prevKey = useRef(storageKey);
  if (prevKey.current !== storageKey) {
    prevKey.current = storageKey;
    setValue(read(storageKey, where));
  }

  useEffect(() => {
    if (!storageKey) return;
    const s = store(where);
    if (!s) return;
    const t = window.setTimeout(() => {
      try {
        if (value) s.setItem(storageKey, value);
        else s.removeItem(storageKey);
      } catch {
        /* best-effort */
      }
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [value, storageKey, where, debounceMs]);

  const clear = useCallback(() => {
    setValue('');
    if (!storageKey) return;
    try {
      store(where)?.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey, where]);

  return [value, setValue, clear] as const;
}
