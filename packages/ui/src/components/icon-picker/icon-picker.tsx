import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '../../lib/utils';
import { SearchInput } from '../search-input';

/**
 * A single pickable icon: an svg-rendering component keyed by a stable name.
 * The component is called with `{ size, className }` — the exact shape a
 * `lucide-react` icon (or any equivalent svg wrapper) already has, so the whole
 * lucide set drops straight in: `icons={LucideIcons.icons}`.
 */
export type IconComponent = React.ComponentType<{
  size?: number | string;
  className?: string;
}>;

/** The set to pick from: a map of icon name → svg component. */
export type IconSet = Record<string, IconComponent>;

export interface IconPickerProps {
  /**
   * The icons to choose from, keyed by name. The keys are what `value`/`onChange`
   * speak and what the search box matches against. Pass e.g. lucide-react's
   * `icons` export for the full set — the library ships no default set of its
   * own, to stay tree-shakeable.
   */
  icons: IconSet;
  /** Currently selected icon name (controlled), or null for none. */
  value?: string | null;
  /** Fires with the clicked icon's name. */
  onChange?: (name: string) => void;
  /** Placeholder for the search field. */
  placeholder?: string;
  /** Focus the search on `⌘K` / `/`, and show the hint key. */
  shortcut?: boolean;
  /** How many rows the horizontal grid is tall. Default 4. */
  rows?: number;
  /** Side of each square cell, px. Default 44. */
  cellSize?: number;
  /** Gap between cells, px. Default 6. */
  gap?: number;
  /** Overall height of the grid track. Defaults to fit `rows` × `cellSize`. */
  height?: number;
  /** Message shown when the search matches nothing. */
  emptyLabel?: React.ReactNode;
  className?: string;
  /** aria-label for the grid, since it has no visible heading. */
  'aria-label'?: string;
}

/** Icons whose name contains every whitespace-split term of the query. */
function filterIcons(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return names;
  const terms = q.split(/\s+/);
  return names.filter((name) => {
    const hay = name.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * A searchable grid of icons that scrolls **horizontally** — items flow
 * top-to-bottom to fill a fixed number of `rows`, and the columns extend (and
 * virtualize) rightward. A search box above filters by icon name. Built for
 * picking a glyph for a link, a tag, a shortcut — anywhere a small labelled set
 * of svgs needs a picker.
 *
 * The columns are virtualized, so the full lucide-react set (~1500 icons)
 * renders and scrolls smoothly with only the visible columns mounted.
 *
 * ```tsx
 * import { icons } from 'lucide-react';
 * <IconPicker icons={icons} value={name} onChange={setName} shortcut />
 * ```
 *
 * @summary Searchable horizontal virtual grid of icons. You pass the icon set (e.g.
 * lucide) — the component ships none.
 */
export function IconPicker({
  icons,
  value,
  onChange,
  placeholder = 'Search icons…',
  shortcut = false,
  rows = 4,
  cellSize = 44,
  gap = 6,
  height,
  emptyLabel = 'No icons match.',
  className,
  'aria-label': ariaLabel = 'Icon picker',
}: IconPickerProps) {
  const [query, setQuery] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const allNames = React.useMemo(() => Object.keys(icons), [icons]);
  const names = React.useMemo(() => filterIcons(allNames, query), [allNames, query]);

  // Lay names into columns of `rows` height, top-to-bottom then rightward.
  const columnCount = Math.ceil(names.length / rows);
  const colStride = cellSize + gap;

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => colStride,
    overscan: 4,
  });

  // A new query changes what's at column 0 — jump the scroll back to the start
  // so the best matches are in view rather than stranded off-screen.
  React.useEffect(() => {
    virtualizer.scrollToOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const trackHeight = height ?? rows * cellSize + (rows - 1) * gap;
  const columns = virtualizer.getVirtualItems();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={placeholder}
        shortcut={shortcut}
      />
      {names.length === 0 ? (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height: trackHeight }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'overflow-x-auto overflow-y-hidden rounded-lg',
            '[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5',
            '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border',
          )}
          style={{ height: trackHeight }}
        >
          <div
            style={{
              position: 'relative',
              width: virtualizer.getTotalSize(),
              height: '100%',
            }}
          >
            {columns.map((column) => {
              const base = column.index * rows;
              const cells = names.slice(base, base + rows);
              return (
                <div
                  key={column.key}
                  className="absolute top-0 left-0 grid content-start"
                  style={{
                    transform: `translateX(${column.start}px)`,
                    width: cellSize,
                    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                    rowGap: gap,
                  }}
                >
                  {cells.map((name) => {
                    const Icon = icons[name];
                    const selected = value === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        aria-label={name}
                        title={name}
                        onClick={() => onChange?.(name)}
                        className={cn(
                          'flex items-center justify-center rounded-md border transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          selected
                            ? 'border-transparent bg-primary text-primary-foreground'
                            : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        style={{ width: cellSize, height: cellSize }}
                      >
                        {Icon ? <Icon size={20} /> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
