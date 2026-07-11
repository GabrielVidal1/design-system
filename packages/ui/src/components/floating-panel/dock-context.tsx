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
 * Where a panel currently lives: free-floating at a viewport box, or docked
 * (in-flow) inside a {@link Dock} identified by `dockId`.
 */
export type PanelPlacement =
  | ({ mode: 'floating' } & FloatingGeom)
  | { mode: 'docked'; dockId: string };

interface DockEntry {
  id: string;
  /** Live viewport rect of the dock's drop area (for hit-testing a drag). */
  getRect: () => DOMRect | null;
  /** Portal target for the dock's tab bar. */
  tabBar: HTMLElement | null;
  /** Portal target for the active panel's body. */
  content: HTMLElement | null;
}

export interface DockContextValue {
  registerDock: (id: string, getRect: () => DOMRect | null) => void;
  updateDockEls: (id: string, els: { tabBar: HTMLElement | null; content: HTMLElement | null }) => void;
  unregisterDock: (id: string) => void;
  getDock: (id: string) => DockEntry | undefined;

  /** Register a panel with its initial placement (once, at mount). */
  registerPanel: (panelId: string, initial: PanelPlacement) => void;
  unregisterPanel: (panelId: string) => void;
  getPlacement: (panelId: string) => PanelPlacement | undefined;
  setPlacement: (panelId: string, placement: PanelPlacement) => void;

  /** Panels currently docked in `dockId`, in registration order (tab order). */
  panelsInDock: (dockId: string) => string[];
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
 * Coordinates a set of {@link FloatingPanel}s and {@link Dock}s: it owns each
 * panel's placement (floating box vs. which dock), the per-dock tab order and
 * active tab, and the drop-target hit-testing used while a panel is dragged.
 *
 * Wrap the region that contains your docks and panels in a `DockProvider`.
 * `FloatingPanel` also works with no provider at all — it just becomes a plain
 * standalone floating window with docking disabled.
 */
export function DockProvider({ children }: { children: ReactNode }) {
  const [docks, setDocks] = useState<Record<string, DockEntry>>({});
  const [placements, setPlacements] = useState<Record<string, PanelPlacement>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActiveState] = useState<Record<string, string>>({});
  const [hoverDock, setHoverDock] = useState<string | null>(null);

  // getRect closures are stable per dock; keep them out of render state.
  const rects = useRef<Record<string, () => DOMRect | null>>({});

  const registerDock = useCallback((id: string, getRect: () => DOMRect | null) => {
    rects.current[id] = getRect;
    setDocks((d) => (d[id] ? d : { ...d, [id]: { id, getRect, tabBar: null, content: null } }));
  }, []);

  const updateDockEls = useCallback(
    (id: string, els: { tabBar: HTMLElement | null; content: HTMLElement | null }) => {
      setDocks((d) => {
        const cur = d[id];
        if (!cur) return d;
        if (cur.tabBar === els.tabBar && cur.content === els.content) return d;
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

  const registerPanel = useCallback((panelId: string, initial: PanelPlacement) => {
    setPlacements((p) => (p[panelId] ? p : { ...p, [panelId]: initial }));
    setOrder((o) => (o.includes(panelId) ? o : [...o, panelId]));
    if (initial.mode === 'docked') {
      setActiveState((a) => (a[initial.dockId] ? a : { ...a, [initial.dockId]: panelId }));
    }
  }, []);

  const unregisterPanel = useCallback((panelId: string) => {
    setPlacements((p) => {
      if (!p[panelId]) return p;
      const next = { ...p };
      delete next[panelId];
      return next;
    });
    setOrder((o) => o.filter((x) => x !== panelId));
  }, []);

  const getPlacement = useCallback((panelId: string) => placements[panelId], [placements]);

  const setPlacement = useCallback((panelId: string, placement: PanelPlacement) => {
    setPlacements((p) => ({ ...p, [panelId]: placement }));
    if (placement.mode === 'docked') {
      // Docking a panel makes it the active tab of its target dock.
      setActiveState((a) => ({ ...a, [placement.dockId]: panelId }));
    }
  }, []);

  const panelsInDock = useCallback(
    (dockId: string) =>
      order.filter((pid) => {
        const pl = placements[pid];
        return pl?.mode === 'docked' && pl.dockId === dockId;
      }),
    [order, placements],
  );

  const activeInDock = useCallback(
    (dockId: string) => {
      const members = order.filter((pid) => {
        const pl = placements[pid];
        return pl?.mode === 'docked' && pl.dockId === dockId;
      });
      const cur = active[dockId];
      return cur && members.includes(cur) ? cur : members[0];
    },
    [order, placements, active],
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
      panelsInDock,
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
      panelsInDock,
      activeInDock,
      setActive,
      findDockAt,
      hoverDock,
    ],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}
