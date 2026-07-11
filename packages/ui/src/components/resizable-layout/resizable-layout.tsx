import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';

import { cn } from '../../lib/utils';

export type DrawerSide = 'left' | 'right';

/** Per-drawer configuration. `content` is the whole drawer body (header + list). */
export interface ResizableDrawerConfig {
  /** The drawer's content — including its own header row, if any. */
  content: ReactNode;
  /** Desktop start width, as a percentage of the group (0–100). */
  defaultSize?: number;
  /** Desktop minimum width before it snaps closed, as a percentage. */
  minSize?: number;
  /** Desktop maximum width, as a percentage. */
  maxSize?: number;
  /**
   * Mobile overlay width. A number is treated as pixels, a string is used
   * verbatim (`'85%'`, `'100%'`, `'320px'`). Defaults to `'85%'`.
   */
  mobileWidth?: string | number;
  /** Extra classes on the drawer surface (desktop panel + mobile aside). */
  className?: string;
  /** Allow a horizontal swipe on the drawer to close it on mobile. Default true. */
  swipeToClose?: boolean;
  /** Show an off-screen edge zone that opens the drawer on an inward swipe. Default false. */
  edgeSwipeToOpen?: boolean;
}

export interface ResizableLayoutHandle {
  collapse(side: DrawerSide): void;
  expand(side: DrawerSide): void;
  toggle(side: DrawerSide): void;
  isCollapsed(side: DrawerSide): boolean;
}

export interface ResizableLayoutProps {
  left?: ResizableDrawerConfig;
  right?: ResizableDrawerConfig;
  /** Controlled open state of the left drawer (collapse on desktop, overlay on mobile). */
  leftOpen?: boolean;
  onLeftOpenChange?: (open: boolean) => void;
  rightOpen?: boolean;
  onRightOpenChange?: (open: boolean) => void;
  /** The scrollable center. Give its inner scroll region `min-h-0 flex-1 overflow-y-auto`. */
  children: ReactNode;
  className?: string;
  /** Persist desktop panel sizes under this key (react-resizable-panels autoSaveId). */
  autoSaveId?: string;
  /** Render a collapse/expand toggle on each resize handle (desktop). Default true. */
  showCollapseButtons?: boolean;
  /** Breakpoint (px) at/above which the desktop resizable layout is used. Default 768. */
  desktopBreakpoint?: number;
}

/** True at or above `min` px wide; re-renders on viewport crossing. */
function useMinWidth(min: number): boolean {
  const query = `(min-width: ${min}px)`;
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : true,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function widthStyle(w: string | number | undefined): CSSProperties {
  const value = w == null ? '85%' : typeof w === 'number' ? `${w}px` : w;
  return { width: value, maxWidth: '100%' };
}

/**
 * A three-slot application layout — a left drawer, a scrollable center, and a
 * right drawer — that adapts to the viewport:
 *
 * - **Desktop** (≥ `desktopBreakpoint`): the drawers are real shadcn-style
 *   resizable panels (react-resizable-panels). Each can be dragged to any width
 *   between `minSize`/`maxSize`, collapsed completely (to zero) via the handle
 *   button or the imperative ref, and its size is persisted with `autoSaveId`.
 * - **Mobile**: the drawers become fixed, swipeable overlays with a backdrop and
 *   a per-side custom `mobileWidth` (e.g. `'100%'`, `'320px'`), exactly like a
 *   native slide-in sheet.
 *
 * The center is always a `min-h-0` flex column, so a child with
 * `min-h-0 flex-1 overflow-y-auto` scrolls correctly in both modes — no more
 * "stuck" content.
 *
 * `open` state is controlled per side (`leftOpen`/`onLeftOpenChange`, …). On
 * desktop that maps to collapsed/expanded; on mobile to the slide-in overlay.
 * The imperative handle exposes `collapse`/`expand`/`toggle`/`isCollapsed`.
 */
export const ResizableLayout = forwardRef<ResizableLayoutHandle, ResizableLayoutProps>(
  function ResizableLayout(
    {
      left,
      right,
      leftOpen = true,
      onLeftOpenChange,
      rightOpen = true,
      onRightOpenChange,
      children,
      className,
      autoSaveId,
      showCollapseButtons = true,
      desktopBreakpoint = 768,
    },
    ref,
  ) {
    const isDesktop = useMinWidth(desktopBreakpoint);
    const leftPanel = useRef<ImperativePanelHandle>(null);
    const rightPanel = useRef<ImperativePanelHandle>(null);

    const onChange = useCallback(
      (side: DrawerSide, open: boolean) => {
        (side === 'left' ? onLeftOpenChange : onRightOpenChange)?.(open);
      },
      [onLeftOpenChange, onRightOpenChange],
    );

    // Keep each collapsible panel in sync with its controlled `open` prop.
    useEffect(() => {
      const p = leftPanel.current;
      if (!isDesktop || !p || !left) return;
      if (leftOpen && p.isCollapsed()) p.expand();
      else if (!leftOpen && p.isExpanded()) p.collapse();
    }, [isDesktop, left, leftOpen]);
    useEffect(() => {
      const p = rightPanel.current;
      if (!isDesktop || !p || !right) return;
      if (rightOpen && p.isCollapsed()) p.expand();
      else if (!rightOpen && p.isExpanded()) p.collapse();
    }, [isDesktop, right, rightOpen]);

    useImperativeHandle(
      ref,
      () => {
        const panelFor = (s: DrawerSide) => (s === 'left' ? leftPanel : rightPanel).current;
        const isCollapsed = (s: DrawerSide) => {
          if (isDesktop) return panelFor(s)?.isCollapsed() ?? true;
          return !(s === 'left' ? leftOpen : rightOpen);
        };
        return {
          collapse: (s) => {
            panelFor(s)?.collapse();
            onChange(s, false);
          },
          expand: (s) => {
            panelFor(s)?.expand();
            onChange(s, true);
          },
          toggle: (s) => onChange(s, isCollapsed(s)),
          isCollapsed,
        };
      },
      [isDesktop, leftOpen, rightOpen, onChange],
    );

    // ---- Mobile: fixed swipeable overlays over a full-width center ----------
    if (!isDesktop) {
      return (
        <div className={cn('relative flex h-full w-full min-h-0 overflow-hidden', className)}>
          {left && (
            <MobileDrawer
              side="left"
              config={left}
              open={leftOpen}
              onOpenChange={(o) => onChange('left', o)}
            />
          )}
          <div className="relative grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden">
            {children}
          </div>
          {right && (
            <MobileDrawer
              side="right"
              config={right}
              open={rightOpen}
              onOpenChange={(o) => onChange('right', o)}
            />
          )}
        </div>
      );
    }

    // ---- Desktop: resizable panels -----------------------------------------
    return (
      <PanelGroup
        direction="horizontal"
        autoSaveId={autoSaveId}
        className={cn('h-full w-full min-h-0', className)}
      >
        {left && (
          <>
            <Panel
              ref={leftPanel}
              order={1}
              collapsible
              collapsedSize={0}
              defaultSize={leftOpen ? (left.defaultSize ?? 20) : 0}
              minSize={left.minSize ?? 12}
              maxSize={left.maxSize ?? 40}
              onCollapse={() => onChange('left', false)}
              onExpand={() => onChange('left', true)}
              className={cn('flex min-h-0 flex-col overflow-hidden', left.className)}
            >
              {left.content}
            </Panel>
            <ResizeHandle
              side="left"
              showButton={showCollapseButtons}
              onToggle={() => onChange('left', !leftOpen)}
              open={leftOpen}
            />
          </>
        )}

        <Panel
          order={2}
          minSize={30}
          className="relative grid min-h-0 min-w-0 grid-cols-1 grid-rows-1 overflow-hidden"
        >
          {children}
        </Panel>

        {right && (
          <>
            <ResizeHandle
              side="right"
              showButton={showCollapseButtons}
              onToggle={() => onChange('right', !rightOpen)}
              open={rightOpen}
            />
            <Panel
              ref={rightPanel}
              order={3}
              collapsible
              collapsedSize={0}
              defaultSize={rightOpen ? (right.defaultSize ?? 22) : 0}
              minSize={right.minSize ?? 12}
              maxSize={right.maxSize ?? 45}
              onCollapse={() => onChange('right', false)}
              onExpand={() => onChange('right', true)}
              className={cn('flex min-h-0 flex-col overflow-hidden', right.className)}
            >
              {right.content}
            </Panel>
          </>
        )}
      </PanelGroup>
    );
  },
);

/** A draggable divider with an optional collapse/expand toggle button. */
function ResizeHandle({
  side,
  showButton,
  onToggle,
  open,
}: {
  side: DrawerSide;
  showButton: boolean;
  onToggle: () => void;
  open: boolean;
}) {
  // Which way the chevron points to "put the drawer away".
  const CollapseIcon = side === 'left' ? ChevronLeft : ChevronRight;
  const ExpandIcon = side === 'left' ? ChevronRight : ChevronLeft;
  const Icon = open ? CollapseIcon : ExpandIcon;
  return (
    <PanelResizeHandle className="group relative w-px bg-border transition-colors hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary">
      {/* widen the hit area without taking layout width */}
      <div className="absolute inset-y-0 -left-1 -right-1 z-10" />
      {showButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title={open ? 'Collapse' : 'Expand'}
          className={cn(
            'absolute top-1/2 z-20 flex h-8 w-4 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100',
            side === 'left' ? '-left-2' : '-right-2',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      )}
    </PanelResizeHandle>
  );
}

/** A fixed, swipeable slide-in drawer used on mobile viewports. */
function MobileDrawer({
  side,
  config,
  open,
  onOpenChange,
}: {
  side: DrawerSide;
  config: ResizableDrawerConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const touchX = useRef<number | null>(null);
  const edgeX = useRef<number | null>(null);
  const swipeClose = config.swipeToClose ?? true;

  return (
    <>
      {/* backdrop */}
      <div
        onClick={() => onOpenChange(false)}
        className={cn(
          'fixed inset-0 z-30 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* off-screen edge zone that opens the drawer on an inward swipe */}
      {config.edgeSwipeToOpen && !open && (
        <div
          className={cn('fixed inset-y-0 z-20 w-4', side === 'left' ? 'left-0' : 'right-0')}
          onTouchStart={(e) => (edgeX.current = e.touches[0].clientX)}
          onTouchMove={(e) => {
            if (edgeX.current === null) return;
            const dx = e.touches[0].clientX - edgeX.current;
            if ((side === 'left' && dx > 50) || (side === 'right' && dx < -50)) {
              onOpenChange(true);
              edgeX.current = null;
            }
          }}
          onTouchEnd={() => (edgeX.current = null)}
        />
      )}

      <aside
        style={widthStyle(config.mobileWidth)}
        onTouchStart={(e) => swipeClose && (touchX.current = e.touches[0].clientX)}
        onTouchMove={(e) => {
          if (!swipeClose || touchX.current === null) return;
          const dx = e.touches[0].clientX - touchX.current;
          if ((side === 'left' && dx < -60) || (side === 'right' && dx > 60)) {
            onOpenChange(false);
            touchX.current = null;
          }
        }}
        onTouchEnd={() => (touchX.current = null)}
        className={cn(
          'fixed inset-y-0 z-40 flex flex-col bg-card transition-transform duration-200',
          side === 'left' ? 'left-0 border-r border-border' : 'right-0 border-l border-border',
          open ? 'translate-x-0' : cn(closedX(side), 'pointer-events-none'),
          config.className,
        )}
      >
        {config.content}
      </aside>
    </>
  );
}

function closedX(side: DrawerSide): string {
  return side === 'left' ? '-translate-x-full' : 'translate-x-full';
}
