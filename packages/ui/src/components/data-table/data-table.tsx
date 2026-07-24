import * as React from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';

import { useIsMobile } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';
import { EmptyState } from '../empty-state';
import { Skeleton } from '../skeleton';

export interface DataTableColumn<T> {
  /** Column id — also the default sort/accessor key when it names a field of `T`. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Defaults to `String(row[key])`. */
  cell?: (row: T, index: number) => React.ReactNode;
  /** Enable the header sort control. */
  sortable?: boolean;
  /**
   * Value the sort compares. Defaults to `row[key]`; required for `sortable`
   * columns whose `key` isn't a field of `T`.
   */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
  /** `width` on the `<col>` — `120`, `'30%'`, `'1fr'`-ish CSS. Desktop only. */
  width?: string | number;
  /** Drop the column from the phone card view (identity/status usually stay). */
  hideOnMobile?: boolean;
  /** Extra classes on this column's cells (both layouts). */
  className?: string;
}

export interface DataTableSort {
  key: string;
  dir: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Stable row key. Defaults to the array index. */
  getRowKey?: (row: T, index: number) => React.Key;
  /** Row activation (click / Enter / Space). Rows become buttons — keyboardable. */
  onRowClick?: (row: T, index: number) => void;
  /** Multi-select checkboxes. Selection is keyed by `getRowKey`. */
  selectable?: boolean;
  /** Controlled selection. Omit for uncontrolled. */
  selected?: ReadonlySet<React.Key>;
  onSelectedChange?: (selected: Set<React.Key>) => void;
  /** Controlled sort. Omit for uncontrolled (`defaultSort` as the start). */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  defaultSort?: DataTableSort;
  /** Keep the header row pinned while the table scrolls. @default true */
  stickyHeader?: boolean;
  /**
   * Below this width (px) rows collapse into cards — first column as the card
   * title, the rest as label/value lines. `0` keeps the table everywhere.
   * @default 640
   */
  cardBreakpoint?: number;
  /** Shown when `data` is empty (defaults to a small {@link EmptyState}). */
  empty?: React.ReactNode;
  /** Render skeleton rows instead of data. */
  loading?: boolean;
  /** Skeleton row count while loading. @default 5 */
  loadingRows?: number;
  className?: string;
  /** Extra classes per row (highlight the running job). */
  rowClassName?: (row: T, index: number) => string | undefined;
}

function defaultCell<T>(row: T, key: string): React.ReactNode {
  const v = (row as Record<string, unknown>)[key];
  if (v === null || v === undefined) return null;
  return String(v as string | number);
}

function defaultSortValue<T>(row: T, key: string): string | number | null | undefined {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : v == null ? null : String(v as string);
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null) return b == null ? 0 : 1; // nulls sink regardless of direction
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The service-frontend table: sortable headers, sticky header row, checkbox
 * selection, and a card collapse on phones so wide rows never side-scroll.
 * Plain rows — for tens of thousands of them, reach for {@link VirtualList}.
 *
 * @summary Sortable, selectable data table that collapses to cards on mobile.
 * Column-driven; for real tabular data with interaction.
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey = (_row, index) => index,
  onRowClick,
  selectable = false,
  selected: selectedProp,
  onSelectedChange,
  sort: sortProp,
  onSortChange,
  defaultSort,
  stickyHeader = true,
  cardBreakpoint = 640,
  empty,
  loading = false,
  loadingRows = 5,
  className,
  rowClassName,
}: DataTableProps<T>) {
  const [sortState, setSortState] = React.useState<DataTableSort | null>(defaultSort ?? null);
  const sort = sortProp !== undefined ? sortProp : sortState;
  const setSort = (next: DataTableSort | null) => {
    setSortState(next);
    onSortChange?.(next);
  };

  const [selectedState, setSelectedState] = React.useState<Set<React.Key>>(new Set());
  const selected = selectedProp ?? selectedState;
  const setSelected = (next: Set<React.Key>) => {
    setSelectedState(next);
    onSelectedChange?.(next);
  };

  const isCards = useIsMobile(cardBreakpoint) && cardBreakpoint > 0;

  const rows = React.useMemo(() => {
    const indexed = data.map((row, index) => ({ row, index }));
    if (!sort) return indexed;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return indexed;
    const value = (row: T) => (col.sortValue ? col.sortValue(row) : defaultSortValue(row, col.key));
    const mul = sort.dir === 'asc' ? 1 : -1;
    return indexed.slice().sort((a, b) => {
      const va = value(a.row);
      const vb = value(b.row);
      // nulls always sink to the bottom, so a desc sort doesn't lead with blanks
      if (va == null || vb == null) return compare(va, vb);
      return compare(va, vb) * mul;
    });
  }, [data, columns, sort]);

  const cycleSort = (key: string) => {
    if (sort?.key !== key) setSort({ key, dir: 'asc' });
    else if (sort.dir === 'asc') setSort({ key, dir: 'desc' });
    else setSort(null);
  };

  const rowKeys = React.useMemo(() => data.map((row, i) => getRowKey(row, i)), [data, getRowKey]);
  const allSelected = rowKeys.length > 0 && rowKeys.every((k) => selected.has(k));
  const someSelected = rowKeys.some((k) => selected.has(k));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rowKeys));
  const toggleRow = (key: React.Key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  if (loading) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        {Array.from({ length: loadingRows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        {empty ?? <EmptyState title="Nothing here" description="No rows to show." />}
      </div>
    );
  }

  if (isCards) {
    const [first, ...rest] = columns;
    return (
      <div className={cn('space-y-2', className)} role="list">
        {rows.map(({ row, index }) => {
          const key = getRowKey(row, index);
          const isSelected = selected.has(key);
          const Card: 'button' | 'div' = onRowClick ? 'button' : 'div';
          return (
            <Card
              key={key}
              role="listitem"
              type={onRowClick ? 'button' : undefined}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              className={cn(
                'block w-full rounded-lg border border-border bg-card p-3 text-left',
                onRowClick && 'transition-colors hover:border-foreground/25 active:bg-muted/50',
                isSelected && 'border-sky-500/50 bg-sky-500/5',
                rowClassName?.(row, index),
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {(first.cell ?? ((r: T) => defaultCell(r, first.key)))(row, index)}
                </div>
                {selectable && (
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    checked={isSelected}
                    onChange={() => toggleRow(key)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-4 shrink-0 accent-sky-500"
                  />
                )}
              </div>
              <dl className="mt-2 space-y-1">
                {rest
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="shrink-0 text-muted-foreground">{c.header}</dt>
                      <dd className={cn('min-w-0 truncate text-right text-foreground', c.className)}>
                        {(c.cell ?? ((r: T) => defaultCell(r, c.key)))(row, index)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto rounded-lg border border-border', className)}>
      <table className="w-full border-collapse text-sm">
        {columns.some((c) => c.width !== undefined) && (
          <colgroup>
            {selectable && <col style={{ width: 40 }} />}
            {columns.map((c) => (
              <col key={c.key} style={c.width !== undefined ? { width: c.width } : undefined} />
            ))}
          </colgroup>
        )}
        <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
          <tr className="border-b border-border bg-card text-left">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="size-4 accent-sky-500"
                />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const SortGlyph = active ? (sort!.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium text-muted-foreground',
                    c.align === 'right' && 'text-right',
                    c.className,
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => cycleSort(c.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-foreground',
                        c.align === 'right' && 'flex-row-reverse',
                        active && 'text-foreground',
                      )}
                    >
                      {c.header}
                      <SortGlyph className={cn('size-3.5', !active && 'opacity-50')} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, index }) => {
            const key = getRowKey(row, index);
            const isSelected = selected.has(key);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row, index);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'border-b border-border last:border-b-0',
                  onRowClick && 'cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                  isSelected && 'bg-sky-500/5',
                  rowClassName?.(row, index),
                )}
              >
                {selectable && (
                  <td className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                      onClick={(e) => e.stopPropagation()}
                      className="size-4 accent-sky-500"
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-3 py-2.5 text-foreground', c.align === 'right' && 'text-right', c.className)}
                  >
                    {(c.cell ?? ((r: T) => defaultCell(r, c.key)))(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
