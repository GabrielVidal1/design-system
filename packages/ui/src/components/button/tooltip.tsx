import * as React from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const GAP = 8;

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
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  }>;
}

/**
 * A hover/focus hint for a single trigger element.
 *
 * Rendered in a portal and positioned from the trigger's box, so it escapes any
 * `overflow: hidden` ancestor without a wrapper element distorting the layout.
 * Follows the WAI-ARIA tooltip pattern: `role="tooltip"`, shown on hover *and*
 * keyboard focus, dismissed with Escape.
 */
export function Tooltip({ content, side = 'top', describes = true, children }: TooltipProps) {
  const id = React.useId();
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [point, setPoint] = React.useState<{ top: number; left: number } | null>(null);

  const hide = React.useCallback(() => {
    clearTimeout(timer.current);
    setPoint(null);
  }, []);

  const show = React.useCallback((delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPoint(anchorPoint(rect, side));
    }, delay);
  }, [side]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  // While it is up: Escape dismisses it, and any scroll or resize invalidates the
  // point it was measured from, so drop it rather than let it drift.
  React.useEffect(() => {
    if (!point) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
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
      hide();
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
