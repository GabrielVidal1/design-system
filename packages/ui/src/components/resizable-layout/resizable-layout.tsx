import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';

import { cn } from '../../lib/utils';

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

const HORIZONTAL_SIDES = new Set<DrawerSide>(['left', 'right']);
const isHorizontal = (side: DrawerSide) => HORIZONTAL_SIDES.has(side);

/** Per-drawer configuration. `content` is the whole drawer body (header + list). */
export interface ResizableDrawerConfig {
  /** The drawer's content — including its own header row, if any. */
  content: ReactNode;
  /** Desktop start size, as a percentage of its axis (0–100). */
  defaultSize?: number;
  /** Desktop minimum size before it snaps closed, as a percentage. */
  minSize?: number;
  /** Desktop maximum size, as a percentage. */
  maxSize?: number;
  /**
   * Mobile overlay width, for `left`/`right` drawers. A number is treated as
   * pixels, a string is used verbatim (`'85%'`, `'100%'`, `'320px'`). Defaults
   * to `'85%'`.
   */
  mobileWidth?: string | number;
  /**
   * Mobile overlay height, for `top`/`bottom` drawers. A number is treated as
   * pixels, a string is used verbatim. Defaults to `'45%'`.
   */
  mobileHeight?: string | number;
  /** Extra classes on the drawer surface (desktop panel + mobile overlay). */
  className?: string;
  /** Allow an in-axis swipe on the drawer to close it on mobile. Default true. */
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
  top?: ResizableDrawerConfig;
  bottom?: ResizableDrawerConfig;
  /** Controlled open state of the left drawer (collapse on desktop, overlay on mobile). */
  leftOpen?: boolean;
  onLeftOpenChange?: (open: boolean) => void;
  rightOpen?: boolean;
  onRightOpenChange?: (open: boolean) => void;
  topOpen?: boolean;
  onTopOpenChange?: (open: boolean) => void;
  bottomOpen?: boolean;
  onBottomOpenChange?: (open: boolean) => void;
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

function sizeStyle(side: DrawerSide, config: ResizableDrawerConfig): CSSProperties {
  if (isHorizontal(side)) {
    const w = config.mobileWidth;
    const value = w == null ? '85%' : typeof w === 'number' ? `${w}px` : w;
    return { width: value, maxWidth: '100%' };
  }
  const h = config.mobileHeight;
  const value = h == null ? '45%' : typeof h === 'number' ? `${h}px` : h;
  return { height: value, maxHeight: '100%' };
}

/**
 * A four-slot application layout — left/right/top/bottom drawers around a
 * scrollable center — that adapts to the viewport:
 *
 * - **Desktop** (≥ `desktopBreakpoint`): the drawers are real shadcn-style
 *   resizable panels (react-resizable-panels). Each can be dragged between
 *   `minSize`/`maxSize`, collapsed completely (to zero) via the handle button
 *   or the imperative ref, and its size is persisted with `autoSaveId`.
 * - **Mobile**: the drawers become fixed, swipeable overlays with a backdrop —
 *   `left`/`right` slide in horizontally, `top`/`bottom` slide in vertically —
 *   each with a per-side custom `mobileWidth`/`mobileHeight`, exactly like a
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
      top,
      bottom,
      leftOpen = true,
      onLeftOpenChange,
      rightOpen = true,
      onRightOpenChange,
      topOpen = true,
      onTopOpenChange,
      bottomOpen = true,
      onBottomOpenChange,
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
    const topPanel = useRef<ImperativePanelHandle>(null);
    const bottomPanel = useRef<ImperativePanelHandle>(null);

    const openBySide = { left: leftOpen, right: rightOpen, top: topOpen, bottom: bottomOpen };
    const panelBySide = { left: leftPanel, right: rightPanel, top: topPanel, bottom: bottomPanel };
    const configBySide = { left, right, top, bottom };

    const onChange = useCallback(
      (side: DrawerSide, open: boolean) => {
        (
          {
            left: onLeftOpenChange,
            right: onRightOpenChange,
            top: onTopOpenChange,
            bottom: onBottomOpenChange,
          }[side]
        )?.(open);
      },
      [onLeftOpenChange, onRightOpenChange, onTopOpenChange, onBottomOpenChange],
    );

    // Keep each collapsible panel in sync with its controlled `open` prop.
    useEffect(() => {
      (['left', 'right', 'top', 'bottom'] as const).forEach((side) => {
        const p = panelBySide[side].current;
        if (!isDesktop || !p || !configBySide[side]) return;
        const open = openBySide[side];
        if (open && p.isCollapsed()) p.expand();
        else if (!open && p.isExpanded()) p.collapse();
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDesktop, left, right, top, bottom, leftOpen, rightOpen, topOpen, bottomOpen]);

    useImperativeHandle(
      ref,
      () => {
        const panelFor = (s: DrawerSide) => panelBySide[s].current;
        const isCollapsed = (s: DrawerSide) => {
          if (isDesktop) return panelFor(s)?.isCollapsed() ?? true;
          return !openBySide[s];
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isDesktop, leftOpen, rightOpen, topOpen, bottomOpen, onChange],
    );

    // ---- Mobile: fixed swipeable overlays over a full-bleed center ----------
    if (!isDesktop) {
      return (
        <div className={cn('relative flex h-full w-full min-h-0 flex-col overflow-hidden', className)}>
          {top && (
            <MobileDrawer
              side="top"
              config={top}
              open={topOpen}
              onOpenChange={(o) => onChange('top', o)}
            />
          )}
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
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
          {bottom && (
            <MobileDrawer
              side="bottom"
              config={bottom}
              open={bottomOpen}
              onOpenChange={(o) => onChange('bottom', o)}
            />
          )}
        </div>
      );
    }

    // ---- Desktop: resizable panels -----------------------------------------
    const horizontalGroup = (
      <PanelGroup
        direction="horizontal"
        autoSaveId={autoSaveId}
        className="h-full w-full min-h-0"
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

    if (!top && !bottom) {
      return (
        <div className={cn('h-full w-full min-h-0', className)}>{horizontalGroup}</div>
      );
    }

    return (
      <PanelGroup
        direction="vertical"
        autoSaveId={autoSaveId ? `${autoSaveId}:vertical` : undefined}
        className={cn('h-full w-full min-h-0', className)}
      >
        {top && (
          <>
            <Panel
              ref={topPanel}
              order={1}
              collapsible
              collapsedSize={0}
              defaultSize={topOpen ? (top.defaultSize ?? 30) : 0}
              minSize={top.minSize ?? 12}
              maxSize={top.maxSize ?? 60}
              onCollapse={() => onChange('top', false)}
              onExpand={() => onChange('top', true)}
              className={cn('flex min-h-0 flex-col overflow-hidden', top.className)}
            >
              {top.content}
            </Panel>
            <ResizeHandle
              side="top"
              showButton={showCollapseButtons}
              onToggle={() => onChange('top', !topOpen)}
              open={topOpen}
            />
          </>
        )}

        <Panel order={2} minSize={20} className="relative min-h-0 w-full overflow-hidden">
          {horizontalGroup}
        </Panel>

        {bottom && (
          <>
            <ResizeHandle
              side="bottom"
              showButton={showCollapseButtons}
              onToggle={() => onChange('bottom', !bottomOpen)}
              open={bottomOpen}
            />
            <Panel
              ref={bottomPanel}
              order={3}
              collapsible
              collapsedSize={0}
              defaultSize={bottomOpen ? (bottom.defaultSize ?? 30) : 0}
              minSize={bottom.minSize ?? 12}
              maxSize={bottom.maxSize ?? 60}
              onCollapse={() => onChange('bottom', false)}
              onExpand={() => onChange('bottom', true)}
              className={cn('flex min-h-0 flex-col overflow-hidden', bottom.className)}
            >
              {bottom.content}
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
  const collapseIcons: Record<DrawerSide, typeof ChevronLeft> = {
    left: ChevronLeft,
    right: ChevronRight,
    top: ChevronUp,
    bottom: ChevronDown,
  };
  const expandIcons: Record<DrawerSide, typeof ChevronLeft> = {
    left: ChevronRight,
    right: ChevronLeft,
    top: ChevronDown,
    bottom: ChevronUp,
  };
  const Icon = open ? collapseIcons[side] : expandIcons[side];
  const horizontal = isHorizontal(side);

  return (
    <PanelResizeHandle
      className={cn(
        'group relative bg-border transition-colors hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary',
        horizontal ? 'w-px' : 'h-px',
      )}
    >
      {/* widen the hit area without taking layout width/height */}
      <div
        className={cn(
          'absolute z-10',
          horizontal ? 'inset-y-0 -left-1 -right-1' : 'inset-x-0 -top-1 -bottom-1',
        )}
      />
      {showButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title={open ? 'Collapse' : 'Expand'}
          className={cn(
            'absolute z-20 flex items-center justify-center rounded-sm border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100',
            horizontal
              ? cn('top-1/2 h-8 w-4 -translate-y-1/2', side === 'left' ? '-left-2' : '-right-2')
              : cn('left-1/2 h-4 w-8 -translate-x-1/2', side === 'top' ? '-top-2' : '-bottom-2'),
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
  const horizontal = isHorizontal(side);
  const touchPos = useRef<number | null>(null);
  const edgePos = useRef<number | null>(null);
  const swipeClose = config.swipeToClose ?? true;

  const clientPos = (e: TouchEvent) =>
    horizontal ? e.touches[0].clientX : e.touches[0].clientY;

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
          className={cn(
            'fixed z-20',
            horizontal
              ? cn('inset-y-0 w-4', side === 'left' ? 'left-0' : 'right-0')
              : cn('inset-x-0 h-4', side === 'top' ? 'top-0' : 'bottom-0'),
          )}
          onTouchStart={(e) => (edgePos.current = clientPos(e))}
          onTouchMove={(e) => {
            if (edgePos.current === null) return;
            const d = clientPos(e) - edgePos.current;
            const opens =
              (side === 'left' && d > 50) ||
              (side === 'right' && d < -50) ||
              (side === 'top' && d > 50) ||
              (side === 'bottom' && d < -50);
            if (opens) {
              onOpenChange(true);
              edgePos.current = null;
            }
          }}
          onTouchEnd={() => (edgePos.current = null)}
        />
      )}

      <aside
        style={sizeStyle(side, config)}
        onTouchStart={(e) => swipeClose && (touchPos.current = clientPos(e))}
        onTouchMove={(e) => {
          if (!swipeClose || touchPos.current === null) return;
          const d = clientPos(e) - touchPos.current;
          const closes =
            (side === 'left' && d < -60) ||
            (side === 'right' && d > 60) ||
            (side === 'top' && d < -60) ||
            (side === 'bottom' && d > 60);
          if (closes) {
            onOpenChange(false);
            touchPos.current = null;
          }
        }}
        onTouchEnd={() => (touchPos.current = null)}
        className={cn(
          'fixed z-40 flex flex-col bg-card transition-transform duration-200',
          horizontal ? 'inset-y-0' : 'inset-x-0',
          side === 'left' && 'left-0 border-r border-border',
          side === 'right' && 'right-0 border-l border-border',
          side === 'top' && 'top-0 border-b border-border',
          side === 'bottom' && 'bottom-0 border-t border-border',
          open ? 'translate-x-0 translate-y-0' : cn(closedTransform(side), 'pointer-events-none'),
          config.className,
        )}
      >
        {config.content}
      </aside>
    </>
  );
}

function closedTransform(side: DrawerSide): string {
  switch (side) {
    case 'left':
      return '-translate-x-full';
    case 'right':
      return 'translate-x-full';
    case 'top':
      return '-translate-y-full';
    case 'bottom':
      return 'translate-y-full';
  }
}
