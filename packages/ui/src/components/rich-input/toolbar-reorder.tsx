import { useMemo, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { HoldEditable } from '../hold-editable';

/** One control in the reorderable toolbar — built-ins and caller extras alike. */
export interface ToolbarEntry {
  id: string;
  /** Label shown on the entry's stash tag while it is benched. */
  label: string;
  /** May the user bench this control into the stash? (Send may not.) */
  stashable: boolean;
  /** Stretch to fill the free space — the spacer that splits the clusters. */
  flex?: boolean;
  node: ReactNode;
}

const PREFIX = 'rich-input:toolbar:';

/**
 * The composer toolbar as a {@link HoldEditable} group: hold any control to
 * pick it up and rearrange the row, with a stash popover benching the controls
 * the user doesn't want visible. The arrangement is persisted (localStorage,
 * as `{order, stash}` id lists) and reconciled against what the composer
 * renders right now — ids the composer no longer ships are dropped, controls
 * the saved order never met are appended in their code order, so conditional
 * items (history, drafts) come and go without stranding the layout.
 *
 * The left/right split of the classic toolbar survives as a draggable
 * `spacer` entry: an invisible `flex-1` gap (a dashed slot while editing)
 * that the user positions like any other item.
 */
export function ReorderableToolbar({
  storageKey,
  entries,
  onItemHold,
  onEditStart,
}: {
  /** Namespaces the persisted arrangement (`rich-input:toolbar:<key>`). */
  storageKey: string;
  entries: ToolbarEntry[];
  /** First-stage hold action per entry (see {@link HoldEditable}). */
  onItemHold?: (entry: ToolbarEntry) => boolean | void;
  onEditStart?: () => void;
}) {
  const [saved, setSaved] = useLocalStorage<{ order: string[]; stash: string[] }>(
    PREFIX + storageKey,
    { order: [], stash: [] },
  );

  const { row, benched } = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    const stashIds = (saved.stash ?? []).filter((id) => byId.get(id)?.stashable);
    const inStash = new Set(stashIds);
    const out: ToolbarEntry[] = [];
    const seen = new Set<string>();
    for (const id of saved.order ?? []) {
      const e = byId.get(id);
      if (e && !seen.has(id) && !inStash.has(id)) {
        out.push(e);
        seen.add(id);
      }
    }
    for (const e of entries) if (!seen.has(e.id) && !inStash.has(e.id)) out.push(e);
    return { row: out, benched: stashIds.map((id) => byId.get(id)!) };
  }, [entries, saved]);

  return (
    <HoldEditable
      items={row}
      getKey={(e) => e.id}
      onReorder={(next) => setSaved((s) => ({ order: next.map((e) => e.id), stash: s.stash ?? [] }))}
      stash={benched}
      onStashChange={(next, st) =>
        setSaved({ order: next.map((e) => e.id), stash: st.map((e) => e.id) })
      }
      stashLabel={(e) => e.label}
      canStash={(e) => e.stashable}
      onItemHold={onItemHold}
      onEditStart={onEditStart}
      stashPlacement="top"
      className="mt-1.5 flex w-full items-center gap-1.5 px-1"
      itemClassName={(e) => (e.flex ? 'flex-1' : undefined)}
    >
      {(e, { editing }) =>
        e.flex ? (
          <div
            className={cn(
              'h-8 w-full rounded-lg transition-colors',
              editing && 'min-w-6 border border-dashed border-border/70 bg-muted/40',
            )}
          />
        ) : (
          e.node
        )
      }
    </HoldEditable>
  );
}
