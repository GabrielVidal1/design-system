import { useCallback, useEffect, useRef, useState, type Key, type ReactNode } from 'react';
import { type FuseOptionKey, type IFuseOptions } from 'fuse.js';
import { Search } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../button';
import { FuzzyList, type FuzzyRenderContext } from '../fuzzy-list';
import { Modal } from '../modal';
import { Spinner } from '../spinner';
import { formatHotkey, useHotkey } from './hotkey';

/** Items may be given up front, or loaded the first time the palette opens —
 * which is how you keep a big build-time JSON index out of the initial bundle. */
export type GlobalSearchSource<T> = T[] | (() => T[] | Promise<T[]>);

export interface GlobalSearchProps<T> {
  /** The searchable set, or a loader called once on first open. */
  items: GlobalSearchSource<T>;
  /** Fields to search. Dotted paths and weighted keys, same as {@link FuzzyList}. */
  keys: FuseOptionKey<T>[];
  /** Fired when a result is picked (click or Enter). */
  onSelect: (item: T, index: number) => void;
  /**
   * Global shortcut that opens the palette — `Mod+K` (Cmd on Apple, Ctrl
   * elsewhere), `Ctrl+K`, `Cmd+Shift+P`, or a bare key like `/`. Pass `null` for
   * no shortcut. Default `Mod+K`.
   */
  searchKey?: string | null;
  /** Row renderer. Defaults to title / description / badge from the `*Key` props. */
  renderItem?: (ctx: FuzzyRenderContext<T>) => ReactNode;
  /** Field shown as the row's title in the default renderer. Defaults to the first `keys` entry. */
  titleKey?: string;
  /** Field shown under the title (snippet-highlighted) in the default renderer. */
  descriptionKey?: string;
  /** Field shown as the right-hand badge in the default renderer (a kind/section). */
  badgeKey?: string;
  /** Stable React key per row. */
  getItemKey?: (item: T, index: number) => Key;
  placeholder?: string;
  /** Shown when nothing matches. */
  emptyState?: ReactNode;
  /** Cap the result count. Default 50 — a palette is for finding, not browsing. */
  limit?: number;
  /** Search debounce, ms. Default 400 (see {@link FuzzyList}). */
  debounce?: number;
  /** Row-height guess for the virtual list, px. Default 56. */
  estimateSize?: number;
  /** Extra Fuse options. */
  fuseOptions?: IFuseOptions<T>;
  /** Close the palette after a selection. Default true. */
  closeOnSelect?: boolean;
  /** The trigger. `icon` = square search button (default), `bar` = a fake search
   * field with the shortcut hint, `none` = no trigger (drive it with `open`). */
  trigger?: 'icon' | 'bar' | 'none';
  /** Trigger label for the `bar` variant. Default "Search…". */
  triggerLabel?: string;
  /** Controlled open state. Omit to let the component own it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Footer hint line under the results. Pass `null` to drop it. */
  hint?: ReactNode;
  className?: string;
}

/**
 * The Cmd-K palette, assembled from the pieces this library already ships: a
 * {@link Modal} holding a {@link FuzzyList} (which is itself a debounced,
 * quote-aware Fuse search over a `VirtualList`, so an index of thousands of
 * entries still scrolls at 60fps and only the visible rows are in the DOM).
 *
 * `items` can be a loader — the palette calls it the first time it opens, which
 * is how you lazily pull a static, build-time-generated `search-index.json`
 * without paying for it on first paint.
 *
 * ```tsx
 * <GlobalSearch
 *   searchKey="Ctrl+K"
 *   items={() => fetch('/search-index.json').then((r) => r.json())}
 *   keys={['name', 'summary', 'props']}
 *   titleKey="name"
 *   descriptionKey="summary"
 *   badgeKey="kind"
 *   onSelect={(entry) => navigate(entry.route)}
 * />
 * ```
 *
 * @summary Cmd-K command palette over any item array — keyboard-driven, grouped
 * results, custom hotkey.
 */
export function GlobalSearch<T>({
  items,
  keys,
  onSelect,
  searchKey = 'Mod+K',
  renderItem,
  titleKey,
  descriptionKey,
  badgeKey,
  getItemKey,
  placeholder = 'Search…',
  emptyState = 'No matches.',
  limit = 50,
  debounce = 400,
  estimateSize = 56,
  fuseOptions,
  closeOnSelect = true,
  trigger = 'icon',
  triggerLabel = 'Search…',
  open: openProp,
  onOpenChange,
  hint,
  className,
}: GlobalSearchProps<T>) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  // Lazily resolve the source the first time the palette opens, then keep it.
  const [loaded, setLoaded] = useState<T[] | null>(Array.isArray(items) ? items : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (Array.isArray(items)) setLoaded(items);
  }, [items]);

  useEffect(() => {
    if (!open || Array.isArray(items) || requested.current) return;
    requested.current = true;
    setLoading(true);
    Promise.resolve(items())
      .then((rows) => setLoaded(rows))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, items]);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  useHotkey(searchKey, toggle);

  const keyHint = searchKey ? formatHotkey(searchKey) : null;

  const defaultRender = ({ highlight, item, active }: FuzzyRenderContext<T>): ReactNode => {
    const title = titleKey ?? firstPath(keys);
    const badge = badgeKey ? String(readPath(item, badgeKey) ?? '') : '';
    return (
      <div
        className={cn(
          'flex items-start justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors',
          active ? 'border-border bg-muted' : 'hover:bg-muted/60',
        )}
      >
        <div className="min-w-0">
          <div className="mono truncate text-sm text-foreground">{title ? highlight(title) : null}</div>
          {descriptionKey && (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
              {highlight(descriptionKey, { snippet: true })}
            </p>
          )}
        </div>
        {badge && (
          <span className="mono shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
    );
  };

  const select = (item: T, index: number) => {
    onSelect(item, index);
    if (closeOnSelect) setOpen(false);
  };

  return (
    <>
      {trigger === 'icon' && (
        <Button
          variant="outline"
          size="icon-md"
          aria-label="Search"
          onClick={() => setOpen(true)}
          tooltip={keyHint ? keyHint.join(' ') : undefined}
          className={className}
        >
          <Search />
        </Button>
      )}
      {trigger === 'bar' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex h-9 min-w-56 items-center gap-2 rounded-md border border-border bg-[var(--surface,transparent)] px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted',
            className,
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">{triggerLabel}</span>
          {keyHint && <Kbd keys={keyHint} />}
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        hideHeader
        bodyClassName="min-h-0 flex-1 overflow-hidden p-3 sm:p-4"
        className="ds-global-search"
      >
        <div className="flex h-[min(60vh,32rem)] min-h-0 flex-col">
          {loading && <Spinner center label="Loading index…" />}
          {error && (
            <p className="px-2 py-8 text-center text-sm text-destructive">Search index failed: {error}</p>
          )}
          {!loading && !error && (
            <FuzzyList
              items={loaded ?? []}
              keys={keys}
              autoFocus
              debounce={debounce}
              limit={limit}
              estimateSize={estimateSize}
              fuseOptions={fuseOptions}
              getItemKey={getItemKey}
              placeholder={placeholder}
              emptyState={emptyState}
              onSelect={select}
              renderItem={renderItem ?? defaultRender}
              className="min-h-0 flex-1"
              inputClassName="py-2.5 text-base sm:text-sm"
            />
          )}
          {hint !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-1 pt-2 text-[11px] text-muted-foreground">
              {hint ?? (
                <>
                  <span>
                    <Kbd keys={['↑', '↓']} /> navigate
                  </span>
                  <span>
                    <Kbd keys={['↵']} /> open
                  </span>
                  <span>
                    <Kbd keys={['esc']} /> close
                  </span>
                  <span className="mono">"quoted" = exact match</span>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {keys.map((k) => (
        <kbd
          key={k}
          className="mono rounded border border-border bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** The first key of a Fuse `keys` list, as a dotted path — the default title field. */
function firstPath<T>(keys: FuseOptionKey<T>[]): string | undefined {
  const k = keys[0];
  if (k == null) return undefined;
  if (typeof k === 'string') return k;
  if (Array.isArray(k)) return k.join('.');
  const name = (k as { name: string | string[] }).name;
  return Array.isArray(name) ? name.join('.') : name;
}

function readPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}
