import { useCallback, useId, useState, type Key, type ReactNode } from 'react';
import type { FuseOptionKey } from 'fuse.js';
import { LayoutGrid, List as ListIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { EmptyState } from '../empty-state';
import { Skeleton, SkeletonGrid } from '../skeleton';
import { FuzzyList } from '../fuzzy-list';
import { VirtualList, type VirtualListColumns } from '../virtual-list';
import { ProgressiveImage } from '../image-viewer';

/** The two ways a collection can be laid out. */
export type CollectionView = 'cards' | 'list';

/** The image for one item: a full-resolution source, plus an optional small
 *  `thumb` that paints (blurred) while the full one lazy-loads. */
export interface CollectionImage {
  full: string;
  thumb?: string;
  alt?: string;
}

/** What the render props receive for one item. */
export interface CollectionItemContext<T> {
  item: T;
  /** Index in the currently-shown list (post-search in search mode). */
  index: number;
  /** The layout this item is being rendered into. */
  view: CollectionView;
  /** Keyboard-focused (search mode only; always false without `searchKeys`). */
  active: boolean;
  /** Fire `onSelect` for this item. */
  select: () => void;
  /**
   * Render a searched string field with its fuzzy matches wrapped in `<mark>`.
   * Only highlights in search mode (`searchKeys`); otherwise returns the plain
   * value, so the same renderer works either way.
   */
  highlight: (key: string) => ReactNode;
}

export interface CollectionProps<T> {
  /** The items. Any array of objects — nothing is assumed about their shape. */
  items: T[];

  /* ── The item shape ────────────────────────────────────────────────────── */
  /** The item's title — the one field a collection always has. */
  getTitle: (item: T) => ReactNode;
  /** A muted second line under the title (a path, an author, a date…). */
  getSubtitle?: (item: T) => ReactNode;
  /**
   * The field `getTitle` reads, so that in search mode the built-in item can
   * `<mark>` the matched substring inside the title. Defaults to the first
   * `searchKeys` entry when that's a plain string — set it explicitly when the
   * title comes from a different field. Ignored without `searchKeys`.
   */
  titleKey?: string;
  /** The field `getSubtitle` reads — same deal, for the second line. */
  subtitleKey?: string;
  /**
   * The item's image. Return `undefined` for items that have none — cards fall
   * back to a muted placeholder and rows just lose their thumbnail, so a mixed
   * collection stays aligned. Lazy-loaded via {@link ProgressiveImage}: the
   * full-res file is only fetched once the tile nears the viewport.
   */
  getImage?: (item: T) => CollectionImage | string | undefined;
  /** Stable React key per item (defaults to the index). */
  getItemKey?: (item: T, index: number) => Key;

  /* ── Generic slots ─────────────────────────────────────────────────────── */
  /** Extra content under the title — badges, stats, a `RelativeTime`. */
  renderMeta?: (ctx: CollectionItemContext<T>) => ReactNode;
  /** Trailing controls — buttons, a menu. Kept out of the click target. */
  renderActions?: (ctx: CollectionItemContext<T>) => ReactNode;
  /** Absolutely-positioned over the card's image (a badge, a duration pill).
   *  Cards only — rows have no image surface to overlay. */
  renderOverlay?: (ctx: CollectionItemContext<T>) => ReactNode;
  /** Replace the whole card. The escape hatch when the built-in one won't do. */
  renderCard?: (ctx: CollectionItemContext<T>) => ReactNode;
  /** Replace the whole list row. */
  renderRow?: (ctx: CollectionItemContext<T>) => ReactNode;

  /* ── The view toggle ───────────────────────────────────────────────────── */
  /** Controlled view. Omit for uncontrolled (see `defaultView` / `persistKey`). */
  view?: CollectionView;
  /** Called on toggle — required for a controlled `view` to actually change. */
  onViewChange?: (view: CollectionView) => void;
  /** Starting view when uncontrolled. @default 'cards' */
  defaultView?: CollectionView;
  /** Remember the user's choice under this `localStorage` key, across reloads.
   *  Ignored when `view` is controlled. */
  persistKey?: string;
  /** Hide the built-in toggle — e.g. you render your own, or drive `view`
   *  entirely from outside. */
  hideToggle?: boolean;
  /** Anything to render alongside the toggle (a sort control, a count…). */
  toolbar?: ReactNode;

  /* ── Search (optional — composes with FuzzyList) ───────────────────────── */
  /**
   * Fields to fuzzy-search. **Set this and the collection grows a search box**:
   * it renders through {@link FuzzyList}, so you get the quote-aware fuzzy
   * search, `<mark>` highlighting and keyboard navigation, with the view toggle
   * docked into the search bar. Leave it off for a plain windowed collection.
   */
  searchKeys?: FuseOptionKey<T>[];
  /** Placeholder for the search box. */
  searchPlaceholder?: string;
  /** Focus the search box on mount. */
  autoFocus?: boolean;
  /** ms after the last keystroke before the search re-runs. @default 300 */
  debounce?: number;

  /* ── Layout ────────────────────────────────────────────────────────────── */
  /** Columns in `cards` view. @default `{ base: 2, md: 3, lg: 4 }` */
  columns?: VirtualListColumns;
  /** Gap between cards, px. @default 12 */
  gap?: number;
  /** CSS aspect ratio for a card's image. @default '4 / 3' */
  aspect?: string;
  /** Row-height guess for first paint, px. Sensible defaults per view. */
  estimateSize?: number;

  /* ── State ─────────────────────────────────────────────────────────────── */
  /** Called when an item is activated (click, or Enter in search mode). */
  onSelect?: (item: T, index: number) => void;
  /** Show placeholders instead of items. */
  loading?: boolean;
  /** Shown when the collection itself has no items. */
  emptyState?: ReactNode;
  /** Shown when the collection has items but the search matched none of them —
   *  a different situation, and a different message. Search mode only. */
  noMatchesState?: ReactNode;
  className?: string;
  /** Classes on the scrolling list container — **give it a bounded height**
   *  (e.g. `h-[600px]` or `flex-1 min-h-0`), like any windowed list. */
  listClassName?: string;
}

/** Normalise the two accepted `getImage` return shapes. */
function toImage(value: CollectionImage | string | undefined): CollectionImage | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? { full: value } : value;
}

/** Read a dotted path off an item as a string — the same coercion Fuse and the
 *  highlighter use, so a key like `meta.name` resolves the way it does there. */
function valueAt(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur == null ? '' : String(cur);
}

/**
 * A generic collection of things that have a picture and a name — and a toggle
 * to flip between a **card grid** and a **compact list**. The two views are the
 * same data, the same click targets and the same render props; only the shape
 * changes.
 *
 * It is built out of the library rather than beside it: {@link VirtualList}
 * windows both views (cards included — it chunks them into rows, so a thousand
 * cards cost what a thousand rows do), {@link ProgressiveImage} blur-up-loads
 * every picture only once it nears the viewport, and passing `searchKeys` routes
 * the whole thing through {@link FuzzyList} to add fuzzy search, `<mark>`
 * highlighting and keyboard nav — with the toggle docked into the search bar.
 *
 * ```tsx
 * <Collection
 *   items={photos}
 *   getTitle={(p) => p.name}
 *   getSubtitle={(p) => p.album}
 *   getImage={(p) => ({ thumb: p.thumb, full: p.url })}
 *   searchKeys={['name', 'album']}   // ← optional: adds the search box
 *   persistKey="photos.view"          // ← remembers cards-vs-list
 *   onSelect={open}
 *   listClassName="h-[600px]"
 * />
 * ```
 *
 * @summary Batteries-included browser for a set of records — grid/list/table views,
 * built-in search, image cards. The fastest "show me these things"
 * component.
 */
export function Collection<T>({
  items,
  getTitle,
  getSubtitle,
  titleKey,
  subtitleKey,
  getImage,
  getItemKey,
  renderMeta,
  renderActions,
  renderOverlay,
  renderCard,
  renderRow,
  view: controlledView,
  onViewChange,
  defaultView = 'cards',
  persistKey,
  hideToggle = false,
  toolbar,
  searchKeys,
  searchPlaceholder = 'Search…',
  autoFocus,
  debounce = 300,
  columns = { base: 2, md: 3, lg: 4 },
  gap = 12,
  aspect = '4 / 3',
  estimateSize,
  onSelect,
  loading = false,
  emptyState,
  noMatchesState,
  className,
  listClassName,
}: CollectionProps<T>) {
  // Uncontrolled view state, optionally persisted. Both hooks run either way
  // (hooks can't be conditional); whichever is live is picked below. Without a
  // `persistKey` the storage hook gets a per-instance key, so two un-persisted
  // collections on one page can't end up sharing a view through it.
  const fallbackKey = useId();
  const [storedView, setStoredView] = useLocalStorage<CollectionView>(
    persistKey ?? `ds-collection-view:${fallbackKey}`,
    defaultView,
  );
  const [localView, setLocalView] = useState<CollectionView>(defaultView);

  const uncontrolled = persistKey ? storedView : localView;
  const view = controlledView ?? uncontrolled;

  const setView = useCallback(
    (next: CollectionView) => {
      if (controlledView == null) {
        if (persistKey) setStoredView(next);
        else setLocalView(next);
      }
      onViewChange?.(next);
    },
    [controlledView, persistKey, setStoredView, onViewChange],
  );

  const cards = view === 'cards';

  const toggle = hideToggle ? null : <ViewToggle view={view} onChange={setView} />;

  // Which field the title/subtitle come from, so search mode can `<mark>` the
  // match inside them. The common case — searching the title first — needs no
  // configuration: fall back to the leading string in `searchKeys`.
  const firstKey = typeof searchKeys?.[0] === 'string' ? (searchKeys[0] as string) : undefined;
  const tKey = titleKey ?? firstKey;
  const sKey = subtitleKey;

  /**
   * The field value, with the search match marked — but only when it really is
   * *this* field being displayed. A `getTitle` that composes or decorates the
   * value (a template string, a ReactNode) must win over the highlighter, or we
   * would silently render something the caller never asked for. So: highlight
   * only when what the accessor produced is exactly the raw field.
   */
  const marked = (
    key: string | undefined,
    rendered: ReactNode,
    item: T,
    highlight: (key: string) => ReactNode,
  ): ReactNode => {
    if (!key || typeof rendered !== 'string') return rendered;
    if (valueAt(item, key) !== rendered) return rendered;
    return highlight(key);
  };

  /** One item, in whichever view is active. Shared by the searched and plain
   *  paths, so the two can never drift apart. */
  const renderItem = (ctx: CollectionItemContext<T>): ReactNode => {
    const override = ctx.view === 'cards' ? renderCard : renderRow;
    if (override) return override(ctx);

    const image = toImage(getImage?.(ctx.item));
    const rawTitle = getTitle(ctx.item);
    const title = marked(tKey, rawTitle, ctx.item, ctx.highlight);
    const subtitle = marked(sKey, getSubtitle?.(ctx.item), ctx.item, ctx.highlight);
    const meta = renderMeta?.(ctx);
    const actions = renderActions?.(ctx);
    // From the *raw* title — the displayed one may be marked-up JSX by now.
    const alt = image?.alt ?? (typeof rawTitle === 'string' ? rawTitle : '');

    if (ctx.view === 'cards') {
      return (
        <button
          type="button"
          onClick={ctx.select}
          className={cn(
            'group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-[var(--tint)] text-left transition-colors',
            ctx.active ? 'border-[color:var(--cyan)]' : 'border-border hover:border-[color:var(--cyan)]/50',
          )}
        >
          <div className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: aspect }}>
            {image ? (
              <ProgressiveImage
                full={image.full}
                thumb={image.thumb}
                alt={alt}
                className="absolute inset-0 h-full w-full"
                imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground [&_svg]:size-6">
                <LayoutGrid aria-hidden />
              </div>
            )}
            {renderOverlay?.(ctx)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
            <div className="line-clamp-1 text-sm font-medium text-foreground">{title}</div>
            {subtitle != null && (
              <div className="line-clamp-1 text-[12px] text-muted-foreground">{subtitle}</div>
            )}
            {meta}
            {actions && <div className="mt-auto pt-1.5">{actions}</div>}
          </div>
        </button>
      );
    }

    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border px-2 py-2 transition-colors',
          ctx.active
            ? 'border-[color:var(--cyan)]/50 bg-[var(--tint-strong)]'
            : 'border-transparent hover:bg-[var(--tint)]',
        )}
      >
        <button
          type="button"
          onClick={ctx.select}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {image && (
            <ProgressiveImage
              full={image.full}
              thumb={image.thumb}
              alt={alt}
              className="size-10 shrink-0 overflow-hidden rounded-md"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-sm text-foreground">{title}</div>
            {subtitle != null && (
              <div className="line-clamp-1 text-[12px] text-muted-foreground">{subtitle}</div>
            )}
            {meta}
          </div>
        </button>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    );
  };

  const empty = emptyState ?? <EmptyState title="Nothing here" description="No items to show yet." compact />;
  const noMatches = noMatchesState ?? <EmptyState title="No matches" description="Try a different search." compact />;
  // FuzzyList renders one empty state for "zero rows", which covers two very
  // different situations: an empty collection, and a search that matched nothing
  // in a full one. Only the former means "there is nothing here" — pick by
  // whether the collection has any items at all.
  const searchEmpty = items.length === 0 ? empty : noMatches;

  // A card is much taller than a row — guess accordingly so the first paint of a
  // long collection doesn't jump as real heights get measured.
  const size = estimateSize ?? (cards ? 220 : 60);
  // Cards grid vs. single column. VirtualList treats 1 as "plain list".
  const cols = cards ? columns : 1;

  // Placeholders shaped like the view they stand in for — a grid of cards, or a
  // stack of rows. (`SkeletonGrid` is always a grid, so it only fits the former.)
  const placeholder = cards ? (
    <SkeletonGrid count={6} aspect="aspect-[4/3]" />
  ) : (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );

  // Search mode: FuzzyList owns the box, the Fuse index, the highlighting and
  // the keyboard cursor; we hand it the same renderItem and dock the toggle into
  // its toolbar slot. No second copy of any of that lives here.
  //
  // Note it keeps rendering while `loading` — the search box and the toggle must
  // not vanish mid-fetch (a typed query would go with them), so only the list
  // *body* is swapped for placeholders, via FuzzyList's empty state over an
  // empty item set.
  if (searchKeys?.length) {
    return (
      <FuzzyList
        items={loading ? [] : items}
        keys={searchKeys}
        getItemKey={getItemKey}
        onSelect={onSelect}
        placeholder={searchPlaceholder}
        autoFocus={autoFocus}
        debounce={debounce}
        columns={cols}
        gap={gap}
        estimateSize={size}
        showCount={!loading}
        emptyState={loading ? placeholder : searchEmpty}
        toolbar={
          <div className="flex shrink-0 items-center gap-2">
            {toolbar}
            {toggle}
          </div>
        }
        className={cn('min-h-0', className)}
        listClassName={listClassName}
        renderItem={({ item, index, active, select, highlight }) =>
          renderItem({ item, index, view, active, select, highlight })
        }
      />
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      {(toggle || toolbar) && (
        <div className="flex items-center gap-2">
          {toolbar}
          <div className="ml-auto">{toggle}</div>
        </div>
      )}
      <VirtualList
        items={loading ? [] : items}
        getItemKey={getItemKey}
        columns={cols}
        gap={gap}
        estimateSize={size}
        emptyState={loading ? placeholder : empty}
        className={cn('min-h-0 flex-1', listClassName)}
        renderItem={(item, index) => (
          <div style={cards ? { height: '100%' } : { paddingBottom: 4 }}>
            {renderItem({
              item,
              index,
              view,
              active: false,
              select: () => onSelect?.(item, index),
              // No search running, so there is nothing to mark up — hand back
              // the plain field so one renderer serves both paths.
              highlight: (key) => valueAt(item, key),
            })}
          </div>
        )}
      />
    </div>
  );
}

/** The segmented cards/list control. */
function ViewToggle({
  view,
  onChange,
}: {
  view: CollectionView;
  onChange: (view: CollectionView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted p-0.5"
    >
      {(
        [
          ['cards', LayoutGrid, 'Card view'],
          ['list', ListIcon, 'List view'],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            'grid size-7 place-items-center rounded transition-colors [&_svg]:size-3.5',
            view === value
              ? 'bg-[var(--tint-strong)] text-[color:var(--cyan-deep)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon aria-hidden />
        </button>
      ))}
    </div>
  );
}
