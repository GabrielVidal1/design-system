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
  return new Set(tags.filter((t) => (t.kind ?? 'toggle') === 'toggle' && t.defaultOn).map((t) => t.id));
}

export function useGuidelines(tags: GuidelineTag[]): Guidelines {
  const [selected, setSelected] = useState<Set<string>>(() => initialSelection(tags));

  // Keep selection in sync as the tag set changes: drop ids that no longer
  // exist, seed newly-appeared default-on toggles.
  const knownIds = useRef<Set<string>>(new Set(tags.map((t) => t.id)));
  const idKey = tags.map((t) => t.id).join(',');
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(tags.map((t) => t.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      for (const t of tags) {
        if ((t.kind ?? 'toggle') === 'toggle' && t.defaultOn && !knownIds.current.has(t.id)) {
          next.add(t.id);
        }
      }
      knownIds.current = ids;
      return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setOn = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

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
