import { useCallback } from 'react';

import { useLocalStorage } from '../../hooks/use-local-storage';
import type { RichDraft } from './types';

const PREFIX = 'rich-input:drafts:';
const MAX_DRAFTS = 100;

function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SavedDrafts {
  /** Newest first. */
  drafts: RichDraft[];
  /** Store a new draft (id/savedAt stamped here); returns the stored record. */
  save: (draft: Omit<RichDraft, 'id' | 'savedAt'>) => RichDraft;
  remove: (id: string) => void;
}

/**
 * The composer's saved-drafts shelf: a localStorage-backed list of
 * {@link RichDraft} records (text + selected tag ids + files + caller extra),
 * newest first, shared across tabs and hook instances. Namespaced by the
 * composer's `cacheKey` so different composers keep separate shelves.
 */
export function useSavedDrafts(key: string | null | undefined): SavedDrafts {
  const [drafts, setDrafts] = useLocalStorage<RichDraft[]>(PREFIX + (key ?? 'default'), []);

  const save = useCallback(
    (draft: Omit<RichDraft, 'id' | 'savedAt'>): RichDraft => {
      const record: RichDraft = { ...draft, id: uid(), savedAt: Date.now() };
      setDrafts((prev) => [record, ...prev].slice(0, MAX_DRAFTS));
      return record;
    },
    [setDrafts],
  );

  const remove = useCallback(
    (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id)),
    [setDrafts],
  );

  return { drafts, save, remove };
}
