import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { useDockContext } from './dock-context';

export interface DockProps {
  /** Stable id — the target `FloatingPanel.dockId` snaps to. */
  id: string;
  /**
   * Shown when no panel is docked here. Give the dock a bounded height via
   * `className` (e.g. `h-64` or `flex-1 min-h-0`) so it can hold a panel body.
   */
  emptyState?: ReactNode;
  /**
   * When to show the tab strip.
   * - `'auto'` — only when it has something to show: two or more tabs, or a "+"
   *   because a panel is closed. A lone panel keeps its own header instead.
   * - `'always'` — keep the strip (and its "+") visible even for a single panel.
   * @default 'auto'
   */
  tabs?: 'auto' | 'always';
  className?: string;
  /** Class for the tab strip row (tabs + the "+" button). */
  tabBarClassName?: string;
  /** Class for the panel-body region. */
  contentClassName?: string;
}

/**
 * A docking target: a bounded region a {@link FloatingPanel} can snap into.
 * When one panel is docked it fills the dock; when several share the dock they
 * become tabs across the top and only the active one's body is shown.
 *
 * Panels docked here can also be **closed** (`FloatingPanel.closable`), which
 * leaves them registered rather than unmounted: the dock grows a **"+"** button
 * that brings them back — directly if only one is closed, through a small menu
 * if several are. A dock whose panels are all closed is just that "+" strip, so
 * there is always a way back in.
 *
 * Must be rendered inside a {@link DockProvider} together with the panels that
 * target it. While a panel is dragged over the dock it highlights as a drop
 * target.
 */
export function Dock({
  id,
  emptyState,
  tabs = 'auto',
  className,
  tabBarClassName,
  contentClassName,
}: DockProps) {
  const ctx = useDockContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, force] = useState(0);

  // Register the dock (rect for hit-testing) and publish its portal targets.
  useEffect(() => {
    if (!ctx) return;
    ctx.registerDock(id, () => rootRef.current?.getBoundingClientRect() ?? null, tabs);
    force((n) => n + 1); // ensure panels see the mounted portal targets
    return () => ctx.unregisterDock(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tabs]);

  const members = ctx?.panelsInDock(id) ?? [];
  const closed = ctx?.closedInDock(id) ?? [];

  // The menu element only exists while open, so republish targets when it flips.
  useEffect(() => {
    if (!ctx) return;
    ctx.updateDockEls(id, {
      tabBar: tabBarRef.current,
      content: contentRef.current,
      menu: menuRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, menuOpen, members.length, closed.length]);

  // Dismiss the menu on an outside press or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!plusRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Opening (or closing) a panel settles the menu.
  useEffect(() => setMenuOpen(false), [closed.length]);

  const hasPanels = members.length > 0;
  const isDropTarget = ctx?.hoverDock === id;
  const canReopen = closed.length > 0;
  // Same rule the panels use to decide tab-vs-own-header (see `dockShowsTabs`).
  const showTabBar = ctx?.dockShowsTabs(id) ?? false;

  const onPlus = () => {
    if (closed.length === 1) ctx?.openPanel(closed[0], id);
    else setMenuOpen((o) => !o);
  };
  const plusTitle =
    closed.length === 1
      ? `Open ${ctx?.getPanelLabel(closed[0]) ?? 'panel'}`
      : 'Open a panel';

  return (
    <div
      ref={rootRef}
      data-dock={id}
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background transition-colors',
        isDropTarget && 'border-primary ring-2 ring-primary/40',
        className,
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-border bg-muted/40',
          !showTabBar && 'hidden',
          tabBarClassName,
        )}
      >
        {/* Docked panels portal their tabs in here. */}
        <div ref={tabBarRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1" />
        {canReopen && (
          <div ref={plusRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={plusTitle}
              aria-haspopup={closed.length > 1 ? 'menu' : undefined}
              aria-expanded={closed.length > 1 ? menuOpen : undefined}
              title={plusTitle}
              onClick={onPlus}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PlusIcon />
            </button>
            {menuOpen && closed.length > 1 && (
              // Closed panels portal their own menu entry in here.
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 flex min-w-40 flex-col gap-0.5 rounded-md border border-border bg-background p-1 shadow-lg"
              />
            )}
          </div>
        )}
      </div>

      <div ref={contentRef} className={cn('relative min-h-0 flex-1 overflow-hidden', contentClassName)}>
        {!hasPanels && !canReopen && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
            {emptyState ?? (isDropTarget ? 'Release to dock here' : 'Drag a panel here to dock it')}
          </div>
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
