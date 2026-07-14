import * as React from 'react';

import { cn } from '../../lib/utils';
import { useIsTouch, usePrefersReducedMotion } from '../../hooks/use-media-query';

export type TabsVariant = 'underline' | 'pill' | 'segmented';
export type TabsActivation = 'automatic' | 'manual';

interface TabsContextValue {
  value: string;
  select: (value: string) => void;
  baseId: string;
  variant: TabsVariant;
  activation: TabsActivation;
}

const TabsCtx = React.createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const ctx = React.useContext(TabsCtx);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>`);
  return ctx;
}

/** The ids that tie a trigger to its panel, so both sides agree without props. */
const triggerId = (base: string, value: string) => `${base}-trigger-${value}`;
const panelId = (base: string, value: string) => `${base}-panel-${value}`;

/* ─── Root ────────────────────────────────────────────────────────────────── */

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled active tab. Pair with `onValueChange`. */
  value?: string;
  /** Initial tab when uncontrolled. Defaults to the first trigger that mounts. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  /**
   * `automatic` (default) selects a tab as soon as arrow keys move to it —
   * the WAI-ARIA default for cheap panels. `manual` moves focus only and waits
   * for Enter/Space, which is the right call when a panel fetches on select.
   */
  activation?: TabsActivation;
  /**
   * Swipe left/right across the panels to change tab. Touch only (a coarse
   * pointer); ignored for mouse drags, and never steals a gesture that starts
   * on the tab strip or inside a horizontally scrollable element.
   */
  swipe?: boolean;
}

/**
 * Tabs — one panel at a time, mobile-first.
 *
 * The strip scrolls horizontally rather than wrapping (phones), keeps the
 * active tab in view, and panels are swipeable on touch. Keyboard, roving
 * tabindex and ARIA wiring come for free.
 *
 * ```tsx
 * <Tabs defaultValue="logs">
 *   <TabsList>
 *     <TabsTrigger value="logs">Logs</TabsTrigger>
 *     <TabsTrigger value="config">Config</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="logs">…</TabsContent>
 *   <TabsContent value="config">…</TabsContent>
 * </Tabs>
 * ```
 */
export function Tabs({
  value: controlled,
  defaultValue,
  onValueChange,
  variant = 'underline',
  activation = 'automatic',
  swipe = true,
  className,
  children,
  ...props
}: TabsProps) {
  const reactId = React.useId();
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? '');
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : uncontrolled;

  const select = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const rootRef = React.useRef<HTMLDivElement>(null);

  /* Uncontrolled with no defaultValue: adopt the first trigger that mounted, so
   * `<Tabs>` is usable without repeating the first tab's value. */
  React.useEffect(() => {
    if (isControlled || value) return;
    const first = rootRef.current?.querySelector<HTMLButtonElement>('[role="tab"]:not([disabled])');
    const v = first?.dataset.value;
    if (v) setUncontrolled(v);
  }, [isControlled, value]);

  const ctx = React.useMemo<TabsContextValue>(
    () => ({ value, select, baseId: reactId, variant, activation }),
    [value, select, reactId, variant, activation],
  );

  const swipeHandlers = useSwipe({ enabled: swipe, rootRef, value, select });

  return (
    <TabsCtx.Provider value={ctx}>
      <div
        ref={rootRef}
        data-variant={variant}
        className={cn('flex flex-col', className)}
        {...swipeHandlers}
        {...props}
      >
        {children}
      </div>
    </TabsCtx.Provider>
  );
}

/* ─── Swipe ───────────────────────────────────────────────────────────────── */

/** Horizontal intent: past this many px sideways (and dominant over vertical). */
const SWIPE_INTENT = 12;
/** Commit the tab change past this fraction of the panel width, or this speed. */
const SWIPE_COMMIT_RATIO = 0.25;
const SWIPE_COMMIT_VELOCITY = 0.5; // px/ms

/** True if the gesture started somewhere that owns horizontal panning itself. */
function startsInScroller(target: EventTarget | null, root: HTMLElement | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el.closest('[role="tablist"]')) return true;
    if (el.hasAttribute('data-tabs-no-swipe')) return true;
    const style = getComputedStyle(el);
    const scrolls = /(auto|scroll)/.test(style.overflowX);
    if (scrolls && el.scrollWidth > el.clientWidth) return true;
    el = el.parentElement;
  }
  return false;
}

function useSwipe({
  enabled,
  rootRef,
  value,
  select,
}: {
  enabled: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  value: string;
  select: (v: string) => void;
}) {
  const touch = useIsTouch();
  const active = enabled && touch;
  const state = React.useRef<{ id: number; x: number; y: number; t: number; axis: 'none' | 'x' | 'y' } | null>(null);

  const neighbour = React.useCallback(
    (dir: 1 | -1): string | undefined => {
      const root = rootRef.current;
      if (!root) return undefined;
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
      const i = tabs.findIndex((t) => t.dataset.value === value);
      return tabs[i + dir]?.dataset.value;
    },
    [rootRef, value],
  );

  if (!active) return {};

  return {
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (e.pointerType !== 'touch') return;
      if (startsInScroller(e.target, rootRef.current)) return;
      state.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, axis: 'none' };
    },
    onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      const s = state.current;
      if (!s || s.id !== e.pointerId || s.axis === 'y') return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (s.axis === 'none') {
        if (Math.abs(dx) < SWIPE_INTENT && Math.abs(dy) < SWIPE_INTENT) return;
        // Lock the axis once, on the first decisive movement: a vertical scroll
        // must never be turned into a tab change halfway through.
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    },
    onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
      const s = state.current;
      state.current = null;
      if (!s || s.id !== e.pointerId || s.axis !== 'x') return;
      const dx = e.clientX - s.x;
      const dt = Math.max(1, e.timeStamp - s.t);
      const width = rootRef.current?.clientWidth ?? 1;
      const far = Math.abs(dx) > width * SWIPE_COMMIT_RATIO;
      const fast = Math.abs(dx) / dt > SWIPE_COMMIT_VELOCITY;
      if (!far && !fast) return;
      const next = neighbour(dx < 0 ? 1 : -1);
      if (next) select(next);
    },
    onPointerCancel() {
      state.current = null;
    },
  };
}

/* ─── List ────────────────────────────────────────────────────────────────── */

const LIST_VARIANT: Record<TabsVariant, string> = {
  underline: 'border-b border-border gap-1',
  pill: 'gap-1',
  segmented: 'gap-1 rounded-lg bg-muted p-1',
};

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  'aria-label'?: string;
}

/** The strip. Scrolls sideways instead of wrapping, and follows the active tab. */
export function TabsList({ className, children, ...props }: TabsListProps) {
  const { value, variant, activation, select } = useTabs('TabsList');
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [ind, setInd] = React.useState<{ left: number; width: number } | null>(null);

  const tabs = React.useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? []),
    [],
  );

  /* Park the moving indicator under the active trigger. Measured from the DOM
   * (not from props) so it survives fonts loading, resizes and reordering. */
  React.useEffect(() => {
    const list = ref.current;
    if (!list || variant === 'pill') return;

    const measure = () => {
      const el = list.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(value)}"]`);
      if (!el) return setInd(null);
      setInd({ left: el.offsetLeft, width: el.offsetWidth });
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    tabs().forEach((t) => ro.observe(t));
    return () => ro.disconnect();
  }, [value, variant, tabs]);

  /* Keep the active tab reachable on a narrow strip. */
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(value)}"]`);
    el?.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [value, reduced]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const all = tabs();
    const i = all.findIndex((t) => t === document.activeElement);
    if (i === -1) return;
    e.preventDefault();

    const next =
      e.key === 'Home'
        ? all[0]
        : e.key === 'End'
          ? all[all.length - 1]
          : // Wrap around — the ARIA tabs pattern.
            all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];

    next?.focus();
    if (activation === 'automatic' && next?.dataset.value) select(next.dataset.value);
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        // A scroller, not a wrapper: on a phone the strip pans, keeping every
        // tab one flick away instead of stacking rows.
        'relative flex shrink-0 items-center overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        LIST_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {children}
      {ind && variant !== 'pill' && (
        <span
          aria-hidden
          data-tabs-indicator=""
          className={cn(
            'pointer-events-none absolute motion-safe:transition-[transform,width] motion-safe:duration-200 motion-safe:ease-out',
            variant === 'underline' ? 'bottom-0 h-0.5 rounded-full bg-primary' : 'inset-y-1 rounded-md bg-background shadow-sm',
          )}
          style={{
            width: ind.width,
            transform: `translateX(${ind.left}px)`,
            // The segmented pill sits behind its label.
            ...(variant === 'segmented' ? { zIndex: 0 } : null),
          }}
        />
      )}
    </div>
  );
}

/* ─── Trigger ─────────────────────────────────────────────────────────────── */

const TRIGGER_BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium ' +
  // 44px tall: a finger target, not a mouse target.
  'min-h-11 px-3 py-2 transition-colors outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ' +
  'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

const TRIGGER_VARIANT: Record<TabsVariant, { off: string; on: string }> = {
  underline: {
    off: 'rounded-t-md text-muted-foreground hover:text-foreground',
    on: 'text-foreground',
  },
  pill: {
    off: 'rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    on: 'rounded-full bg-primary text-primary-foreground hover:bg-primary',
  },
  segmented: {
    off: 'z-[1] rounded-md text-muted-foreground hover:text-foreground',
    on: 'z-[1] rounded-md text-foreground',
  },
};

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The value this trigger selects — matches a `<TabsContent value>`. */
  value: string;
  /** Leading icon (a lucide node, or anything). */
  icon?: React.ReactNode;
  /** Trailing count/badge slot. */
  badge?: React.ReactNode;
}

export function TabsTrigger({ value, icon, badge, className, children, onClick, ...props }: TabsTriggerProps) {
  const ctx = useTabs('TabsTrigger');
  const selected = ctx.value === value;
  const style = TRIGGER_VARIANT[ctx.variant];

  return (
    <button
      type="button"
      role="tab"
      id={triggerId(ctx.baseId, value)}
      data-value={value}
      aria-selected={selected}
      aria-controls={panelId(ctx.baseId, value)}
      // Roving tabindex: the strip is one tab stop, arrows move within it.
      tabIndex={selected ? 0 : -1}
      data-state={selected ? 'active' : 'inactive'}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.select(value);
      }}
      className={cn(TRIGGER_BASE, selected ? style.on : style.off, className)}
      {...props}
    >
      {icon}
      {children}
      {badge}
    </button>
  );
}

/* ─── Content ─────────────────────────────────────────────────────────────── */

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  /**
   * Keep the panel mounted (just hidden) when it isn't active — preserves
   * scroll position, form state and anything expensive to rebuild.
   */
  keepMounted?: boolean;
}

export function TabsContent({ value, keepMounted = false, className, children, ...props }: TabsContentProps) {
  const ctx = useTabs('TabsContent');
  const active = ctx.value === value;
  if (!active && !keepMounted) return null;

  return (
    <div
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={triggerId(ctx.baseId, value)}
      hidden={!active}
      // A panel with no focusable child still needs to be reachable by keyboard.
      tabIndex={active ? 0 : -1}
      data-state={active ? 'active' : 'inactive'}
      className={cn('mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      {...props}
    >
      {children}
    </div>
  );
}
