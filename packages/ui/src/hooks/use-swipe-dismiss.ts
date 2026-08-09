import * as React from 'react';

export interface UseSwipeDismissOptions {
  /** Horizontal travel (px) past which releasing dismisses. Default 72. */
  threshold?: number;
  /** Movement (px) before the gesture engages — under it, taps and vertical scrolls pass through. Default 8. */
  slop?: number;
  disabled?: boolean;
  /** Fired on a plain tap/click that never became a swipe. */
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Swipe-left-or-right to dismiss, for cards and banners (a sent-message
 * preview, an error toast). The element follows the pointer horizontally,
 * fading as it goes; releasing past the threshold flies it off-screen and calls
 * `onDismiss`, anything less springs it back. Vertical scrolling is untouched
 * (`touch-action: pan-y`, and the gesture only engages once the travel is
 * clearly horizontal), and it works with a mouse drag too.
 *
 * Spread the returned props onto the element. After a drag, the ensuing
 * `click` is swallowed once — so a card that is also a tap target doesn't
 * activate from the tail end of a swipe.
 *
 * @summary Swipe horizontally to dismiss, with spring-back under the threshold.
 */
export function useSwipeDismiss(
  onDismiss: () => void,
  { threshold = 72, slop = 8, disabled = false, onClick }: UseSwipeDismissOptions = {},
) {
  const [dx, setDx] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const engaged = React.useRef(false);
  // Swallow the click that follows a drag (fires after pointerup).
  const swiped = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismissRef = React.useRef(onDismiss);
  dismissRef.current = onDismiss;

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const settle = () => {
    start.current = null;
    engaged.current = false;
    setDx(0);
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled || leaving) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      engaged.current = false;
      swiped.current = false;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const from = start.current;
      if (!from || leaving) return;
      const moveX = e.clientX - from.x;
      const moveY = e.clientY - from.y;
      if (!engaged.current) {
        // Clearly vertical first ⇒ it's a scroll, not a swipe — let it go.
        if (Math.abs(moveY) > slop && Math.abs(moveY) > Math.abs(moveX)) {
          start.current = null;
          return;
        }
        if (Math.abs(moveX) < slop || Math.abs(moveX) < Math.abs(moveY)) return;
        engaged.current = true;
        swiped.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
      setDx(moveX);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!engaged.current) {
        start.current = null;
        return;
      }
      const travel = e.clientX - (start.current?.x ?? e.clientX);
      start.current = null;
      engaged.current = false;
      if (Math.abs(travel) < threshold) {
        setDx(0); // spring back
        return;
      }
      // Fly out in the swipe's direction, then dismiss.
      const width = (e.currentTarget as HTMLElement).offsetWidth || 320;
      setLeaving(true);
      setDx(travel < 0 ? -(width + 48) : width + 48);
      timer.current = setTimeout(() => {
        dismissRef.current();
        setLeaving(false);
        setDx(0);
      }, 170);
    },
    onPointerCancel: settle,
    onClick: (e: React.MouseEvent) => {
      if (swiped.current || leaving) {
        // The gesture already handled this press — don't also activate the card.
        e.preventDefault();
        e.stopPropagation();
        swiped.current = false;
        return;
      }
      onClick?.(e);
    },
    style: {
      touchAction: 'pan-y' as const,
      transform: dx ? `translateX(${dx}px)` : undefined,
      opacity: leaving ? 0 : dx ? Math.max(0.35, 1 - Math.abs(dx) / (threshold * 3)) : undefined,
      transition: engaged.current ? 'none' : 'transform 170ms ease, opacity 170ms ease',
    },
  };
}
