import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';

export interface FileEditorMenuItem {
  label: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  /** Display-only shortcut hint, e.g. `'⌘S'`. */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Render a leading checkmark slot (for toggles). */
  checked?: boolean;
}

export type FileEditorMenuEntry = FileEditorMenuItem | 'separator';

export interface FileEditorMenu {
  label: string;
  items: FileEditorMenuEntry[];
}

/**
 * MenuBar — the File/Tools strip of dropdown menus at the top of FileEditor.
 *
 * Menubar semantics: click opens, hover moves between menus while one is
 * open, arrows navigate, Escape/outside click closes. Touch works with plain
 * taps (open, then tap an item).
 */
export function MenuBar({ menus, className }: { menus: FileEditorMenu[]; className?: string }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const [active, setActive] = React.useState(-1);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(null), open !== null);
  useEscape(() => setOpen(null), open !== null);

  const openMenu = (i: number) => {
    setOpen(i);
    setActive(-1);
  };

  const select = (item: FileEditorMenuItem) => {
    if (item.disabled) return;
    setOpen(null);
    item.onSelect?.();
  };

  const enabled = (menu: FileEditorMenu) =>
    menu.items.map((it, idx) => (it !== 'separator' && !it.disabled ? idx : -1)).filter((i) => i >= 0);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const menu = menus[i];
    const ids = enabled(menu);
    if (ids.length === 0) return;
    const move = (dir: 1 | -1) => {
      const pos = ids.indexOf(active);
      const next = pos === -1 ? (dir === 1 ? ids[0] : ids[ids.length - 1]) : ids[(pos + dir + ids.length) % ids.length];
      setActive(next);
    };
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (open !== i) openMenu(i);
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'ArrowRight':
        if (open !== null) {
          e.preventDefault();
          openMenu((i + 1) % menus.length);
        }
        break;
      case 'ArrowLeft':
        if (open !== null) {
          e.preventDefault();
          openMenu((i - 1 + menus.length) % menus.length);
        }
        break;
      case 'Enter':
      case ' ':
        if (open === i && active >= 0) {
          e.preventDefault();
          const item = menu.items[active];
          if (item !== 'separator') select(item);
        }
        break;
    }
  };

  return (
    <div ref={ref} role="menubar" className={cn('flex items-center', className)}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => (open === i ? setOpen(null) : openMenu(i))}
            onPointerEnter={(e) => {
              // Menubar behaviour: once a menu is open, hovering slides it.
              if (open !== null && open !== i && e.pointerType === 'mouse') openMenu(i);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              open === i && 'bg-muted text-foreground',
            )}
          >
            {menu.label}
          </button>
          {open === i && (
            <div
              role="menu"
              className={cn(
                'absolute left-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-lg border border-border',
                'bg-popover py-1 text-popover-foreground shadow-lg',
              )}
            >
              {menu.items.map((item, idx) =>
                item === 'separator' ? (
                  <div key={`sep-${idx}`} role="separator" className="my-1 h-px bg-border" />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => select(item)}
                    onPointerEnter={() => setActive(idx)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      active === idx && !item.disabled && 'bg-muted',
                      item.danger && 'text-destructive',
                    )}
                  >
                    {item.checked !== undefined ? (
                      <Check className={cn('size-3.5 shrink-0', !item.checked && 'invisible')} />
                    ) : (
                      item.icon && <span className="[&_svg]:size-3.5 flex shrink-0">{item.icon}</span>
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-4 shrink-0 text-[11px] text-muted-foreground">{item.shortcut}</span>
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
