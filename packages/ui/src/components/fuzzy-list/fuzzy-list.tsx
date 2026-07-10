import { useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';
import Fuse, { type FuseOptionKey, type FuseResultMatch, type IFuseOptions } from 'fuse.js';
import { Search } from 'lucide-react';

import { cn } from '../../lib/utils';
import { highlightAll, highlightSnippet } from '../../lib/highlight';

/** What `renderItem` receives for each row. */
export interface FuzzyRenderContext<T> {
  /** The row's data object. */
  item: T;
  /** Its index within the currently shown (filtered) list. */
  index: number;
  /** The live search query (trimmed). */
  query: string;
  /** Fuse match metadata for this row (empty when the query is empty). */
  matches: readonly FuseResultMatch[];
  /** Whether this row is the keyboard-focused one. */
  active: boolean;
  /**
   * Render one searched string field with its fuzzy matches wrapped in `<mark>`.
   * Pass `{ snippet: true }` for long fields (windowed, with ellipses); the
   * default highlights the whole value inline. Falls back to the plain value
   * when there's no match.
   */
  highlight: (key: string, opts?: { snippet?: boolean; window?: number }) => ReactNode;
  /** Fire `onSelect` for this row. */
  select: () => void;
}

export interface FuzzyListProps<T> {
  /** The data to search — any array of JSON-like objects. */
  items: T[];
  /** Fields Fuse should search. Accepts dotted paths and weighted keys. */
  keys: FuseOptionKey<T>[];
  /** Render one row from its {@link FuzzyRenderContext}. */
  renderItem: (ctx: FuzzyRenderContext<T>) => ReactNode;
  /** Stable React key per row (defaults to the array index). */
  getItemKey?: (item: T, index: number) => Key;
  /** Called when a row is activated (click or Enter). */
  onSelect?: (item: T, index: number) => void;
  placeholder?: string;
  /** Shown when nothing matches (defaults to "No matches."). */
  emptyState?: ReactNode;
  /** Focus the search box on mount. */
  autoFocus?: boolean;
  /** Cap the number of results (Fuse `limit`). */
  limit?: number;
  /** Show the "N of M" count line above the list. */
  showCount?: boolean;
  /** Extra Fuse options, merged over the defaults. */
  fuseOptions?: IFuseOptions<T>;
  /** Anything to render inline to the right of the search box. */
  toolbar?: ReactNode;
  className?: string;
  inputClassName?: string;
  listClassName?: string;
}

const DEFAULTS = {
  includeMatches: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
} satisfies IFuseOptions<unknown>;

function getPath(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur == null ? '' : String(cur);
}

/**
 * A generic, self-contained fuzzy-search list. Give it any array of JSON-like
 * objects, the {@link FuzzyListProps.keys} to search, and a `renderItem` render
 * function — it owns the search box, the Fuse index, keyboard navigation and
 * match highlighting. Reads its colours from the design tokens.
 *
 * ```tsx
 * <FuzzyList
 *   items={services}
 *   keys={['name', 'desc']}
 *   getItemKey={(s) => s.name}
 *   renderItem={({ highlight, active }) => (
 *     <div data-active={active}>
 *       <strong>{highlight('name')}</strong>
 *       <p>{highlight('desc', { snippet: true })}</p>
 *     </div>
 *   )}
 * />
 * ```
 */
export function FuzzyList<T>({
  items,
  keys,
  renderItem,
  getItemKey,
  onSelect,
  placeholder = 'Search…',
  emptyState = 'No matches.',
  autoFocus,
  limit,
  showCount = true,
  fuseOptions,
  toolbar,
  className,
  inputClassName,
  listClassName,
}: FuzzyListProps<T>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () => new Fuse(items, { ...DEFAULTS, ...fuseOptions, keys }),
    [items, keys, fuseOptions],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return items.map((item, refIndex) => ({ item, refIndex, matches: [] as readonly FuseResultMatch[] }));
    return fuse
      .search(q, limit ? { limit } : undefined)
      .map((r) => ({ item: r.item, refIndex: r.refIndex, matches: (r.matches ?? []) as readonly FuseResultMatch[] }));
  }, [fuse, query, items, limit]);

  // Keep the keyboard cursor in range as the result set changes.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  const commit = (index: number) => {
    const r = results[index];
    if (r && onSelect) onSelect(r.item, r.refIndex);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      commit(active);
    }
  };

  // Scroll the active row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-fuzzy-row="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const q = query.trim();

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            'w-full bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground',
            inputClassName,
          )}
        />
        {toolbar}
      </div>

      {showCount && (
        <div className="px-1 pt-2 mono text-[11px] text-muted-foreground">
          {q ? `${results.length} of ${items.length}` : `${items.length} items`}
        </div>
      )}

      <div ref={listRef} className={cn('min-h-0 flex-1 overflow-y-auto pt-1.5', listClassName)}>
        {results.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyState}</p>
        ) : (
          results.map(({ item, matches }, index) => {
            const highlight = (key: string, opts?: { snippet?: boolean; window?: number }): ReactNode => {
              const value = getPath(item, key);
              const m = matches.find((mm) => mm.key === key);
              const indices = (m?.indices ?? []) as [number, number][];
              if (indices.length === 0) return value;
              return opts?.snippet
                ? highlightSnippet(value, indices, opts.window)
                : highlightAll(value, indices);
            };
            return (
              <div
                key={getItemKey ? getItemKey(item, index) : index}
                data-fuzzy-row={index}
                onMouseMove={() => setActive(index)}
                onClick={() => commit(index)}
              >
                {renderItem({
                  item,
                  index,
                  query: q,
                  matches,
                  active: index === active,
                  highlight,
                  select: () => commit(index),
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
