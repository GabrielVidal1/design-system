import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils';
import { useDockContext, type FloatingGeom, type PanelPlacement } from './dock-context';

const MIN_W = 280;
const MIN_H = 160;
const DRAG_THRESHOLD = 5; // px a docked tab must travel before it pops out

/** Imperative handle exposed via {@link FloatingPanelProps.apiRef}. */
export interface FloatingPanelHandle {
  /** Pop the panel out to a free-floating window. */
  float: () => void;
  /** Snap the panel back into a dock (defaults to its home `dockId`). */
  dock: (dockId?: string) => void;
  /** Float if docked, dock if floating. */
  toggle: () => void;
  /** Close the panel — it stays registered, reopenable from its dock's "+". */
  close: () => void;
  /** Reopen a closed panel where it was before. */
  open: () => void;
  /** Move/resize the floating box. */
  setGeom: (geom: Partial<FloatingGeom>) => void;
  isDocked: () => boolean;
  isClosed: () => boolean;
}

export interface FloatingPanelProps {
  /** Stable id — required so a {@link DockProvider} can track this panel. */
  id: string;
  /** Title shown in the header and the dock tab. */
  title?: ReactNode;
  /** Small icon shown before the title (header + tab). */
  icon?: ReactNode;
  children: ReactNode;
  /**
   * Home dock id. Enables docking (drag the header onto any {@link Dock} to
   * snap in; drag a tab out to float). Requires a {@link DockProvider} ancestor.
   */
  dockId?: string;
  /** Start docked in `dockId`. @default `true` when `dockId` is set, else `false` */
  defaultDocked?: boolean;
  /**
   * Let the panel close itself: the close button puts it in the `closed`
   * placement instead of leaving it to the parent to unmount. It stays
   * registered, so its dock's **"+"** button brings it back. Without this, a
   * close button only fires {@link onClose} and the parent decides what happens.
   */
  closable?: boolean;
  /** Start closed (needs `closable`) — the panel is only its "+" entry. */
  defaultClosed?: boolean;
  /**
   * Keep `children` mounted (hidden) while closed, so their state survives a
   * close/reopen — a half-typed message in a composer, say. Off by default: a
   * closed panel usually should stop doing whatever it was doing.
   */
  keepMounted?: boolean;
  /** Plain-text name, used for the "+" button's tooltip. Falls back to a string `title`. */
  label?: string;
  /** Initial floating box; unset fields fall back to a bottom-right default. */
  defaultGeom?: Partial<FloatingGeom>;
  minWidth?: number;
  minHeight?: number;
  /** Allow edge/corner resizing while floating. @default true */
  resizable?: boolean;
  /** Allow header dragging. @default true */
  draggable?: boolean;
  /** Show a close button. Fired on close — with `closable`, after the panel closes itself. */
  onClose?: () => void;
  /** Extra header controls, rendered before the dock/close buttons. */
  actions?: ReactNode;
  /** Fired whenever the placement changes (float ⇄ dock, move, resize). */
  onPlacementChange?: (placement: PanelPlacement) => void;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  apiRef?: Ref<FloatingPanelHandle>;
}

function clampGeom(g: FloatingGeom, minW: number, minH: number): FloatingGeom {
  if (typeof window === 'undefined') return g;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(minW, Math.min(g.width, vw));
  const height = Math.max(minH, Math.min(g.height, vh));
  const x = Math.max(0, Math.min(g.x, vw - width));
  const y = Math.max(0, Math.min(g.y, vh - height));
  return { x, y, width, height };
}

function seedGeom(defaults: Partial<FloatingGeom> | undefined, minW: number, minH: number): FloatingGeom {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const width = defaults?.width ?? Math.min(560, vw - 48);
  const height = defaults?.height ?? Math.min(380, vh - 48);
  const x = defaults?.x ?? vw - width - 24;
  const y = defaults?.y ?? vh - height - 24;
  return clampGeom({ x, y, width, height }, minW, minH);
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const RESIZE_HANDLES: { edge: ResizeEdge; cursor: string; style: CSSProperties }[] = [
  { edge: 'n', cursor: 'ns-resize', style: { top: -3, left: 8, right: 8, height: 7 } },
  { edge: 's', cursor: 'ns-resize', style: { bottom: -3, left: 8, right: 8, height: 7 } },
  { edge: 'e', cursor: 'ew-resize', style: { right: -3, top: 8, bottom: 8, width: 7 } },
  { edge: 'w', cursor: 'ew-resize', style: { left: -3, top: 8, bottom: 8, width: 7 } },
  { edge: 'ne', cursor: 'nesw-resize', style: { top: -4, right: -4, width: 12, height: 12 } },
  { edge: 'nw', cursor: 'nwse-resize', style: { top: -4, left: -4, width: 12, height: 12 } },
  { edge: 'se', cursor: 'nwse-resize', style: { bottom: -4, right: -4, width: 14, height: 14 } },
  { edge: 'sw', cursor: 'nesw-resize', style: { bottom: -4, left: -4, width: 12, height: 12 } },
];

/**
 * A draggable, resizable floating window that can also **dock** into a
 * {@link Dock}. Drag the header onto a dock's drop area to snap in; drag its tab
 * back out to float again. Multiple panels sharing one dock become tabs.
 *
 * With `closable`, a panel also closes like a tab: it stays mounted and
 * registered, and its dock grows a **"+"** button that brings it back — so the
 * parent no longer has to keep an `isOpen` flag per panel, and a closed panel
 * can never become unreachable.
 *
 * Works standalone (no {@link DockProvider}) as a plain floating window, or —
 * inside a provider, with a `dockId` — as a dockable panel. The children keep
 * their React state across float ⇄ dock (the DOM node moves via a portal, the
 * component instances do not remount); across close ⇄ open only with
 * `keepMounted`.
 *
 * ```tsx
 * <DockProvider>
 *   <FloatingPanel id="terminal" dockId="bottom" title="Terminal" closable>
 *     <TerminalBody />
 *   </FloatingPanel>
 *   <Dock id="bottom" className="h-64" />
 * </DockProvider>
 * ```
 */
export function FloatingPanel({
  id,
  title,
  icon,
  children,
  dockId,
  defaultDocked,
  closable,
  defaultClosed,
  keepMounted,
  label,
  defaultGeom,
  minWidth = MIN_W,
  minHeight = MIN_H,
  resizable = true,
  draggable = true,
  onClose,
  actions,
  onPlacementChange,
  className,
  headerClassName,
  bodyClassName,
  apiRef,
}: FloatingPanelProps) {
  const dockCtx = useDockContext();
  const canDock = !!dockCtx && !!dockId;
  const name = label ?? (typeof title === 'string' ? title : undefined);

  const initialPlacement = useMemo<PanelPlacement>(() => {
    if (defaultClosed) return { mode: 'closed', dockId };
    const docked = defaultDocked ?? !!dockId;
    if (canDock && docked && dockId) return { mode: 'docked', dockId };
    return { mode: 'floating', ...seedGeom(defaultGeom, minWidth, minHeight) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Placement: owned by the provider when there is one, else local.
  const [localPlacement, setLocalPlacement] = useState<PanelPlacement>(initialPlacement);
  const placement = (dockCtx ? dockCtx.getPlacement(id) : undefined) ?? localPlacement;

  const applyPlacement = useCallback(
    (next: PanelPlacement) => {
      if (dockCtx) dockCtx.setPlacement(id, next);
      else setLocalPlacement(next);
    },
    [dockCtx, id],
  );

  // Register with the provider once so it appears in dock tab order.
  useEffect(() => {
    if (!dockCtx) return;
    dockCtx.registerPanel(id, initialPlacement, { homeDockId: dockId, label: name });
    return () => dockCtx.unregisterPanel(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report placement changes from any source — our own drag, or the dock's "+".
  const notified = useRef<PanelPlacement | null>(null);
  useEffect(() => {
    if (notified.current === null) {
      notified.current = placement; // initial placement is not a change
      return;
    }
    if (notified.current === placement) return;
    notified.current = placement;
    onPlacementChange?.(placement);
  }, [placement, onPlacementChange]);

  // Last floating box, so docking then re-floating restores size/position.
  const lastGeom = useRef<FloatingGeom>(
    placement.mode === 'floating' ? placement : seedGeom(defaultGeom, minWidth, minHeight),
  );
  if (placement.mode === 'floating') lastGeom.current = placement;

  // Last non-closed placement, so reopening puts the panel back where it was.
  const lastOpen = useRef<PanelPlacement | null>(
    initialPlacement.mode === 'closed' ? null : initialPlacement,
  );
  if (placement.mode !== 'closed') lastOpen.current = placement;

  const floatTo = useCallback(
    (geom?: Partial<FloatingGeom>) => {
      const base = { ...lastGeom.current, ...geom };
      applyPlacement({ mode: 'floating', ...clampGeom(base, minWidth, minHeight) });
    },
    [applyPlacement, minWidth, minHeight],
  );

  const dockTo = useCallback(
    (target?: string) => {
      const t = target ?? dockId;
      if (!t) return;
      applyPlacement({ mode: 'docked', dockId: t });
    },
    [applyPlacement, dockId],
  );

  const closeSelf = useCallback(() => {
    if (closable) applyPlacement({ mode: 'closed', dockId });
    onClose?.();
  }, [closable, applyPlacement, dockId, onClose]);

  const openSelf = useCallback(() => {
    const prev = lastOpen.current;
    if (prev && prev.mode !== 'closed') applyPlacement(prev);
    else if (canDock && dockId) dockTo(dockId);
    else floatTo();
  }, [applyPlacement, canDock, dockId, dockTo, floatTo]);

  useImperativeHandle(
    apiRef,
    () => ({
      float: () => floatTo(),
      dock: (d?: string) => dockTo(d),
      toggle: () => (placement.mode === 'docked' ? floatTo() : dockTo()),
      close: () => applyPlacement({ mode: 'closed', dockId }),
      open: () => openSelf(),
      setGeom: (g: Partial<FloatingGeom>) => floatTo(g),
      isDocked: () => placement.mode === 'docked',
      isClosed: () => placement.mode === 'closed',
    }),
    [floatTo, dockTo, applyPlacement, dockId, openSelf, placement.mode],
  );

  // Keep floating box on-screen when the viewport shrinks.
  useEffect(() => {
    if (placement.mode !== 'floating') return;
    const onResize = () => {
      const c = clampGeom(placement, minWidth, minHeight);
      if (c.x !== placement.x || c.y !== placement.y || c.width !== placement.width || c.height !== placement.height) {
        applyPlacement({ mode: 'floating', ...c });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [placement, applyPlacement, minWidth, minHeight]);

  // ---- Drag / resize gesture ------------------------------------------------
  const gesture = useRef<{
    cleanup: () => void;
  } | null>(null);
  useEffect(() => () => gesture.current?.cleanup(), []);

  const beginMove = useCallback(
    (e: React.PointerEvent, opts?: { fromDockTab?: boolean }) => {
      if (!draggable) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      // Floating box at gesture start (float now if popping out of a tab).
      let origin: FloatingGeom;
      let floating = placement.mode === 'floating';
      if (placement.mode === 'floating') {
        origin = placement;
      } else {
        // Popping out: place the window under the cursor.
        origin = clampGeom(
          { ...lastGeom.current, x: startX - 60, y: startY - 14 },
          minWidth,
          minHeight,
        );
      }

      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!floating) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // still a click on the tab
          floating = true;
          applyPlacement({ mode: 'floating', ...origin });
        }
        const next = clampGeom({ ...origin, x: origin.x + dx, y: origin.y + dy }, minWidth, minHeight);
        applyPlacement({ mode: 'floating', ...next });
        if (canDock) dockCtx!.setHoverDock(dockCtx!.findDockAt(ev.clientX, ev.clientY));
      };
      const onUp = (ev: PointerEvent) => {
        cleanup();
        if (canDock) {
          const target = dockCtx!.findDockAt(ev.clientX, ev.clientY);
          dockCtx!.setHoverDock(null);
          if (floating && target) {
            dockTo(target);
            return;
          }
          if (!floating && opts?.fromDockTab) {
            // A plain click on an inactive tab: activate it, stay docked.
            if (placement.mode === 'docked') dockCtx!.setActive(placement.dockId, id);
          }
        }
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        gesture.current = null;
      };
      gesture.current = { cleanup };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [draggable, placement, applyPlacement, canDock, dockCtx, dockTo, id, minWidth, minHeight],
  );

  const beginResize = useCallback(
    (e: React.PointerEvent, edge: ResizeEdge) => {
      if (!resizable || placement.mode !== 'floating') return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = placement;
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let { x, y, width, height } = origin;
        if (edge.includes('e')) width = origin.width + dx;
        if (edge.includes('s')) height = origin.height + dy;
        if (edge.includes('w')) {
          width = origin.width - dx;
          x = origin.x + dx;
          if (width < minWidth) x = origin.x + (origin.width - minWidth);
        }
        if (edge.includes('n')) {
          height = origin.height - dy;
          y = origin.y + dy;
          if (height < minHeight) y = origin.y + (origin.height - minHeight);
        }
        applyPlacement({ mode: 'floating', ...clampGeom({ x, y, width, height }, minWidth, minHeight) });
      };
      const onUp = () => cleanup();
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        gesture.current = null;
      };
      gesture.current = { cleanup };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [resizable, placement, applyPlacement, minWidth, minHeight],
  );

  // ---- Body holder ---------------------------------------------------------
  // The body lives in one detached div that is *moved* between mount points
  // (dock content, floating window, nowhere while closed). Because the portal
  // container never changes identity, React never remounts `children`: their
  // state survives float ⇄ dock, and — with `keepMounted` — close ⇄ open too.
  const holderRef = useRef<HTMLDivElement | null>(null);
  if (holderRef.current === null && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;min-height:0;height:100%;width:100%';
    holderRef.current = el;
  }
  const holder = holderRef.current;

  /** Adopt the holder into whichever mount point the current placement renders. */
  const mountBody = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && holder && holder.parentNode !== node) node.appendChild(holder);
    },
    [holder],
  );

  const bodyPortal =
    holder && (placement.mode !== 'closed' || keepMounted)
      ? createPortal(children, holder)
      : null;

  // ---- Header (shared by floating chrome and dock tab-active bar) -----------
  const closeButton = (closable || onClose) && (
    <button
      type="button"
      aria-label="Close"
      onClick={closeSelf}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <CloseIcon />
    </button>
  );

  const headerControls = (
    <>
      {actions}
      {canDock &&
        (placement.mode === 'docked' ? (
          <button
            type="button"
            aria-label="Pop out"
            onPointerDown={(e) => beginMove(e)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <PopOutIcon />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Dock"
            onClick={() => dockTo()}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <DockIcon />
          </button>
        ))}
      {closeButton}
    </>
  );

  // ---- Chrome per placement. The body portal is rendered once, below, so the
  // ---- children never remount as the panel moves between placements. -------
  let chrome: ReactNode = null;

  // Closed: nothing on screen but an entry in its dock's "+" menu.
  if (placement.mode === 'closed') {
    const dock = placement.dockId ? dockCtx?.getDock(placement.dockId) : undefined;
    chrome = dock?.menu
      ? createPortal(
          <button
            type="button"
            role="menuitem"
            onClick={() => dockCtx!.openPanel(id, placement.dockId)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
          >
            {icon}
            <span className="truncate">{title ?? name ?? id}</span>
          </button>,
          dock.menu,
        )
      : null;
  }

  // Docked: portal a tab, and — if active — the body mount, into the dock.
  else if (placement.mode === 'docked' && canDock) {
    const dock = dockCtx!.getDock(placement.dockId);
    const isActive = dockCtx!.activeInDock(placement.dockId) === id;
    const showTab = dockCtx!.dockShowsTabs(placement.dockId); // else: lone panel, own header
    chrome = (
      <>
        {dock?.tabBar &&
          createPortal(
            <div
              data-active={isActive}
              className={cn(
                'flex shrink-0 items-center border-b-2 transition-colors',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
                !showTab && 'hidden',
              )}
            >
              <button
                type="button"
                onPointerDown={(e) => beginMove(e, { fromDockTab: true })}
                className={cn(
                  'flex items-center gap-1.5 py-1.5 pl-3 text-xs font-medium',
                  'touch-none select-none',
                  closable ? 'pr-1' : 'pr-3',
                  !isActive && 'hover:text-foreground',
                )}
              >
                {icon}
                <span className="max-w-[16ch] truncate">{title}</span>
              </button>
              {closable && (
                <button
                  type="button"
                  aria-label={`Close ${name ?? 'panel'}`}
                  onClick={closeSelf}
                  className="mr-1.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <CloseIcon />
                </button>
              )}
            </div>,
            dock.tabBar,
          )}
        {dock?.content &&
          isActive &&
          createPortal(
            <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
              {!showTab && (title || headerControls) && (
                <div
                  onPointerDown={(e) => beginMove(e)}
                  className={cn(
                    'flex shrink-0 cursor-move touch-none items-center gap-1.5 border-b border-border px-2 py-1',
                    headerClassName,
                  )}
                >
                  {icon}
                  <span className="flex-1 truncate text-xs font-medium">{title}</span>
                  {headerControls}
                </div>
              )}
              <div
                ref={mountBody}
                className={cn('min-h-0 flex-1 overflow-hidden', bodyClassName)}
              />
            </div>,
            dock.content,
          )}
      </>
    );
  }

  // ---- Floating rendering: portal a fixed window to <body> ------------------
  const win = placement.mode !== 'floating' ? null : (
    <div
      role="dialog"
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl',
        'ring-1 ring-black/5',
        className,
      )}
      style={{ left: placement.x, top: placement.y, width: placement.width, height: placement.height }}
    >
      <div
        onPointerDown={(e) => beginMove(e)}
        className={cn(
          'flex shrink-0 cursor-move touch-none items-center gap-1.5 border-b border-border bg-muted/40 px-2 py-1.5',
          headerClassName,
        )}
      >
        {icon}
        <span className="flex-1 truncate text-xs font-medium">{title}</span>
        {headerControls}
      </div>
      <div ref={mountBody} className={cn('min-h-0 flex-1 overflow-hidden', bodyClassName)} />
      {resizable &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.edge}
            onPointerDown={(e) => beginResize(e, h.edge)}
            className="absolute touch-none"
            style={{ ...h.style, cursor: h.cursor }}
          />
        ))}
    </div>
  );

  if (win) chrome = typeof document !== 'undefined' ? createPortal(win, document.body) : win;

  // `bodyPortal` first and unconditional: its container (the holder) is stable,
  // so React keeps `children` mounted no matter which chrome renders around it.
  return (
    <>
      {bodyPortal}
      {chrome}
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function DockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 8h10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function PopOutIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4.5 2H2v8h8V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 2h3v3M10 2L5.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
