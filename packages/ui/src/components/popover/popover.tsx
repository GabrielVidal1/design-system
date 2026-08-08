import * as React from 'react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';
import { Modal } from '../modal';

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';

const GAP = 8;

/** Does `side` have room against the viewport, given the panel's measured box? */
function fits(trigger: DOMRect, size: { width: number; height: number }, side: PopoverSide): boolean {
  switch (side) {
    case 'top':
      return trigger.top - GAP - size.height >= 0;
    case 'bottom':
      return trigger.bottom + GAP + size.height <= window.innerHeight;
    case 'left':
      return trigger.left - GAP - size.width >= 0;
    case 'right':
      return trigger.right + GAP + size.width <= window.innerWidth;
  }
}

const OPPOSITE: Record<PopoverSide, PopoverSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/** Prefer `side`; flip to its opposite when that's the only one with room. */
function resolveSide(trigger: DOMRect, size: { width: number; height: number }, side: PopoverSide): PopoverSide {
  if (fits(trigger, size, side)) return side;
  return fits(trigger, size, OPPOSITE[side]) ? OPPOSITE[side] : side;
}

/** Panel position, expressed relative to the trigger's own box (no portal —
 *  the panel stays a DOM descendant of the trigger's wrapper, so outside-click
 *  detection and viewport rects work without extra bookkeeping). */
function positionStyle(side: PopoverSide, align: PopoverAlign): React.CSSProperties {
  const style: React.CSSProperties = { position: 'absolute' };
  if (side === 'bottom') {
    style.top = '100%';
    style.marginTop = GAP;
  } else if (side === 'top') {
    style.bottom = '100%';
    style.marginBottom = GAP;
  } else if (side === 'right') {
    style.left = '100%';
    style.marginLeft = GAP;
  } else {
    style.right = '100%';
    style.marginRight = GAP;
  }

  if (side === 'top' || side === 'bottom') {
    if (align === 'start') style.left = 0;
    else if (align === 'end') style.right = 0;
    else {
      style.left = '50%';
      style.transform = 'translateX(-50%)';
    }
  } else {
    if (align === 'start') style.top = 0;
    else if (align === 'end') style.bottom = 0;
    else {
      style.top = '50%';
      style.transform = 'translateY(-50%)';
    }
  }
  return style;
}

export interface PopoverProps {
  /** The element that opens the popover on click. */
  trigger: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    onClick?: React.MouseEventHandler;
    'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
  }>;
  /** Popover content — can hold interactive elements, unlike {@link Tooltip}. */
  children: React.ReactNode;
  /** Preferred side; flips to the opposite when it doesn't fit the viewport. */
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Controlled open state. Pair with `onOpenChange`. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Open as a bottom sheet instead of an anchored panel. Default: sheet below
   * the `md` breakpoint, anchored panel beyond — the same split as `Select`.
   */
  sheet?: boolean;
  /** Accessible name for the panel — also the sheet title on phones. */
  label?: string;
  /** Class for the anchored/sheet panel. */
  className?: string;
}

/**
 * A click-to-open panel anchored to a trigger — for interactive content (a
 * mini form, a colour swatch, a menu) that a hover-only `Tooltip` can't
 * host. Flips to the opposite side when the preferred one doesn't fit the
 * viewport. On phones it becomes a bottom sheet via `Modal` instead of an
 * anchored panel, so content never gets clipped by the screen edge.
 *
 * @summary Click-triggered floating panel for interactive content; anchored
 * on desktop with side-flip, a bottom sheet on phones.
 */
export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'center',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  sheet,
  label,
  className,
}: PopoverProps) {
  const [own, setOwn] = React.useState(defaultOpen);
  const open = openProp !== undefined ? openProp : own;
  const id = React.useId();
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [resolvedSide, setResolvedSide] = React.useState(side);

  const isMobile = useIsMobile();
  const asSheet = sheet ?? isMobile;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwn(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const close = React.useCallback(() => setOpen(false), [setOpen]);

  const outsideRef = useOutsideClick<HTMLDivElement>(close, open && !asSheet);
  useEscape(close, open && !asSheet);

  React.useEffect(() => {
    if (open) setResolvedSide(side);
  }, [open, side]);

  // A panel's size depends on its content, so the side can only be confirmed
  // (and flipped, if it doesn't fit) after it has actually rendered.
  React.useLayoutEffect(() => {
    if (!open || asSheet) return;
    const t = triggerRef.current?.getBoundingClientRect();
    const p = panelRef.current?.getBoundingClientRect();
    if (!t || !p) return;
    const next = resolveSide(t, { width: p.width, height: p.height }, side);
    if (next !== resolvedSide) setResolvedSide(next);
  });

  const triggerEl = React.cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const ref = (trigger as unknown as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') (ref as React.RefObject<HTMLElement | null>).current = node;
    },
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e);
      setOpen(!open);
    },
    'aria-haspopup': asSheet ? 'dialog' : 'true',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
  });

  return (
    <div ref={outsideRef} className="relative inline-block">
      {triggerEl}
      {open &&
        (asSheet ? (
          <Modal open onClose={close} title={label} hideHeader={!label} size="sm">
            {children}
          </Modal>
        ) : (
          <div
            ref={panelRef}
            id={id}
            aria-label={label}
            tabIndex={-1}
            style={positionStyle(resolvedSide, align)}
            className={cn(
              'ds-popover-panel z-50 max-w-[min(20rem,90vw)] rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg outline-none',
              className,
            )}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
