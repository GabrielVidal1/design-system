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
  className?: string;
  /** Class for the tab strip (shown only when 2+ panels share the dock). */
  tabBarClassName?: string;
  /** Class for the panel-body region. */
  contentClassName?: string;
}

/**
 * A docking target: a bounded region a {@link FloatingPanel} can snap into.
 * When one panel is docked it fills the dock; when several share the dock they
 * become tabs across the top and only the active one's body is shown.
 *
 * Must be rendered inside a {@link DockProvider} together with the panels that
 * target it. While a panel is dragged over the dock it highlights as a drop
 * target.
 */
export function Dock({ id, emptyState, className, tabBarClassName, contentClassName }: DockProps) {
  const ctx = useDockContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);

  // Register the dock (rect for hit-testing) and publish its portal targets.
  useEffect(() => {
    if (!ctx) return;
    ctx.registerDock(id, () => rootRef.current?.getBoundingClientRect() ?? null);
    ctx.updateDockEls(id, { tabBar: tabBarRef.current, content: contentRef.current });
    force((n) => n + 1); // ensure panels see the mounted portal targets
    return () => ctx.unregisterDock(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const members = ctx?.panelsInDock(id) ?? [];
  const hasPanels = members.length > 0;
  const showTabs = members.length > 1;
  const isDropTarget = ctx?.hoverDock === id;

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
        ref={tabBarRef}
        className={cn(
          'flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/40 px-1',
          !showTabs && 'hidden',
          tabBarClassName,
        )}
      />
      <div ref={contentRef} className={cn('relative min-h-0 flex-1 overflow-hidden', contentClassName)} />
      {!hasPanels && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
          {emptyState ?? (isDropTarget ? 'Release to dock here' : 'Drag a panel here to dock it')}
        </div>
      )}
    </div>
  );
}
