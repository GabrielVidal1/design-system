import * as React from 'react';

export interface LongPressPoint {
  x: number;
  y: number;
}

export interface UseLongPressOptions {
  /** Hold duration before it fires, in ms. */
  delay?: number;
  /** Movement (px) that cancels the press — a scroll, not a hold. */
  moveTolerance?: number;
  /** Also fire on a desktop right-click (contextmenu). Default true. */
  contextMenu?: boolean;
  /** Fired on a plain tap/click that never became a long press. */
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Long-press (and right-click) as a gesture, with the press coordinates — so a
 * context menu can be anchored where the finger actually landed.
 *
 * Spread the returned props onto any element. After the gesture fires, the
 * ensuing `click` is swallowed once: without that, a long press on a link both
 * opens the menu and follows the link.
 */
export function useLongPress(
  onLongPress: (point: LongPressPoint) => void,
  { delay = 450, moveTolerance = 10, contextMenu = true, onClick }: UseLongPressOptions = {},
) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = React.useRef<LongPressPoint | null>(null);
  const fired = React.useRef(false);

  const cancel = React.useCallback(() => {
    clearTimeout(timer.current);
    start.current = null;
  }, []);

  React.useEffect(() => cancel, [cancel]);

  const begin = (point: LongPressPoint) => {
    fired.current = false;
    start.current = point;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      start.current = null;
      onLongPress(point);
    }, delay);
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // right-click has its own path
      begin({ x: e.clientX, y: e.clientY });
    },
    onPointerMove: (e: React.PointerEvent) => {
      const from = start.current;
      if (!from) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > moveTolerance) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      if (!contextMenu) return;
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress({ x: e.clientX, y: e.clientY });
    },
    onClick: (e: React.MouseEvent) => {
      if (fired.current) {
        // The gesture already handled this press — don't also navigate.
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
        return;
      }
      onClick?.(e);
    },
    style: { WebkitTouchCallout: 'none' as const, touchAction: 'manipulation' as const },
  };
}
