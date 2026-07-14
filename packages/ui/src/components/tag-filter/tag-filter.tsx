import * as React from 'react';

import { cn } from '../../lib/utils';

export interface TagFilterItem {
  /** Stable id — what `value`/`onChange` speak. */
  id: string;
  /** Display label. Defaults to the id. */
  label?: React.ReactNode;
  /** Count rendered after the label (e.g. unread mail per folder). */
  count?: number;
  disabled?: boolean;
}

export interface TagFilterProps {
  items: TagFilterItem[];
  /** Selected ids. Empty means "no filter" (the All chip reads as selected). */
  value: string[];
  onChange: (value: string[]) => void;
  /** Let several chips be active at once. Default false — selecting replaces. */
  multiple?: boolean;
  /**
   * The leading chip that clears the selection. Pass a string to relabel it
   * ("All mail"), or `false` to drop it — then deselecting the last chip is the
   * only way back to "everything".
   */
  allLabel?: string | false;
  /** Wrap onto multiple lines instead of scrolling horizontally. */
  wrap?: boolean;
  className?: string;
}

/**
 * A row of toggleable filter chips — the tag/folder/category filter that sits
 * above every filterable list in the lab. Single-select by default (a chip
 * replaces the selection; clicking it again clears it), `multiple` for
 * checkbox-style filtering. Mobile-first: the row scrolls horizontally with no
 * scrollbar unless `wrap` is set.
 *
 * ```tsx
 * <TagFilter
 *   items={folders.map((f) => ({ id: f.id, label: f.name, count: f.unread }))}
 *   value={selected}
 *   onChange={setSelected}
 * />
 * ```
 */
export function TagFilter({
  items,
  value,
  onChange,
  multiple = false,
  allLabel = 'All',
  wrap = false,
  className,
}: TagFilterProps) {
  const toggle = (id: string) => {
    const selected = value.includes(id);
    if (multiple) onChange(selected ? value.filter((v) => v !== id) : [...value, id]);
    else onChange(selected ? [] : [id]);
  };

  const chip = (active: boolean, disabled?: boolean) =>
    cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      active
        ? 'border-transparent bg-primary text-primary-foreground'
        : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
      disabled && 'pointer-events-none opacity-40',
    );

  return (
    <div
      role="group"
      aria-label="Filter"
      className={cn(
        'flex items-center gap-1.5',
        wrap ? 'flex-wrap' : 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {allLabel !== false && (
        <button
          type="button"
          aria-pressed={value.length === 0}
          onClick={() => onChange([])}
          className={chip(value.length === 0)}
        >
          {allLabel}
        </button>
      )}
      {items.map((item) => {
        const active = value.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            disabled={item.disabled}
            onClick={() => toggle(item.id)}
            className={chip(active, item.disabled)}
          >
            {item.label ?? item.id}
            {item.count != null && (
              <span
                className={cn(
                  'mono text-[10px] tabular-nums',
                  active ? 'text-primary-foreground/70' : 'text-muted-foreground/70',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
