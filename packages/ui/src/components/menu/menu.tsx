import * as React from 'react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';
import { useLongPress } from '../../hooks/use-long-press';
import { Modal } from '../modal';
import { Popover, type PopoverAlign, type PopoverSide } from '../popover';

export interface MenuItem {
  id: string;
  label: React.ReactNode;
  /** Leading adornment. */
  icon?: React.ReactNode;
  /** Trailing hint text — a keyboard shortcut, a count. Display only. */
  shortcut?: string;
  disabled?: boolean;
  /** Destructive tone — delete, remove, discard. */
  danger?: boolean;
  onSelect?: () => void;
}

export interface MenuSeparatorEntry {
  type: 'separator';
  id?: string;
}

export type MenuEntry = MenuItem | MenuSeparatorEntry;

function isSeparator(entry: MenuEntry): entry is MenuSeparatorEntry {
  return 'type' in entry && entry.type === 'separator';
}

function firstEnabled(items: ReadonlyArray<MenuEntry>): number {
  return items.findIndex((e) => !isSeparator(e) && !e.disabled);
}

interface MenuListProps {
  items: ReadonlyArray<MenuEntry>;
  onClose: () => void;
  label?: string;
  id?: string;
  autoFocus?: boolean;
  className?: string;
}

/** The shared list: keyboard nav (arrows/Home/End/Enter), hover-tracked
 *  active item, separators — reused by both {@link Menu} and
 *  {@link ContextMenu} so the two only differ in how the panel is anchored. */
function MenuList({ items, onClose, label, id, autoFocus = true, className }: MenuListProps) {
  const [active, setActive] = React.useState(() => firstEnabled(items));
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoFocus) rootRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  React.useEffect(() => {
    if (active < 0) return;
    rootRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  /** Next enabled, non-separator index from `from` in `dir`, or `from` if none. */
  const move = (from: number, dir: 1 | -1) => {
    let i = from;
    do i += dir;
    while (i >= 0 && i < items.length && (isSeparator(items[i]) || (items[i] as MenuItem).disabled));
    return i >= 0 && i < items.length ? i : from;
  };

  const select = (entry: MenuEntry) => {
    if (isSeparator(entry) || entry.disabled) return;
    entry.onSelect?.();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => move(i, e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(move(-1, 1));
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(move(items.length, -1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (active >= 0 && active < items.length) select(items[active]);
    }
  };

  return (
    <div
      ref={rootRef}
      role="menu"
      id={id}
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn('flex max-h-80 flex-col gap-0.5 overflow-y-auto overscroll-contain outline-none', className)}
    >
      {items.map((entry, i) =>
        isSeparator(entry) ? (
          <div key={entry.id ?? `sep-${i}`} role="separator" className="my-1 h-px shrink-0 bg-border" />
        ) : (
          <div
            key={entry.id}
            role="menuitem"
            data-index={i}
            aria-disabled={entry.disabled || undefined}
            onPointerMove={() => !entry.disabled && setActive(i)}
            onClick={() => select(entry)}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm md:py-1.5',
              entry.disabled && 'pointer-events-none opacity-40',
              entry.danger ? 'text-destructive' : undefined,
              i === active && (entry.danger ? 'bg-destructive/15' : 'bg-accent text-accent-foreground'),
            )}
          >
            {entry.icon && <span className="shrink-0 [&_svg]:size-4">{entry.icon}</span>}
            <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>
            {entry.shortcut && (
              <span className="shrink-0 text-xs text-muted-foreground">{entry.shortcut}</span>
            )}
          </div>
        ),
      )}
    </div>
  );
}

export interface MenuProps {
  /** The element that opens the menu on click. */
  trigger: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    onClick?: React.MouseEventHandler;
    'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
  }>;
  items: ReadonlyArray<MenuEntry>;
  /** Preferred side; flips to the opposite when it doesn't fit the viewport. */
  side?: PopoverSide;
  align?: PopoverAlign;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Open as a bottom sheet instead of an anchored panel. Default: sheet
   *  below the `md` breakpoint, anchored panel beyond — same split as `Select`. */
  sheet?: boolean;
  /** Accessible name for the menu — also the sheet title on phones. */
  label?: string;
  className?: string;
}

/**
 * A click-triggered dropdown menu — actions, not navigation (for a link list,
 * reach for {@link Popover} directly). Built on `Popover` for anchoring, viewport
 * side-flip and the phone bottom sheet, with arrow-key navigation, separators,
 * disabled and destructive (`danger`) items on top.
 *
 * @summary Click-triggered dropdown menu of actions — arrow-key nav, separators,
 * disabled/danger items; anchored on desktop, a bottom sheet on phones.
 */
export function Menu({
  trigger,
  items,
  side = 'bottom',
  align = 'start',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  sheet,
  label,
  className,
}: MenuProps) {
  const [own, setOwn] = React.useState(defaultOpen);
  const open = openProp !== undefined ? openProp : own;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwn(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  return (
    <Popover
      trigger={trigger}
      side={side}
      align={align}
      open={open}
      onOpenChange={setOpen}
      sheet={sheet}
      label={label}
      className={cn('p-1', className)}
    >
      <MenuList items={items} onClose={() => setOpen(false)} label={label} />
    </Popover>
  );
}

const CONTEXT_MENU_GAP = 4;

/** Clamp a menu panel anchored at a pointer point so it stays on screen —
 *  flips to open leftward/upward from the point when it would overflow. */
function clampToPoint(
  point: { x: number; y: number },
  size: { width: number; height: number },
): { left: number; top: number } {
  const maxLeft = window.innerWidth - size.width - CONTEXT_MENU_GAP;
  const maxTop = window.innerHeight - size.height - CONTEXT_MENU_GAP;
  return {
    left: Math.max(CONTEXT_MENU_GAP, Math.min(point.x, maxLeft)),
    top: Math.max(CONTEXT_MENU_GAP, Math.min(point.y, maxTop)),
  };
}

export interface ContextMenuProps {
  /** The area that opens the menu on right-click (desktop) or long-press
   *  (touch) — a card, a list row, a canvas object. Keep it a normal
   *  block-level element; it's cloned with the gesture handlers, not
   *  wrapped in an extra box. */
  children: React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
  items: ReadonlyArray<MenuEntry>;
  /** Accessible name for the menu — also the sheet title on phones. */
  label?: string;
  /** Long-press delay on touch, ms — see `useLongPress`. */
  delay?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * A right-click (desktop) or long-press (touch) menu anchored at the pointer,
 * instead of a trigger element — for actions on a card, row or canvas object
 * rather than a toolbar button. Clamped to the viewport on desktop; on phones
 * it opens as a bottom sheet, same as {@link Menu}, since a point-anchored
 * panel would fight a finger's own reach.
 *
 * @summary Right-click / long-press menu anchored at the pointer; a bottom
 * sheet on phones.
 */
export function ContextMenu({ children, items, label, delay, disabled, className }: ContextMenuProps) {
  const [point, setPoint] = React.useState<{ x: number; y: number } | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const id = React.useId();

  const isMobile = useIsMobile();
  const asSheet = isMobile;
  const open = point !== null;

  const close = React.useCallback(() => {
    setPoint(null);
    setPos(null);
  }, []);

  const outsideRef = useOutsideClick<HTMLDivElement>(close, open && !asSheet);
  useEscape(close, open);

  React.useLayoutEffect(() => {
    if (!open || asSheet || !point) return;
    const p = panelRef.current?.getBoundingClientRect();
    setPos(clampToPoint(point, { width: p?.width ?? 0, height: p?.height ?? 0 }));
  }, [open, asSheet, point]);

  const childOnClick = (children.props as { onClick?: React.MouseEventHandler }).onClick;
  const longPress = useLongPress((p) => !disabled && setPoint(p), {
    delay,
    contextMenu: !disabled,
    onClick: childOnClick,
  });

  const clone = React.cloneElement(children, {
    ...(disabled ? { onClick: childOnClick } : longPress),
    ref: (node: HTMLElement | null) => {
      const ref = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') (ref as React.RefObject<HTMLElement | null>).current = node;
    },
  });

  const left = pos?.left ?? point?.x ?? 0;
  const top = pos?.top ?? point?.y ?? 0;

  return (
    <div ref={outsideRef} style={{ display: 'contents' }}>
      {clone}
      {open &&
        (asSheet ? (
          <Modal open onClose={close} title={label} hideHeader={!label} size="sm">
            <MenuList items={items} onClose={close} label={label} id={id} />
          </Modal>
        ) : (
          <div
            ref={panelRef}
            id={id}
            style={{
              position: 'fixed',
              left,
              top,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={cn(
              'ds-menu-panel z-50 min-w-40 max-w-[min(16rem,90vw)] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg',
              className,
            )}
          >
            <MenuList items={items} onClose={close} label={label} id={`${id}-list`} />
          </div>
        ))}
    </div>
  );
}
