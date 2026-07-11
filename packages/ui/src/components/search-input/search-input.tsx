import * as React from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '../../lib/utils';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Focus on `⌘K` / `Ctrl-K` (and `/`), and show the hint key. */
  shortcut?: boolean;
  className?: string;
}

/**
 * A search field with the leading icon, a clear button, and Escape-to-clear —
 * the input every list in the lab puts above itself. Pairs with `FuzzyList`.
 */
export function SearchInput({
  value,
  onValueChange,
  shortcut = false,
  className,
  placeholder = 'Search…',
  ...props
}: SearchInputProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName ?? '');
      const hotkey = (e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing);
      if (!hotkey) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault(); // don't let it bubble up and close the dialog too
            onValueChange('');
          }
        }}
        className={cn(
          'h-9 w-full rounded-lg border border-border bg-transparent pl-9 text-sm outline-none transition-colors',
          'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
          '[&::-webkit-search-cancel-button]:hidden', // we ship our own clear button
          value ? 'pr-9' : shortcut ? 'pr-12' : 'pr-3',
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onValueChange('');
            ref.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut && (
          <kbd className="pointer-events-none absolute right-2.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        )
      )}
    </div>
  );
}
