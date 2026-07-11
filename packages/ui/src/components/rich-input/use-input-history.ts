import { useCallback, useMemo, useRef, useState } from 'react';

const PREFIX = 'rich-input:history:';
const DEFAULT_MAX = 100;

function load(key: string | null): string[] {
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(key: string | null, entries: string[]) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* best-effort */
  }
}

export interface InputHistory {
  /** Newest-last list of past submissions. */
  entries: string[];
  /** Record a value (skips blanks and consecutive duplicates). */
  push: (value: string) => void;
  /** Move to an older entry. `draft` is stashed the first time. */
  prev: (draft: string) => string | null;
  /** Move to a newer entry, or back to the stashed draft at the end. */
  next: () => string | null;
  /** Whether the cursor is currently browsing history (not on the draft). */
  browsing: boolean;
  /** Drop the cursor back to the draft (call when the user edits manually). */
  resetCursor: () => void;
  /** Newest-first match for a reverse (Ctrl+R) search; `bump` cycles matches. */
  reverseSearch: (query: string, bump?: boolean) => string | null;
  /** Reset the reverse-search cursor. */
  resetSearch: () => void;
  clear: () => void;
}

/** A shell-style command history for the composer. */
export function useInputHistory(cacheKey: string | null | undefined, max = DEFAULT_MAX): InputHistory {
  const storageKey = cacheKey ? PREFIX + cacheKey : null;
  const [entries, setEntries] = useState<string[]>(() => load(storageKey));

  // Reload if the key changed.
  const prevKey = useRef(storageKey);
  if (prevKey.current !== storageKey) {
    prevKey.current = storageKey;
    setEntries(load(storageKey));
  }

  const cursor = useRef<number>(entries.length); // === length → on the draft
  const stash = useRef<string>('');
  const search = useRef<number>(-1); // match index for reverse search

  const push = useCallback(
    (value: string) => {
      const v = value.trim();
      cursor.current = entries.length; // logical reset; recomputed below on set
      if (!v) return;
      setEntries((prev) => {
        if (prev[prev.length - 1] === v) {
          cursor.current = prev.length;
          return prev;
        }
        const next = [...prev.filter((e) => e !== v), v].slice(-max);
        cursor.current = next.length;
        save(storageKey, next);
        return next;
      });
    },
    [entries.length, max, storageKey],
  );

  const prev = useCallback(
    (draft: string): string | null => {
      if (entries.length === 0) return null;
      if (cursor.current >= entries.length) {
        stash.current = draft; // leaving the draft
        cursor.current = entries.length - 1;
      } else if (cursor.current > 0) {
        cursor.current -= 1;
      }
      return entries[cursor.current] ?? null;
    },
    [entries],
  );

  const next = useCallback((): string | null => {
    if (cursor.current >= entries.length) return null; // already on the draft
    cursor.current += 1;
    if (cursor.current >= entries.length) return stash.current;
    return entries[cursor.current] ?? null;
  }, [entries]);

  const resetCursor = useCallback(() => {
    cursor.current = entries.length;
  }, [entries.length]);

  const reverseSearch = useCallback(
    (query: string, bump = false): string | null => {
      const q = query.trim().toLowerCase();
      if (!q) return null;
      // Newest-first list of matches.
      const matches: string[] = [];
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].toLowerCase().includes(q)) matches.push(entries[i]);
      }
      if (matches.length === 0) return null;
      if (bump) search.current = (search.current + 1) % matches.length;
      else if (search.current < 0 || search.current >= matches.length) search.current = 0;
      return matches[search.current];
    },
    [entries],
  );

  const resetSearch = useCallback(() => {
    search.current = -1;
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    cursor.current = 0;
    save(storageKey, []);
  }, [storageKey]);

  const browsing = cursor.current < entries.length;

  return useMemo(
    () => ({ entries, push, prev, next, browsing, resetCursor, reverseSearch, resetSearch, clear }),
    [entries, push, prev, next, browsing, resetCursor, reverseSearch, resetSearch, clear],
  );
}
