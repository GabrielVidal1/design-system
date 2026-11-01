import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

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
/** The entry that opens the stash menu — placed like any control, never benched. */
const MORE_ID = 'more';
/** Space between the more button and its menu, in px. */
const MENU_GAP = 6;
/** The menu's closest approach to a viewport edge, in px. */
const MENU_EDGE = 8;
/** Panels a control in the menu may have opened (its own picker): a press in
 *  one is not a press "outside" the menu. */
const OVERLAY_SELECTOR =
  ".ds-popover-panel, [role='dialog'], [role='menu'], [role='listbox'], [role='tooltip']";

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
 *
 * **Benched is not out of reach.** While anything is benched, a `+` control
 * joins the row (first seen just before send; rearrangeable like the others,
 * never benched itself). It opens a menu of the benched controls — the real
 * ones, so a chip there opens its own picker as it would in the row. The
 * menu stays mounted while closed (only hidden), so a picker one of its
 * controls opened survives the menu closing behind it.
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

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { row, benched } = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    const stashIds = (saved.stash ?? []).filter((id) => byId.get(id)?.stashable);
    const inStash = new Set(stashIds);
    // The + control exists while there is something to open; a saved order
    // that never met it gets it right before send.
    if (stashIds.length > 0) {
      byId.set(MORE_ID, { id: MORE_ID, label: 'Stashed', stashable: false, node: null });
    }
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
    const more = byId.get(MORE_ID);
    if (more && !seen.has(MORE_ID)) {
      const at = out.findIndex((e) => e.id === 'send');
      out.splice(at < 0 ? out.length : at, 0, more);
    }
    return { row: out, benched: stashIds.map((id) => byId.get(id)!) };
  }, [entries, saved]);

  // ── the menu ──────────────────────────────────────────────────────────────
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (benched.length === 0) setOpen(false);
  }, [benched.length]);
  // Above the button (the toolbar sits at the bottom of the composer), left
  // edges aligned, kept inside the viewport.
  useLayoutEffect(() => {
    const btn = btnRef.current;
    const menu = menuRef.current;
    if (!open || !btn || !menu) return;
    const b = btn.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    const left = Math.max(MENU_EDGE, Math.min(b.left, window.innerWidth - w - MENU_EDGE));
    const top =
      b.top - MENU_GAP - h >= MENU_EDGE
        ? b.top - MENU_GAP - h
        : Math.min(b.bottom + MENU_GAP, window.innerHeight - h - MENU_EDGE);
    setPlace({ left, top: Math.max(MENU_EDGE, top) });
  }, [open, benched.length]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      if (t.closest?.(OVERLAY_SELECTOR)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
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
        onEditStart={() => {
          setOpen(false);
          onEditStart?.();
        }}
        stashPlacement="top"
        className="mt-1.5 flex w-full items-center gap-1.5 px-1"
        itemClassName={(e) => (e.flex ? 'flex-1' : undefined)}
      >
        {(e, { editing }) =>
          e.id === MORE_ID ? (
            <button
              ref={btnRef}
              type="button"
              aria-label={`Stashed controls (${benched.length})`}
              aria-expanded={open}
              title="Stashed controls"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => !editing && setOpen((o) => !o)}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-lg border transition-colors',
                open
                  ? 'border-input text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
              )}
            >
              <Plus className="size-4" />
            </button>
          ) : e.flex ? (
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
      {benched.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="group"
            aria-label="Stashed controls"
            className={cn(
              'fixed z-50 max-h-[min(24rem,calc(100vh-1rem))] w-max max-w-[calc(100vw-1rem)] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg',
              open ? 'flex' : 'hidden',
            )}
            style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
          >
            {benched.map((e) => (
              <div key={e.id} className="flex min-h-8 items-center gap-2 pr-1.5">
                <div className="flex shrink-0 items-center">{e.node}</div>
                <span className="truncate text-[11px] text-muted-foreground">{e.label}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
