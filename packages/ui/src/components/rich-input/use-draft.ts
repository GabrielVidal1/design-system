import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'rich-input:draft:';
const DEFAULT_DEBOUNCE_MS = 250;

type Where = 'local' | 'session';

/** What the live (auto-persisted) draft remembers besides the text. */
export interface DraftMeta {
  /** Ids of the tags (guidelines, projects, …) selected with the draft. */
  tags: string[];
  /** State of the guidelines master switch, when the composer shows one. */
  guidelinesOn?: boolean;
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
      const obj = JSON.parse(raw) as { text?: unknown; tags?: unknown; guidelinesOn?: unknown };
      if (typeof obj === 'object' && obj !== null) {
        return {
          text: typeof obj.text === 'string' ? obj.text : '',
          meta: Array.isArray(obj.tags)
            ? {
                tags: obj.tags.filter((t): t is string => typeof t === 'string'),
                ...(typeof obj.guidelinesOn === 'boolean' ? { guidelinesOn: obj.guidelinesOn } : {}),
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
 * (selected tag ids, guideline switch). Stored as one JSON record under
 * `rich-input:draft:<key>`; legacy plain-string drafts are still read. When
 * `key` is falsy the value is kept purely in memory. An empty draft removes
 * the stored key; changing `key` re-loads its draft.
 */
export function useDraft(
  key: string | null | undefined,
  where: Where = 'local',
  debounceMs = DEFAULT_DEBOUNCE_MS,
): Draft {
  const storageKey = key ? PREFIX + key : null;
  const [{ text, meta }, setState] = useState(() => read(storageKey, where));

  // Re-load when the key changes (reset during render, no effect flash).
  const prevKey = useRef(storageKey);
  if (prevKey.current !== storageKey) {
    prevKey.current = storageKey;
    setState(read(storageKey, where));
  }

  useEffect(() => {
    if (!storageKey) return;
    const s = store(where);
    if (!s) return;
    const t = window.setTimeout(() => {
      try {
        if (text || meta) s.setItem(storageKey, JSON.stringify({ text, ...(meta ?? {}) }));
        else s.removeItem(storageKey);
      } catch {
        /* best-effort */
      }
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [text, meta, storageKey, where, debounceMs]);

  const setText = useCallback((v: string) => setState((p) => ({ ...p, text: v })), []);
  const setMeta = useCallback((m: DraftMeta | null) => setState((p) => ({ ...p, meta: m })), []);

  const clear = useCallback(() => {
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
