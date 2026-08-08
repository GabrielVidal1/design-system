import * as React from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const GAP = 8;
const LONG_PRESS_DELAY = 450;
const MOVE_TOLERANCE = 10;
const TOUCH_LINGER = 1600;

const TRANSFORMS: Record<TooltipSide, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
};

function anchorPoint(rect: DOMRect, side: TooltipSide) {
  switch (side) {
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2 };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP };
    default:
      return { top: rect.top - GAP, left: rect.left + rect.width / 2 };
  }
}

export interface TooltipProps {
  content: React.ReactNode;
  side?: TooltipSide;
  /**
   * Wire the bubble to the trigger with `aria-describedby`. Pass `false` when the
   * tooltip text already *is* the trigger's accessible name (an icon-only button
   * that took its `aria-label` from it) — a screen reader would otherwise read it
   * twice.
   */
  describes?: boolean;
  children: React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    'aria-describedby'?: string;
    onPointerEnter?: React.PointerEventHandler;
    onPointerLeave?: React.PointerEventHandler;
    onPointerDown?: React.PointerEventHandler;
    onPointerMove?: React.PointerEventHandler;
    onPointerUp?: React.PointerEventHandler;
    onPointerCancel?: React.PointerEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
    onClick?: React.MouseEventHandler;
  }>;
}

/**
 * A hover/focus hint for a single trigger element — and, on touch, a
 * long-press one. Holding the trigger for {@link LONG_PRESS_DELAY} reveals
 * the bubble and swallows the tap that ends the press, so a phone user can
 * read an icon button's label without also firing its action; a plain tap
 * still fires the trigger exactly as if the tooltip didn't exist.
 *
 * Rendered in a portal and positioned from the trigger's box, so it escapes
 * any `overflow: hidden` ancestor without a wrapper element distorting the
 * layout. Follows the WAI-ARIA tooltip pattern: `role="tooltip"`, shown on
 * hover, keyboard focus or long-press, dismissed with Escape, a tap outside
 * the trigger, or scroll.
 *
 * @summary Hover/focus hint; long-press reveals it on touch instead of firing
 * the trigger, and a linger timeout auto-dismisses it there.
 */
export function Tooltip({ content, side = 'top', describes = true, children }: TooltipProps) {
  const id = React.useId();
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lingerTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const touchFired = React.useRef(false);
  const [point, setPoint] = React.useState<{ top: number; left: number } | null>(null);

  const hide = React.useCallback(() => {
    clearTimeout(timer.current);
    clearTimeout(lingerTimer.current);
    setPoint(null);
  }, []);

  const reveal = React.useCallback(
    (lingerMs?: number) => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPoint(anchorPoint(rect, side));
      clearTimeout(lingerTimer.current);
      if (lingerMs) lingerTimer.current = setTimeout(hide, lingerMs);
    },
    [side, hide],
  );

  const show = React.useCallback(
    (delay: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => reveal(), delay);
    },
    [reveal],
  );

  React.useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(lingerTimer.current);
    },
    [],
  );

  // While it is up: Escape, a tap outside the trigger, or any scroll/resize
  // (the point it was measured from is now stale) all dismiss it.
  React.useEffect(() => {
    if (!point) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    const onOutside = (e: PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as globalThis.Node)) hide();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [point, hide]);

  const child = children;
  const trigger = React.cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const ref = (child as unknown as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') (ref as React.RefObject<HTMLElement | null>).current = node;
    },
    'aria-describedby': point && describes ? id : child.props['aria-describedby'],
    onPointerEnter: (e: React.PointerEvent) => {
      child.props.onPointerEnter?.(e);
      // Touch already fires a click; a hover bubble there is just noise.
      if (e.pointerType !== 'touch') show(150);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      child.props.onPointerLeave?.(e);
      if (e.pointerType !== 'touch') hide();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      // Keyboard focus only — a mouse click focuses too, and the hover bubble
      // that is already up should not be pinned open by it.
      if (e.target.matches(':focus-visible')) show(0);
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      hide();
    },
    onPointerDown: (e: React.PointerEvent) => {
      child.props.onPointerDown?.(e);
      if (e.pointerType !== 'touch') return;
      touchFired.current = false;
      touchStart.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        touchFired.current = true;
        touchStart.current = null;
        reveal(TOUCH_LINGER);
      }, LONG_PRESS_DELAY);
    },
    onPointerMove: (e: React.PointerEvent) => {
      child.props.onPointerMove?.(e);
      const from = touchStart.current;
      if (!from) return;
      // A scroll/drag, not a hold — cancel the pending reveal.
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE) {
        clearTimeout(timer.current);
        touchStart.current = null;
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      child.props.onPointerUp?.(e);
      if (e.pointerType !== 'touch') return;
      clearTimeout(timer.current);
      touchStart.current = null;
    },
    onPointerCancel: (e: React.PointerEvent) => {
      child.props.onPointerCancel?.(e);
      clearTimeout(timer.current);
      touchStart.current = null;
    },
    onClick: (e: React.MouseEvent) => {
      if (touchFired.current) {
        // The long press already revealed the tooltip — don't also fire the
        // trigger's action on the tap that ends the press.
        e.preventDefault();
        e.stopPropagation();
        touchFired.current = false;
        return;
      }
      child.props.onClick?.(e);
    },
  });

  return (
    <>
      {trigger}
      {point &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="ds-tooltip-anchor"
            style={{ top: point.top, left: point.left, transform: TRANSFORMS[side] }}
          >
            <span id={id} role="tooltip" className="ds-tooltip">
              {content}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
