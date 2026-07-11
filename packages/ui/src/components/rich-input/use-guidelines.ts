import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { tagGuideline } from './compose';
import type { GuidelineTag } from './types';

export interface Guidelines {
  /** Ids of tags currently on. */
  selected: Set<string>;
  toggle: (id: string) => void;
  setOn: (id: string, on: boolean) => void;
  clear: () => void;
  /** Tags that are active (toggle-on, or mention-picked). */
  active: GuidelineTag[];
  /** Injected guideline lines for the current selection. */
  lines: string[];
  /** Toggle tags (the chip row); mention-only tags are excluded. */
  toggles: GuidelineTag[];
}

function initialSelection(tags: GuidelineTag[]): Set<string> {
  const out = new Set<string>();
  const claimed = new Set<string>();
  for (const t of tags) {
    if ((t.kind ?? 'toggle') !== 'toggle' || !t.defaultOn) continue;
    // At most one default-on tag per exclusive key — the first wins.
    if (t.exclusive) {
      if (claimed.has(t.exclusive)) continue;
      claimed.add(t.exclusive);
    }
    out.add(t.id);
  }
  return out;
}

export function useGuidelines(tags: GuidelineTag[]): Guidelines {
  const [selected, setSelected] = useState<Set<string>>(() => initialSelection(tags));

  // Ids to drop when `id` is turned on: the rest of its exclusive key.
  const peersOf = useCallback(
    (id: string): string[] => {
      const key = tags.find((t) => t.id === id)?.exclusive;
      if (!key) return [];
      return tags.filter((t) => t.exclusive === key && t.id !== id).map((t) => t.id);
    },
    [tags],
  );

  // Keep selection in sync as the tag set changes: drop ids that no longer
  // exist, seed newly-appeared default-on toggles.
  const knownIds = useRef<Set<string>>(new Set(tags.map((t) => t.id)));
  const idKey = tags.map((t) => t.id).join(',');
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(tags.map((t) => t.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      const taken = new Set(
        tags.filter((t) => t.exclusive && next.has(t.id)).map((t) => t.exclusive as string),
      );
      for (const t of tags) {
        if ((t.kind ?? 'toggle') !== 'toggle' || !t.defaultOn || knownIds.current.has(t.id)) continue;
        // A default-on newcomer can't claim an exclusive key that's already taken.
        if (t.exclusive) {
          if (taken.has(t.exclusive)) continue;
          taken.add(t.exclusive);
        }
        next.add(t.id);
      }
      knownIds.current = ids;
      return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          for (const peer of peersOf(id)) next.delete(peer);
          next.add(id);
        }
        return next;
      });
    },
    [peersOf],
  );

  const setOn = useCallback(
    (id: string, on: boolean) => {
      setSelected((prev) => {
        const peers = on ? peersOf(id) : [];
        if (prev.has(id) === on && !peers.some((p) => prev.has(p))) return prev;
        const next = new Set(prev);
        if (on) {
          for (const peer of peers) next.delete(peer);
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [peersOf],
  );

  const clear = useCallback(() => setSelected(initialSelection(tags)), [tags]);

  const toggles = useMemo(() => tags.filter((t) => (t.kind ?? 'toggle') === 'toggle'), [tags]);

  const active = useMemo(() => tags.filter((t) => selected.has(t.id)), [tags, selected]);

  const lines = useMemo(() => {
    const out: string[] = [];
    for (const t of toggles) {
      const line = tagGuideline(t, selected.has(t.id));
      if (line) out.push(line);
    }
    for (const t of tags) {
      if ((t.kind ?? 'toggle') === 'mention' && selected.has(t.id) && t.prompt?.trim()) {
        out.push(t.prompt);
      }
    }
    return out;
  }, [toggles, tags, selected]);

  return { selected, toggle, setOn, clear, active, lines, toggles };
}
