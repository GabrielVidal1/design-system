import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** A floating window's on-screen box, in viewport pixels. */
export interface FloatingGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a panel currently lives: free-floating at a viewport box, docked
 * (in-flow) inside a {@link Dock}, or closed — still registered (so its dock's
 * "+" button can bring it back) but rendering nothing.
 */
export type PanelPlacement =
  | ({ mode: 'floating' } & FloatingGeom)
  | { mode: 'docked'; dockId: string }
  | { mode: 'closed'; dockId?: string };

interface DockEntry {
  id: string;
  /** Live viewport rect of the dock's drop area (for hit-testing a drag). */
  getRect: () => DOMRect | null;
  /** Portal target for the dock's tab bar. */
  tabBar: HTMLElement | null;
  /** Portal target for the active panel's body. */
  content: HTMLElement | null;
  /** Portal target for the "+" menu, while it is open. */
  menu: HTMLElement | null;
  /** The dock's `tabs` prop — `'always'` keeps the strip up for a lone panel. */
  tabs: 'auto' | 'always';
}

interface PanelEntry {
  placement: PanelPlacement;
  /** Placement to restore when the panel is reopened with no explicit target. */
  prev?: PanelPlacement;
  /** The panel's home dock — where a closed panel is offered under "+". */
  homeDockId?: string;
  /** Plain-text name, for the "+" button's tooltip when it opens directly. */
  label?: string;
}

export interface PanelMeta {
  homeDockId?: string;
  label?: string;
}

export interface DockContextValue {
  registerDock: (id: string, getRect: () => DOMRect | null, tabs?: 'auto' | 'always') => void;
  updateDockEls: (
    id: string,
    els: { tabBar: HTMLElement | null; content: HTMLElement | null; menu: HTMLElement | null },
  ) => void;
  unregisterDock: (id: string) => void;
  getDock: (id: string) => DockEntry | undefined;

  /** Register a panel with its initial placement (once, at mount). */
  registerPanel: (panelId: string, initial: PanelPlacement, meta?: PanelMeta) => void;
  unregisterPanel: (panelId: string) => void;
  getPlacement: (panelId: string) => PanelPlacement | undefined;
  setPlacement: (panelId: string, placement: PanelPlacement) => void;

  /** Close a panel: it stays registered, listed under its home dock's "+". */
  closePanel: (panelId: string) => void;
  /**
   * Reopen a closed panel. With `dockId` it docks there; without, it returns to
   * wherever it was when it was closed.
   */
  openPanel: (panelId: string, dockId?: string) => void;

  /** Panels currently docked in `dockId`, in registration order (tab order). */
  panelsInDock: (dockId: string) => string[];
  /** Closed panels whose home dock is `dockId` — the "+" button's menu. */
  closedInDock: (dockId: string) => string[];
  /**
   * Whether `dockId` renders a tab strip — two or more tabs, something to
   * reopen under "+", or `tabs: 'always'`. A docked panel uses this to know
   * whether the strip already names it (tab) or it must draw its own header.
   */
  dockShowsTabs: (dockId: string) => boolean;
  getPanelLabel: (panelId: string) => string | undefined;
  activeInDock: (dockId: string) => string | undefined;
  setActive: (dockId: string, panelId: string) => void;

  /** Which dock (if any) contains the viewport point — used while dragging. */
  findDockAt: (x: number, y: number) => string | null;
  /** The dock currently highlighted as a drop target during a drag. */
  hoverDock: string | null;
  setHoverDock: (id: string | null) => void;
}

const DockContext = createContext<DockContextValue | null>(null);

/** Read the enclosing {@link DockProvider}, or `null` when used standalone. */
export function useDockContext(): DockContextValue | null {
  return useContext(DockContext);
}

/**
 * Live view of one dock: which of its panels are open (tabs), which are closed
 * (offered under "+"), and the actions to move panels between those two states.
 *
 * Use it to react to a dock going empty — e.g. to collapse the resizable region
 * that hosts it down to just its tab strip:
 *
 * ```tsx
 * const dock = useDock('bottom');
 * <ResizableLayout
 *   bottom={{ content: <Dock id="bottom" />, collapsedSize: 36 }}
 *   bottomOpen={!dock.isEmpty}
 * />
 * ```
 */
export function useDock(dockId: string): {
  /** Open, docked panel ids, in tab order. */
  openIds: string[];
  /** Closed panel ids whose home dock is this one. */
  closedIds: string[];
  activeId: string | undefined;
  /** True when no panel is docked here — the dock is just its "+" strip. */
  isEmpty: boolean;
  open: (panelId: string) => void;
  close: (panelId: string) => void;
  setActive: (panelId: string) => void;
} {
  const ctx = useDockContext();
  const openIds = ctx?.panelsInDock(dockId) ?? [];
  const closedIds = ctx?.closedInDock(dockId) ?? [];
  return {
    openIds,
    closedIds,
    activeId: ctx?.activeInDock(dockId),
    isEmpty: openIds.length === 0,
    open: (panelId: string) => ctx?.openPanel(panelId, dockId),
    close: (panelId: string) => ctx?.closePanel(panelId),
    setActive: (panelId: string) => ctx?.setActive(dockId, panelId),
  };
}

/**
 * Coordinates a set of {@link FloatingPanel}s and {@link Dock}s: it owns each
 * panel's placement (floating box, which dock, or closed), the per-dock tab
 * order and active tab, and the drop-target hit-testing used while a panel is
 * dragged.
 *
 * Wrap the region that contains your docks and panels in a `DockProvider`.
 * `FloatingPanel` also works with no provider at all — it just becomes a plain
 * standalone floating window with docking disabled.
 */
export function DockProvider({ children }: { children: ReactNode }) {
  const [docks, setDocks] = useState<Record<string, DockEntry>>({});
  const [panels, setPanels] = useState<Record<string, PanelEntry>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActiveState] = useState<Record<string, string>>({});
  const [hoverDock, setHoverDock] = useState<string | null>(null);

  // getRect closures are stable per dock; keep them out of render state.
  const rects = useRef<Record<string, () => DOMRect | null>>({});

  const registerDock = useCallback(
    (id: string, getRect: () => DOMRect | null, tabs: 'auto' | 'always' = 'auto') => {
      rects.current[id] = getRect;
      setDocks((d) =>
        d[id] ? d : { ...d, [id]: { id, getRect, tabBar: null, content: null, menu: null, tabs } },
      );
    },
    [],
  );

  const updateDockEls = useCallback(
    (
      id: string,
      els: { tabBar: HTMLElement | null; content: HTMLElement | null; menu: HTMLElement | null },
    ) => {
      setDocks((d) => {
        const cur = d[id];
        if (!cur) return d;
        if (cur.tabBar === els.tabBar && cur.content === els.content && cur.menu === els.menu) return d;
        return { ...d, [id]: { ...cur, ...els } };
      });
    },
    [],
  );

  const unregisterDock = useCallback((id: string) => {
    delete rects.current[id];
    setDocks((d) => {
      if (!d[id]) return d;
      const next = { ...d };
      delete next[id];
      return next;
    });
  }, []);

  const getDock = useCallback((id: string) => docks[id], [docks]);

  const setActive = useCallback((dockId: string, panelId: string) => {
    setActiveState((a) => (a[dockId] === panelId ? a : { ...a, [dockId]: panelId }));
  }, []);

  const registerPanel = useCallback((panelId: string, initial: PanelPlacement, meta?: PanelMeta) => {
    setPanels((p) =>
      p[panelId] ? p : { ...p, [panelId]: { placement: initial, ...meta } },
    );
    setOrder((o) => (o.includes(panelId) ? o : [...o, panelId]));
    if (initial.mode === 'docked') {
      setActiveState((a) => (a[initial.dockId] ? a : { ...a, [initial.dockId]: panelId }));
    }
  }, []);

  const unregisterPanel = useCallback((panelId: string) => {
    setPanels((p) => {
      if (!p[panelId]) return p;
      const next = { ...p };
      delete next[panelId];
      return next;
    });
    setOrder((o) => o.filter((x) => x !== panelId));
  }, []);

  const getPlacement = useCallback((panelId: string) => panels[panelId]?.placement, [panels]);

  const setPlacement = useCallback((panelId: string, placement: PanelPlacement) => {
    setPanels((p) => {
      const cur = p[panelId];
      // Remember where a panel was, so closing then reopening restores it.
      const prev =
        placement.mode === 'closed' && cur?.placement.mode !== 'closed'
          ? (cur?.placement ?? undefined)
          : cur?.prev;
      return { ...p, [panelId]: { ...cur, placement, prev } };
    });
    if (placement.mode === 'docked') {
      // Docking a panel makes it the active tab of its target dock.
      setActiveState((a) => ({ ...a, [placement.dockId]: panelId }));
    }
  }, []);

  const closePanel = useCallback(
    (panelId: string) => {
      setPanels((p) => {
        const cur = p[panelId];
        if (!cur || cur.placement.mode === 'closed') return p;
        const dockId =
          cur.placement.mode === 'docked' ? cur.placement.dockId : cur.homeDockId;
        return {
          ...p,
          [panelId]: { ...cur, placement: { mode: 'closed', dockId }, prev: cur.placement },
        };
      });
    },
    [],
  );

  const openPanel = useCallback((panelId: string, dockId?: string) => {
    setPanels((p) => {
      const cur = p[panelId];
      if (!cur) return p;
      const target: PanelPlacement | undefined = dockId
        ? { mode: 'docked', dockId }
        : cur.prev && cur.prev.mode !== 'closed'
          ? cur.prev
          : cur.homeDockId
            ? { mode: 'docked', dockId: cur.homeDockId }
            : undefined;
      // A panel with no dock and no remembered box can't be placed from here;
      // FloatingPanel.open() handles that case with its own seeded geometry.
      if (!target) return p;
      if (target.mode === 'docked') {
        setActiveState((a) => ({ ...a, [target.dockId]: panelId }));
      }
      return { ...p, [panelId]: { ...cur, placement: target } };
    });
  }, []);

  const panelsInDock = useCallback(
    (dockId: string) =>
      order.filter((pid) => {
        const pl = panels[pid]?.placement;
        return pl?.mode === 'docked' && pl.dockId === dockId;
      }),
    [order, panels],
  );

  const closedInDock = useCallback(
    (dockId: string) =>
      order.filter((pid) => {
        const pl = panels[pid]?.placement;
        return pl?.mode === 'closed' && pl.dockId === dockId;
      }),
    [order, panels],
  );

  const dockShowsTabs = useCallback(
    (dockId: string) =>
      (docks[dockId]?.tabs ?? 'auto') === 'always' ||
      panelsInDock(dockId).length > 1 ||
      closedInDock(dockId).length > 0,
    [docks, panelsInDock, closedInDock],
  );

  const getPanelLabel = useCallback((panelId: string) => panels[panelId]?.label, [panels]);

  const activeInDock = useCallback(
    (dockId: string) => {
      const members = order.filter((pid) => {
        const pl = panels[pid]?.placement;
        return pl?.mode === 'docked' && pl.dockId === dockId;
      });
      const cur = active[dockId];
      return cur && members.includes(cur) ? cur : members[0];
    },
    [order, panels, active],
  );

  const findDockAt = useCallback((x: number, y: number) => {
    for (const [id, getRect] of Object.entries(rects.current)) {
      const r = getRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }, []);

  const value = useMemo<DockContextValue>(
    () => ({
      registerDock,
      updateDockEls,
      unregisterDock,
      getDock,
      registerPanel,
      unregisterPanel,
      getPlacement,
      setPlacement,
      closePanel,
      openPanel,
      panelsInDock,
      closedInDock,
      dockShowsTabs,
      getPanelLabel,
      activeInDock,
      setActive,
      findDockAt,
      hoverDock,
      setHoverDock,
    }),
    [
      registerDock,
      updateDockEls,
      unregisterDock,
      getDock,
      registerPanel,
      unregisterPanel,
      getPlacement,
      setPlacement,
      closePanel,
      openPanel,
      panelsInDock,
      closedInDock,
      dockShowsTabs,
      getPanelLabel,
      activeInDock,
      setActive,
      findDockAt,
      hoverDock,
    ],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}
