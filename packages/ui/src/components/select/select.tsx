import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';
import { Modal } from '../modal';

export interface SelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Plain text used for search filtering when `label` isn't a string. */
  text?: string;
  /** Muted second line in the list. */
  description?: React.ReactNode;
  disabled?: boolean;
  /** Leading adornment — an icon, a swatch, an avatar. */
  icon?: React.ReactNode;
}

export interface SelectProps<T extends string = string> {
  options: ReadonlyArray<SelectOption<T>>;
  /** Controlled value. Pair with `onValueChange`. */
  value?: T | null;
  /** Uncontrolled initial value. */
  defaultValue?: T | null;
  onValueChange?: (value: T) => void;
  placeholder?: React.ReactNode;
  /**
   * Show a filter input above the options. Default: on once the list
   * outgrows a screenful (more than 7 options).
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  /**
   * Accessible name for the trigger and the listbox — also the sheet title
   * on phones.
   */
  label?: string;
  /**
   * Open as a bottom sheet instead of an anchored dropdown. Default: sheet
   * below the `md` breakpoint, dropdown beyond.
   */
  sheet?: boolean;
  /** Class for the trigger button. */
  className?: string;
  /** Class for the dropdown/sheet option list. */
  listClassName?: string;
}

function optionText(o: SelectOption): string {
  return o.text ?? (typeof o.label === 'string' ? o.label : o.value);
}

/**
 * The searchable select every project rebuilds from a bare `<select>` or a
 * hand-rolled popover. One API, two shapes: an anchored dropdown with
 * keyboard navigation on desktop, a scrim-and-sheet picker on phones (via
 * {@link Modal}, so Escape, scroll-lock and focus return come for free).
 * Options carry optional icons and descriptions; filtering matches the
 * option's text.
 *
 * @summary Select that becomes a searchable list on desktop and a bottom sheet on
 * phones; supports per-option icons.
 */
export function Select<T extends string = string>({
  options,
  value,
  defaultValue = null,
  onValueChange,
  placeholder = 'Select…',
  searchable,
  searchPlaceholder = 'Filter…',
  disabled,
  label,
  sheet,
  className,
  listClassName,
}: SelectProps<T>) {
  const [own, setOwn] = React.useState<T | null>(defaultValue);
  const selected = value !== undefined ? value : own;
  const current = options.find((o) => o.value === selected);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(-1);
  const id = React.useId();
  const trigger = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const asSheet = sheet ?? isMobile;
  const withSearch = searchable ?? options.length > 7;

  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => optionText(o).toLowerCase().includes(q)) : options;

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(-1);
  }, []);

  const outside = useOutsideClick<HTMLDivElement>(close, open && !asSheet);
  useEscape(() => {
    close();
    trigger.current?.focus({ preventScroll: true });
  }, open && !asSheet);

  const openUp = () => {
    if (disabled) return;
    setOpen(true);
    const i = visible.findIndex((o) => o.value === selected && !o.disabled);
    setActive(i >= 0 ? i : visible.findIndex((o) => !o.disabled));
  };

  const pick = (option: SelectOption<T>) => {
    if (option.disabled) return;
    if (value === undefined) setOwn(option.value);
    onValueChange?.(option.value);
    close();
    if (!asSheet) trigger.current?.focus({ preventScroll: true });
  };

  /** Next enabled index from `from` in `dir`, or `from` if none. */
  const move = (from: number, dir: 1 | -1) => {
    let i = from;
    do i += dir;
    while (i >= 0 && i < visible.length && visible[i].disabled);
    return i >= 0 && i < visible.length ? i : from;
  };

  // Keep the active option in view as the keyboard walks the list.
  React.useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openUp();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => move(i, e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Home' || e.key === 'End') {
      if (withSearch && e.currentTarget instanceof HTMLInputElement) return;
      e.preventDefault();
      const first = visible.findIndex((o) => !o.disabled);
      setActive(e.key === 'Home' ? first : move(visible.length, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < visible.length) pick(visible[active]);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const search = withSearch && (
    <input
      autoFocus
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        setActive(0);
      }}
      onKeyDown={onKeyDown}
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
      className="h-9 w-full border-b border-border bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
    />
  );

  const list = (
    <div
      ref={listRef}
      role="listbox"
      id={`${id}-list`}
      aria-label={label}
      className={cn('overflow-y-auto overscroll-contain p-1', listClassName)}
    >
      {visible.length === 0 && (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
      )}
      {visible.map((option, i) => (
        <div
          key={option.value}
          role="option"
          id={`${id}-opt-${i}`}
          data-index={i}
          aria-selected={option.value === selected}
          aria-disabled={option.disabled || undefined}
          onPointerMove={() => !option.disabled && setActive(i)}
          onClick={() => pick(option)}
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm md:py-1.5',
            option.disabled && 'pointer-events-none opacity-40',
            i === active && 'bg-accent text-accent-foreground',
          )}
        >
          {option.icon && <span className="shrink-0 text-muted-foreground">{option.icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{option.label}</span>
            {option.description && (
              <span className="block truncate text-xs text-muted-foreground">
                {option.description}
              </span>
            )}
          </span>
          {option.value === selected && <Check aria-hidden className="size-4 shrink-0" />}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={outside} className="relative w-full min-w-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={label}
        onClick={() => (open ? close() : openUp())}
        onKeyDown={asSheet ? undefined : onKeyDown}
        className={cn(
          'flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 md:text-sm',
          className,
        )}
      >
        {current?.icon && <span className="shrink-0 text-muted-foreground">{current.icon}</span>}
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-muted-foreground')}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {asSheet ? (
        <Modal open={open} onClose={close} title={label} hideHeader={!label} size="sm" bodyClassName="flex min-h-0 flex-col">
          {search}
          {list}
        </Modal>
      ) : (
        open && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 flex max-h-72 flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
            {search}
            {list}
          </div>
        )
      )}
    </div>
  );
}
