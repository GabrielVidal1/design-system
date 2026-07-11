import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import type { GuidelineTag } from './types';

const MAX_MATCHES = 8;
const TOKEN_CHAR = /[\w.-]/;

export function tagSlug(tag: GuidelineTag): string {
  return tag.slug ?? tag.id;
}

/** Detect a `<prefix><token>` under the caret, at a word boundary. */
function activeMention(text: string, caret: number, prefix: string): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0 && TOKEN_CHAR.test(text[i])) i--;
  if (i < 0 || text[i] !== prefix) return null;
  if (i > 0 && !/\s/.test(text[i - 1])) return null; // must follow whitespace / line start
  return { start: i, query: text.slice(i + 1, caret) };
}

export interface MentionApi {
  open: boolean;
  matches: GuidelineTag[];
  active: number;
  query: string | null;
  setActive: (i: number) => void;
  pick: (tag: GuidelineTag) => void;
  /** Handle a key while the menu is open; returns true if it consumed the key. */
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Keep the caret position in sync (call from onSelect / onChange). */
  syncCaret: () => void;
}

export function useMention({
  tags,
  value,
  setValue,
  taRef,
  prefix,
  onPick,
}: {
  tags: GuidelineTag[];
  value: string;
  setValue: (v: string) => void;
  taRef: RefObject<HTMLTextAreaElement | null>;
  prefix: string;
  onPick: (tag: GuidelineTag) => void;
}): MentionApi {
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const dismissed = useRef<string | null>(null);

  const mention = activeMention(value, caret, prefix);
  const query = mention?.query ?? null;

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return tags
      .filter((t) => {
        const slug = tagSlug(t).toLowerCase();
        return slug.startsWith(q) || t.label.toLowerCase().includes(q);
      })
      .slice(0, MAX_MATCHES);
  }, [tags, query]);

  const open = query !== null && dismissed.current !== query && matches.length > 0;

  const syncCaret = useCallback(() => {
    const el = taRef.current;
    if (el) setCaret(el.selectionStart ?? 0);
  }, [taRef]);

  const pick = useCallback(
    (tag: GuidelineTag) => {
      if (!mention) return;
      const slug = tagSlug(tag);
      const next = `${value.slice(0, mention.start)}${prefix}${slug} ${value.slice(caret)}`;
      const pos = mention.start + slug.length + prefix.length + 1;
      setValue(next);
      onPick(tag);
      setActive(0);
      dismissed.current = null;
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (!el) return;
        el.setSelectionRange(pos, pos);
        setCaret(pos);
      });
    },
    [mention, value, caret, prefix, setValue, onPick, taRef],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (i + d + matches.length) % matches.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(matches[Math.min(active, matches.length - 1)]);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissed.current = query;
        return true;
      }
      return false;
    },
    [open, matches, active, pick, query],
  );

  return { open, matches, active, query, setActive, pick, onKeyDown, syncCaret };
}
