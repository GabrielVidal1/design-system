import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'rich-input:draft:';
const DEFAULT_DEBOUNCE_MS = 250;

type Where = 'local' | 'session';

/** What the live (auto-persisted) draft remembers besides the text. */
export interface DraftMeta {
  /** Ids of the tags selected with the draft. */
  tags: string[];
  /** State of the master switch, when the composer shows one. */
  masterOn?: boolean;
}

function store(where: Where): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return where === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** Parse a stored draft — the JSON record, or a legacy plain-string draft. */
function parse(raw: string | null): { text: string; meta: DraftMeta | null } {
  if (!raw) return { text: '', meta: null };
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw) as { text?: unknown; tags?: unknown; masterOn?: unknown };
      if (typeof obj === 'object' && obj !== null) {
        return {
          text: typeof obj.text === 'string' ? obj.text : '',
          meta: Array.isArray(obj.tags)
            ? {
                tags: obj.tags.filter((t): t is string => typeof t === 'string'),
                ...(typeof obj.masterOn === 'boolean' ? { masterOn: obj.masterOn } : {}),
              }
            : null,
        };
      }
    } catch {
      /* fall through to the legacy read */
    }
  }
  return { text: raw, meta: null };
}

function write(key: string, text: string, meta: DraftMeta | null, where: Where) {
  const s = store(where);
  if (!s) return;
  try {
    if (text || meta) s.setItem(key, JSON.stringify({ text, ...(meta ?? {}) }));
    else s.removeItem(key);
  } catch {
    /* best-effort */
  }
}

function read(key: string | null, where: Where): { text: string; meta: DraftMeta | null } {
  const s = key ? store(where) : null;
  if (!s || !key) return { text: '', meta: null };
  try {
    return parse(s.getItem(key));
  } catch {
    return { text: '', meta: null };
  }
}

export interface Draft {
  /** The draft text (live, un-debounced). */
  text: string;
  setText: (v: string) => void;
  /** Tag selection & switches saved with the draft (null until first persisted). */
  meta: DraftMeta | null;
  setMeta: (meta: DraftMeta | null) => void;
  /** Drop the draft — text, meta and the stored record. */
  clear: () => void;
}

/**
 * A debounced, storage-backed draft: the composer text plus {@link DraftMeta}
 * (selected tag ids, master switch). Stored as one JSON record under
 * `rich-input:draft:<key>`; legacy plain-string drafts are still read. When
 * `key` is falsy the value is kept purely in memory. An empty draft removes
 * the stored key; changing `key` re-loads its draft.
 *
 * The debounce never drops a keystroke: what it still owes is written at once
 * when `key` changes (a composer reused for another conversation), when the
 * composer unmounts, and when the page goes away (`pagehide` — a reload, a
 * closed tab, a phone backgrounding the app).
 */
export function useDraft(
  key: string | null | undefined,
  where: Where = 'local',
  debounceMs = DEFAULT_DEBOUNCE_MS,
): Draft {
  const storageKey = key ? PREFIX + key : null;
  const [{ text, meta }, setState] = useState(() => read(storageKey, where));
  // The write the debounce still owes — for the key it was typed under.
  const owed = useRef<{ key: string; text: string; meta: DraftMeta | null } | null>(null);

  // Re-load when the key changes (reset during render, no effect flash).
  const prevKey = useRef(storageKey);
  if (prevKey.current !== storageKey) {
    prevKey.current = storageKey;
    setState(read(storageKey, where));
  }

  const pay = useCallback(() => {
    const w = owed.current;
    owed.current = null;
    if (w) write(w.key, w.text, w.meta, where);
  }, [where]);

  useEffect(() => {
    // The key changed under a pending write: that one is the old key's.
    if (owed.current && owed.current.key !== storageKey) pay();
    if (!storageKey) return;
    owed.current = { key: storageKey, text, meta };
    const t = window.setTimeout(pay, debounceMs);
    return () => window.clearTimeout(t);
  }, [text, meta, storageKey, debounceMs, pay]);

  useEffect(() => {
    window.addEventListener('pagehide', pay);
    return () => {
      window.removeEventListener('pagehide', pay);
      pay(); // unmount
    };
  }, [pay]);

  const setText = useCallback((v: string) => setState((p) => ({ ...p, text: v })), []);
  const setMeta = useCallback((m: DraftMeta | null) => setState((p) => ({ ...p, meta: m })), []);

  const clear = useCallback(() => {
    owed.current = null; // nothing typed before the clear may come back
    setState({ text: '', meta: null });
    if (!storageKey) return;
    try {
      store(where)?.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey, where]);

  return { text, setText, meta, setMeta, clear };
}
