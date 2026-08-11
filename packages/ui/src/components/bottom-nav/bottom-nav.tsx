import * as React from 'react';

import { cn } from '../../lib/utils';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';
import { usePrefersReducedMotion } from '../../hooks/use-media-query';
import { HoldEditable } from '../hold-editable/hold-editable';
import { Tooltip } from '../tooltip/tooltip';

/* ─── Model ───────────────────────────────────────────────────────────────── */

/**
 * An icon: a component (lucide-style — it is handed `className` and
 * `strokeWidth`) or a ready-made node. The component form is deliberately
 * loose: a lucide export carries its own `propTypes`, which a narrower
 * `ComponentType` rejects under React 18's types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BottomNavIcon = React.ComponentType<any> | React.ReactNode;

export interface BottomNavLink {
  /** Stable identity — matched against {@link BottomNavProps.selectedLink}, and the React key. */
  key: string;
  /** Text under the icon. Also the accessible name. */
  label: string;
  /** Icon component (`Settings` from lucide) or node (`<Settings />`, an `<img>`…). */
  icon?: BottomNavIcon;
  /** Destination. Rendered as an `<a href>` unless `renderLink` says otherwise. */
  href?: string;
  /** Hover/focus hint (desktop). Touch never sees it — the label is already there. */
  tooltip?: string;
  /** Corner badge: a count, a dot, anything small. */
  badge?: React.ReactNode;
  /**
   * A second level. The first tap on a link with children navigates to it as
   * usual; tapping it again — once it is the selected one — raises a drawer of
   * these, one row tall, from behind the bar. A parent reads as selected
   * whenever one of its children is.
   */
  children?: BottomNavLink[];
  /** Renders dimmed and doesn't navigate. */
  disabled?: boolean;
}

/** Everything {@link BottomNavProps.renderLink} needs to render one destination. */
export interface BottomNavLinkRender {
  link: BottomNavLink;
  /** True while this link (or one of its children) is the selected one. */
  active: boolean;
  /** True for a sub-link inside the drawer. */
  sub: boolean;
  /**
   * Spread these onto whatever element you render — they carry the layout
   * classes, the content (icon + label + badge), the ARIA state and the click
   * handler. Nothing else belongs on the DOM node.
   */
  props: {
    href?: string;
    className: string;
    children: React.ReactNode;
    onClick: (event: React.MouseEvent) => void;
    'aria-label': string;
    'aria-current': 'page' | undefined;
    'aria-expanded': boolean | undefined;
    'aria-haspopup': 'true' | undefined;
  };
}

/** Why a navigation happened — see {@link BottomNavProps.onNavigate}. */
export type BottomNavSource = 'tap' | 'swipe';

export interface BottomNavProps {
  /** The destinations, left to right. */
  links: BottomNavLink[];
  /** Key of the current destination — a link's or a sub-link's. */
  selectedLink?: string;
  /**
   * Which link gets the raised centre bubble: its **key**, or a **slot index**.
   * Defaults to the middle slot, so the emphasis belongs to the position and
   * survives a reorder. `false` for a flat bar with no bubble.
   */
  center?: string | number | false;
  /**
   * Hold a link for a moment to pick it up and drag it elsewhere in the bar.
   * The new order comes back through {@link onReorder} — persist it and feed it
   * back in as `links`. The bar itself has no stash (benching a link would hide
   * a whole section of the app behind a gesture); a sub-link drawer does — see
   * {@link maxSlots}.
   */
  editable?: boolean;
  /**
   * The new order. Sub-link drags come back as the same tree with that parent's
   * `children` reordered: **the first {@link maxSlots} children are the drawer's
   * slots and the rest are its stash**, so one array persists both.
   */
  onReorder?: (links: BottomNavLink[]) => void;
  /**
   * How many sub-links a drawer shows at once. Beyond that they overflow — into
   * the hold-to-rearrange stash when `editable`, into a horizontal scroll
   * otherwise.
   * @default 5
   */
  maxSlots?: number;
  /**
   * Swipe left/right anywhere on the page to walk the bar. Off by default: it
   * is a whole-page gesture, so it is the app's call. Gestures that start in a
   * horizontal scroller (a code block, a carousel), inside the bar itself, or
   * on a `[data-bottom-nav-no-swipe]` sub-tree are left alone.
   *
   * While a sub-link is selected (or its drawer is open) the swipe walks that
   * parent's **children**, stepping out to the neighbouring section past either
   * end — so one gesture reaches everything the bar routes to.
   */
  swipeNavigation?: boolean;
  /**
   * The element the swipe is listened on — and the one that follows the finger
   * (see {@link swipePeek}). Defaults to the whole document, which can be
   * listened on but not moved.
   */
  swipeTarget?: React.RefObject<HTMLElement | null>;
  /**
   * Drag the {@link swipeTarget} sideways with the finger, and let it spring
   * back (or slide out) on release. Ignored without a `swipeTarget`.
   * @default true
   */
  swipePeek?: boolean;
  /** Swiping past the last destination goes back to the first (and vice versa). */
  swipeWrap?: boolean;
  /**
   * Called for every navigation the component decides on — including the ones
   * it cannot perform itself (a swipe). Without it, a swipe falls back to
   * `location.assign(href)`.
   */
  onNavigate?: (link: BottomNavLink, meta: { source: BottomNavSource }) => void;
  /**
   * Called when a link is tapped, before anything else. `preventDefault()` on
   * the event and the component neither navigates nor opens the drawer — the
   * hook for "tapping the active tab does something special".
   */
  onSelect?: (link: BottomNavLink, event: React.MouseEvent) => void;
  /**
   * Render one destination as something other than an `<a href>` — a router
   * `<Link>`, a `<button>`. Spread the props you are given; they carry the
   * classes, the ARIA state and the click handler.
   */
  renderLink?: (props: BottomNavLinkRender) => React.ReactNode;
  /**
   * Detach the bar from the bottom edge: a floating, rounded button group
   * centred over the content, fixed to the bottom of the viewport. The desktop
   * shape — pass `floating={isDesktop}` for a bar that docks on phones and
   * floats on wide screens.
   */
  floating?: boolean;
  /** Accessible name of the `<nav>`. */
  label?: string;
  className?: string;
  /** Opened sub-link drawer, for a controlled bar. */
  openLink?: string | null;
  onOpenLinkChange?: (key: string | null) => void;
}

/* ─── Bits ────────────────────────────────────────────────────────────────── */

const DRAWER_MS = 240;

function Icon({ icon, className }: { icon: BottomNavIcon | undefined; className: string }) {
  if (!icon) return null;
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in (icon as object))) {
    const C = icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
    // (a forwardRef object — lucide's shape — is a component, not a node)
    return <C className={className} strokeWidth={2.1} />;
  }
  return <span className={cn('inline-flex items-center justify-center', className)}>{icon as React.ReactNode}</span>;
}

const LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-[0.08em] leading-none';

function Badge({ badge }: { badge: React.ReactNode }) {
  if (badge === undefined || badge === null || badge === false) return null;
  return (
    <span className="pointer-events-none absolute right-1.5 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-4 text-primary-foreground">
      {badge}
    </span>
  );
}

/** True if `key` is `link` or one of its children. */
function owns(link: BottomNavLink, key: string | undefined): boolean {
  if (!key) return false;
  return link.key === key || !!link.children?.some((c) => c.key === key);
}

/* ─── Swipe ───────────────────────────────────────────────────────────────── */

/** Horizontal intent: past this many px sideways, and dominant over vertical. */
const SWIPE_INTENT = 14;
/** Commit past this distance (px) or this speed (px/ms). */
const SWIPE_COMMIT_PX = 64;
const SWIPE_COMMIT_VELOCITY = 0.5;
/** How much of the finger's travel the page actually takes, while peeking. */
const PEEK_RATIO = 0.35;
/** …and at a dead end, where the drag is only a hint that there is nothing there. */
const PEEK_RUBBER = 0.12;
const PEEK_MS = 200;

/** True if the gesture started somewhere that owns horizontal panning itself. */
function startsInScroller(target: EventTarget | null, nav: HTMLElement | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (nav && el === nav) return true;
    if (el.hasAttribute('data-bottom-nav-no-swipe')) return true;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    if (style && /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth) return true;
    el = el.parentElement;
  }
  return false;
}

function useSwipeNavigation({
  enabled,
  peek,
  target,
  navRef,
  canGo,
  onCommit,
}: {
  enabled: boolean;
  peek: boolean;
  target: React.RefObject<HTMLElement | null> | undefined;
  navRef: React.RefObject<HTMLElement | null>;
  /** Whether a step in this direction has a destination — drives the rubber band. */
  canGo: (dir: 1 | -1) => boolean;
  onCommit: (dir: 1 | -1) => void;
}) {
  const cb = React.useRef({ canGo, onCommit });
  cb.current = { canGo, onCommit };

  React.useEffect(() => {
    if (!enabled) return;
    const el = target?.current ?? null;
    const node: HTMLElement | Document | null = el ?? (globalThis.document ?? null);
    if (!node) return;
    // Only a real element can follow the finger; on `document` we just listen.
    const moving = peek ? el : null;

    let state: { id: number; x: number; y: number; t: number; axis: 'none' | 'x' | 'y' } | null = null;

    const paint = (dx: number, animate: boolean) => {
      if (!moving) return;
      moving.style.transition = animate ? `transform ${PEEK_MS}ms ease-out` : 'none';
      moving.style.transform = dx ? `translate3d(${dx}px,0,0)` : '';
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return; // a mouse drag is a selection, not a swipe
      if (startsInScroller(e.target, navRef.current)) return;
      state = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, axis: 'none' };
    };
    const move = (e: PointerEvent) => {
      const s = state;
      if (!s || s.id !== e.pointerId || s.axis === 'y') return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (s.axis === 'none') {
        if (Math.abs(dx) < SWIPE_INTENT && Math.abs(dy) < SWIPE_INTENT) return;
        // Lock the axis once, on the first decisive movement: a vertical scroll
        // must never turn into a navigation halfway through.
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (s.axis === 'y') return;
      }
      const open = cb.current.canGo(dx < 0 ? 1 : -1);
      paint(dx * (open ? PEEK_RATIO : PEEK_RUBBER), false);
    };
    const up = (e: PointerEvent) => {
      const s = state;
      state = null;
      if (!s || s.id !== e.pointerId || s.axis !== 'x') return;
      paint(0, true);
      const dx = e.clientX - s.x;
      const dt = Math.max(1, e.timeStamp - s.t);
      const far = Math.abs(dx) > SWIPE_COMMIT_PX;
      const fast = Math.abs(dx) / dt > SWIPE_COMMIT_VELOCITY;
      if (!far && !fast) return;
      cb.current.onCommit(dx < 0 ? 1 : -1);
    };
    const cancel = () => {
      state = null;
      paint(0, true);
    };

    node.addEventListener('pointerdown', down as EventListener, { passive: true });
    node.addEventListener('pointermove', move as EventListener, { passive: true });
    node.addEventListener('pointerup', up as EventListener, { passive: true });
    node.addEventListener('pointercancel', cancel as EventListener, { passive: true });
    return () => {
      node.removeEventListener('pointerdown', down as EventListener);
      node.removeEventListener('pointermove', move as EventListener);
      node.removeEventListener('pointerup', up as EventListener);
      node.removeEventListener('pointercancel', cancel as EventListener);
      paint(0, false);
    };
  }, [enabled, peek, target, navRef]);
}

/* ─── Component ───────────────────────────────────────────────────────────── */

/**
 * The app's bottom bar: three to five destinations, the middle one raised into
 * a bubble, an underline on the selected one — the phone-shaped navigation the
 * homelab's PWAs run on.
 *
 * Routing-agnostic: a link renders as an `<a href>` by default, or as whatever
 * `renderLink` returns (a router `<Link>`, a `<button>`). A link with
 * `children` navigates on the first tap and, tapped again once selected, raises
 * a drawer of sub-links from behind the bar — one row tall, the same shape as
 * the bar itself.
 *
 * Three optional behaviours: `editable` puts the bar under {@link HoldEditable}
 * so a hold picks a link up and drags it elsewhere (a drawer keeps its overflow
 * in the stash); `swipeNavigation` walks the bar when the page is swiped
 * left/right, dragging the page with the finger; `floating` lifts the bar off
 * the bottom edge into a centred button group, the desktop shape.
 *
 * @summary The app's bottom navigation bar — raised centre bubble, an upward
 * drawer of sub-links, hold-to-rearrange, and optional swipe-between-sections.
 */
export function BottomNav({
  links,
  selectedLink,
  center,
  editable = false,
  onReorder,
  maxSlots = 5,
  swipeNavigation = false,
  swipeTarget,
  swipePeek = true,
  swipeWrap = false,
  onNavigate,
  onSelect,
  renderLink,
  floating = false,
  label = 'Main',
  className,
  openLink,
  onOpenLinkChange,
}: BottomNavProps) {
  const reduced = usePrefersReducedMotion();

  /* The drawer. Controlled when `openLink` is passed, local otherwise; either
   * way it keeps rendering for one transition after closing so it can slide
   * back down instead of vanishing. */
  const [localOpen, setLocalOpen] = React.useState<string | null>(null);
  const open = openLink !== undefined ? openLink : localOpen;
  const setOpen = React.useCallback(
    (key: string | null) => {
      if (openLink === undefined) setLocalOpen(key);
      onOpenLinkChange?.(key);
    },
    [openLink, onOpenLinkChange],
  );

  const [drawerKey, setDrawerKey] = React.useState<string | null>(open);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setDrawerKey(open);
      if (reduced) return setShown(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    if (reduced) return setDrawerKey(null);
    const t = setTimeout(() => setDrawerKey(null), DRAWER_MS);
    return () => clearTimeout(t);
  }, [open, reduced]);

  useEscape(() => setOpen(null), !!open);
  // Also the swipe's "started inside the bar" test — one ref, both jobs.
  const navRef = useOutsideClick<HTMLElement>(() => setOpen(null), !!open);

  /* The raised bubble belongs to the middle *slot* by default, so rearranging
   * the bar moves the emphasis with the position instead of pushing a raised
   * button into a corner. */
  const centerIndex =
    center === false
      ? -1
      : typeof center === 'number'
        ? center
        : typeof center === 'string'
          ? links.findIndex((l) => l.key === center)
          : Math.floor(links.length / 2);

  const navigate = React.useCallback(
    (link: BottomNavLink, source: BottomNavSource) => {
      if (link.disabled) return;
      if (onNavigate) return onNavigate(link, { source });
      if (source === 'swipe' && link.href && typeof location !== 'undefined') location.assign(link.href);
    },
    [onNavigate],
  );

  /**
   * What a swipe walks. Normally the bar; but while a section's own level is
   * showing — a sub-link is selected, or its drawer is open — that section is
   * replaced by its children, so the swipe moves *within* the sub-links and
   * steps out to the neighbouring section past either end.
   */
  const sequence = React.useMemo(() => {
    const expanded = links.find((l) => l.children?.length && (l.key === open || l.children.some((c) => c.key === selectedLink)));
    if (!expanded) return links;
    return links.flatMap((l) => (l === expanded ? (l.children ?? []) : [l]));
  }, [links, open, selectedLink]);

  const step = React.useCallback(
    (dir: 1 | -1): BottomNavLink | undefined => {
      if (!sequence.length) return undefined;
      const from = sequence.findIndex((l) => owns(l, selectedLink));
      let next = (from === -1 ? 0 : from) + dir;
      if (next < 0 || next >= sequence.length) {
        if (!swipeWrap) return undefined;
        next = (next + sequence.length) % sequence.length;
      }
      const link = sequence[next];
      return link && !link.disabled ? link : undefined;
    },
    [sequence, selectedLink, swipeWrap],
  );

  useSwipeNavigation({
    enabled: swipeNavigation,
    peek: swipePeek,
    target: swipeTarget,
    navRef,
    canGo: React.useCallback((dir: 1 | -1) => !!step(dir), [step]),
    onCommit: React.useCallback(
      (dir: 1 | -1) => {
        const link = step(dir);
        if (!link) return;
        // A swipe within a section's sub-links keeps that drawer up; one that
        // leaves the section puts it away.
        if (!links.some((l) => l.children?.some((c) => c.key === link.key))) setOpen(null);
        navigate(link, 'swipe');
      },
      [step, links, navigate, setOpen],
    ),
  });

  /** One destination — the shared click/ARIA plumbing around `renderLink`. */
  const renderOne = (link: BottomNavLink, opts: { className: string; content: React.ReactNode; sub: boolean }) => {
    const active = opts.sub ? link.key === selectedLink : owns(link, selectedLink);
    const hasChildren = !opts.sub && !!link.children?.length;

    const onClick = (event: React.MouseEvent) => {
      onSelect?.(link, event);
      if (event.defaultPrevented) return;
      if (link.disabled) return event.preventDefault();
      if (hasChildren && (active || !link.href)) {
        // Second tap on the section you are already in (or a parent that is no
        // destination of its own): the drawer is what the tap is for.
        event.preventDefault();
        setOpen(open === link.key ? null : link.key);
        return;
      }
      setOpen(null);
      navigate(link, 'tap');
    };

    const props: BottomNavLinkRender['props'] = {
      // A disabled link keeps its href (so it stays a real, announced link) and
      // is stopped at the click instead.
      href: link.href,
      className: opts.className,
      children: opts.content,
      onClick,
      'aria-label': link.label,
      'aria-current': active ? 'page' : undefined,
      'aria-expanded': hasChildren ? open === link.key : undefined,
      'aria-haspopup': hasChildren ? 'true' : undefined,
    };

    const el = renderLink ? (
      <React.Fragment key={link.key}>{renderLink({ link, active, sub: opts.sub, props })}</React.Fragment>
    ) : !link.href ? (
      // No destination of its own — a disclosure, so a button, not a link.
      <button key={link.key} type="button" {...{ ...props, href: undefined }} disabled={link.disabled} />
    ) : (
      <a key={link.key} {...props} aria-disabled={link.disabled || undefined} />
    );

    // Touch never hovers, so a tooltip costs it nothing; the label is already
    // under the icon for everyone else.
    return link.tooltip ? (
      <Tooltip key={link.key} content={link.tooltip} side="top" describes={false}>
        {el as React.ReactElement<Record<string, unknown>>}
      </Tooltip>
    ) : (
      el
    );
  };

  /** A bar item: raised bubble in the centre slot, icon-over-label elsewhere. */
  const item = (link: BottomNavLink, index: number, held = false) => {
    const active = owns(link, selectedLink);
    const primary = index === centerIndex;

    if (primary) {
      return renderOne(link, {
        sub: false,
        className: cn(
          // basis, not a fixed width: five items must still fit a 320px phone.
          'relative flex w-16 min-w-0 flex-1 flex-col items-center justify-start pt-1.5',
          link.disabled && 'pointer-events-none opacity-40',
        ),
        content: (
          <>
            <span
              className={cn(
                'flex h-11 w-11 -translate-y-3 items-center justify-center rounded-2xl border shadow-sm transition-all',
                active || held
                  ? 'border-primary bg-primary text-primary-foreground shadow-primary/30'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon icon={link.icon} className="h-[22px] w-[22px]" />
            </span>
            <span className={cn('-mt-2', LABEL_CLASS, active ? 'text-primary' : 'text-muted-foreground')}>
              {link.label}
            </span>
            <Badge badge={link.badge} />
          </>
        ),
      });
    }

    return renderOne(link, {
      sub: false,
      className: cn(
        'group relative flex w-16 min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 pt-2',
        held && 'rounded-xl bg-accent',
        link.disabled && 'pointer-events-none opacity-40',
      ),
      content: (
        <>
          <span
            className={cn(
              'absolute top-0 h-0.5 w-6 rounded-full bg-primary transition-opacity',
              active ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            icon={link.icon}
            className={cn(
              'h-5 w-5 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
            )}
          />
          <span
            className={cn(
              LABEL_CLASS,
              'transition-colors',
              active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
            )}
          >
            {link.label}
          </span>
          <Badge badge={link.badge} />
        </>
      ),
    });
  };

  /** A drawer sub-link — the same icon-over-label row, minus the bubble. */
  const subItem = (child: BottomNavLink, held = false) =>
    renderOne(child, {
      sub: true,
      className: cn(
        'group relative flex min-w-16 shrink-0 flex-col items-center gap-1 px-1 pb-1.5 pt-2',
        held && 'rounded-xl bg-accent',
        child.disabled && 'pointer-events-none opacity-40',
      ),
      content: (
        <>
          <Icon
            icon={child.icon}
            className={cn(
              'h-5 w-5 transition-colors',
              child.key === selectedLink ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
            )}
          />
          <span
            className={cn(
              LABEL_CLASS,
              'transition-colors',
              child.key === selectedLink ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
            )}
          >
            {child.label}
          </span>
          <Badge badge={child.badge} />
        </>
      ),
    });

  /** Rewrite one parent's children — the drawer's slots first, its stash after. */
  const commitChildren = (parent: BottomNavLink, children: BottomNavLink[]) =>
    onReorder?.(links.map((l) => (l.key === parent.key ? { ...l, children } : l)));

  const rowClass = cn('mx-auto flex max-w-lg items-stretch justify-between px-2', floating && 'gap-1');
  const drawerLink = drawerKey ? links.find((l) => l.key === drawerKey) : undefined;
  const slots = drawerLink?.children?.slice(0, maxSlots) ?? [];
  const benched = drawerLink?.children?.slice(maxSlots) ?? [];

  return (
    <nav
      ref={navRef}
      aria-label={label}
      data-bottom-nav=""
      data-floating={floating ? '' : undefined}
      className={cn(
        'relative shrink-0 border-border bg-card/80 backdrop-blur-md',
        // The bar sits above the page; while its drawer is up the pair has to
        // clear the app's own bottom furniture (a docked composer, a FAB) too.
        drawerKey ? 'z-50' : 'z-30',
        floating
          ? 'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 w-auto -translate-x-1/2 rounded-2xl border px-1 shadow-lg'
          : 'border-t',
        className,
      )}
      style={floating ? undefined : { paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* The second level: one row tall, the same shape as the bar, sliding up
          from behind it. Positioned above the bar so the bar stays put. */}
      {drawerLink && (
        <div
          role="group"
          aria-label={`${drawerLink.label} sub-links`}
          data-bottom-nav-drawer=""
          data-open={shown ? '' : undefined}
          className={cn(
            // Opaque, unlike the bar: it slides over whatever the app keeps
            // above the bar (a docked composer), and a translucent row there
            // reads as a ghost of two UIs at once.
            'absolute inset-x-0 -z-10 border-border bg-card',
            floating ? 'bottom-full mb-1 rounded-2xl border shadow-lg' : 'bottom-full border-t',
            !reduced && 'transition-[transform,opacity] duration-200 ease-out',
            shown ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
          )}
        >
          {editable ? (
            /* The drawer *does* have a stash: a section can own more pages than
               a row fits, and the overflow has to wait somewhere. Slots first,
               bench after — one array, persisted by `onReorder`. */
            <HoldEditable
              items={slots}
              stash={benched}
              getKey={(l) => l.key}
              onReorder={(next) => commitChildren(drawerLink, [...next, ...benched])}
              onStashChange={(next, stash) => commitChildren(drawerLink, [...next, ...stash])}
              stashLabel={(l) => l.label}
              stashPlacement="top"
              className={rowClass}
              itemClassName="flex"
            >
              {(child, { held }) => subItem(child, held)}
            </HoldEditable>
          ) : (
            <div className={cn(rowClass, 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}>
              {(drawerLink.children ?? []).map((child) => subItem(child))}
            </div>
          )}
        </div>
      )}

      {editable ? (
        /* No stash on the bar itself: benching a link would hide a whole
           section of the app behind a gesture, and the bar is the one group
           that must always show everything it routes to. Reorder only. */
        <HoldEditable
          items={links}
          stash={false}
          getKey={(l) => l.key}
          onReorder={(next) => onReorder?.(next)}
          className={rowClass}
          itemClassName="flex min-w-0 flex-1"
        >
          {(link, { index, held }) => item(link, index, held)}
        </HoldEditable>
      ) : (
        <div className={rowClass}>{links.map((link, i) => item(link, i))}</div>
      )}
    </nav>
  );
}
