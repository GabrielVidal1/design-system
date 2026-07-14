import { useEffect, useMemo, useRef, useState, type Key, type ReactNode } from 'react';
import Fuse, { type FuseOptionKey, type FuseResultMatch, type IFuseOptions } from 'fuse.js';
import { Search } from 'lucide-react';

import { cn } from '../../lib/utils';
import { highlightAll, highlightSnippet } from '../../lib/highlight';
import { runSearch, type SearchResult } from '../../lib/search';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { Spinner } from '../spinner';
import { VirtualList, type VirtualListColumns, type VirtualListHandle } from '../virtual-list';

type Result<T> = SearchResult<T>;

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
  /** First-paint row-height guess for the virtual list, px. Default 60 (compact
   * rows). Bump it when rendering taller rows/cards to cut first-paint jank. */
  estimateSize?: number;
  /** Off-screen rows kept mounted as a scroll buffer. Default 8. */
  overscan?: number;
  /**
   * Render the results as a **card grid** of this many columns instead of a
   * single column (forwarded to {@link VirtualList}; responsive maps allowed).
   * Search, highlighting and keyboard nav all still work — the arrow keys just
   * become 2-D: ↑/↓ move a row, ←/→ move one card.
   */
  columns?: VirtualListColumns;
  /** Gap between grid cells, px. Only used when `columns` > 1. Default 12. */
  gap?: number;
  /**
   * Glide rows to their new slot when the results re-order — as they do on every
   * keystroke (Fuse re-ranks by relevance), when the source list re-sorts, or
   * when a live update changes an item's rank. Forwarded to
   * {@link VirtualList.smooth}; needs a stable `getItemKey`, and rows moving up
   * pass in front of the ones they displace. Off by default.
   */
  smooth?: boolean;
  /** How long a `smooth` reorder takes, in ms. Default 520. */
  smoothDuration?: number;
  /** The CSS timing function of a `smooth` reorder. Default is an ease-in-out. */
  smoothEasing?: string;
  /** Show the "N of M" count line above the list. */
  showCount?: boolean;
  /**
   * How long to wait (ms) after the last keystroke before re-running the search.
   * The input stays instant; only the Fuse pass and the re-render of the list
   * trail behind it, which is what keeps a big index from stuttering while
   * typing. Default 400. Set `0` to search on every keystroke.
   */
  debounce?: number;
  /** Extra Fuse options, merged over the defaults. */
  fuseOptions?: IFuseOptions<T>;
  /** Anything to render inline to the right of the search box. */
  toolbar?: ReactNode;
  /** Called with the live (un-debounced) query on every keystroke. */
  onQueryChange?: (query: string) => void;
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
 * The search box is quote-aware: a bare query fuzzy-matches, while any
 * `"double-quoted"` segment must appear as an exact (case-insensitive)
 * substring. The two can mix — `parser "utils.ts"` fuzzy-matches `parser` and
 * then keeps only rows whose fields contain the literal `utils.ts`.
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
  estimateSize = 60,
  overscan = 8,
  columns,
  gap,
  smooth,
  smoothDuration,
  smoothEasing,
  showCount = true,
  debounce = 400,
  fuseOptions,
  toolbar,
  onQueryChange,
  className,
  inputClassName,
  listClassName,
}: FuzzyListProps<T>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const apiRef = useRef<VirtualListHandle>(null);

  // The input is always live; the search trails it by `debounce` ms.
  const [searched, pending] = useDebouncedValue(query, debounce);

  const fuse = useMemo(
    () => new Fuse(items, { ...DEFAULTS, ...fuseOptions, keys }),
    [items, keys, fuseOptions],
  );

  const results = useMemo<Result<T>[]>(
    () => runSearch(fuse, items, keys, searched, limit),
    [fuse, searched, items, keys, limit],
  );

  // Keep the keyboard cursor in range as the result set changes.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  const commit = (index: number) => {
    const r = results[index];
    if (r && onSelect) onSelect(r.item, r.refIndex);
  };

  // Move the keyboard cursor and keep it in view (the list is virtualized, so
  // the active row may not be mounted — ask the virtualizer to scroll to it).
  const move = (delta: number) => {
    const next = Math.min(Math.max(active + delta, 0), results.length - 1);
    setActive(next);
    apiRef.current?.scrollToIndex(next);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    // In grid mode the cursor is 2-D: ↑/↓ jump a whole row, ←/→ step one card.
    // In list mode the column count is 1, so ↑/↓ collapse back to ∓1 and the
    // horizontal keys are left alone for text editing in the search box.
    const cols = apiRef.current?.columnCount ?? 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(cols);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-cols);
    } else if (cols > 1 && e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    } else if (cols > 1 && e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      commit(active);
    }
  };

  // Everything downstream (count line, highlighting, empty state) describes the
  // results, so it reads the searched query, not the one still being typed.
  const q = searched.trim();

  // Whether the caller asked for a grid at all (a number > 1, or any responsive
  // map). Only affects cell styling; VirtualList resolves the real count.
  const grid = typeof columns === 'object' || (typeof columns === 'number' && columns > 1);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            'w-full bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground',
            inputClassName,
          )}
        />
        {pending && <Spinner className="size-3.5 shrink-0 text-muted-foreground" />}
        {toolbar}
      </div>

      {showCount && (
        <div className="px-1 pt-2 mono text-[11px] text-muted-foreground">
          {q ? `${results.length} of ${items.length}` : `${items.length} items`}
        </div>
      )}

      <VirtualList
        items={results}
        apiRef={apiRef}
        estimateSize={estimateSize}
        overscan={overscan}
        columns={columns}
        gap={gap}
        smooth={smooth}
        smoothDuration={smoothDuration}
        smoothEasing={smoothEasing}
        getItemKey={getItemKey ? (r, i) => getItemKey(r.item, i) : undefined}
        className={cn('min-h-0 flex-1 pt-1.5', listClassName)}
        emptyState={<p className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyState}</p>}
        renderItem={({ item, matches }, index) => {
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
              onMouseMove={() => setActive(index)}
              onClick={() => commit(index)}
              // List mode spaces its rows here; in grid mode VirtualList's own
              // `gap` does it, and the cell instead stretches so the cards in a
              // row share one height.
              style={grid ? { height: '100%' } : { paddingBottom: 4 }}
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
        }}
      />
    </div>
  );
}
