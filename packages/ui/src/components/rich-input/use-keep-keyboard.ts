import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/**
 * Tapping a composer control on a phone must not move the on-screen keyboard:
 * hidden stays hidden, shown stays shown — and the textarea keeps focus either
 * way, so the chip rows stay open and typing resumes where it left off.
 *
 * Two things fight that on touch:
 *
 * 1. **Focus theft.** A tapped button takes focus (blur → keyboard gone). Most
 *    controls already `preventDefault()` their `mousedown`, but not all of them
 *    (toolbar entries, consumer-supplied children); the capture handler below
 *    does it for every non-editable target of a *touch* tap, so the textarea
 *    stays focused whatever was tapped. Mouse clicks are left alone.
 * 2. **IME re-show.** Android Chrome hides the keyboard on the back gesture
 *    *without* blurring the textarea, then re-shows it after any tap anywhere
 *    while an editable holds focus. So when a tap lands on a control while the
 *    keyboard is down, the textarea is switched to `inputmode="none"` — still
 *    focused, no keyboard. Tapping the text itself switches it back before the
 *    tap is handled, so the keyboard comes up exactly when asked for.
 *
 * iOS blurs on keyboard dismissal, so there (1) is all that applies: a tapped
 * chip doesn't refocus the textarea, and the keyboard stays down.
 */

/** Below this many px of viewport loss, it's browser chrome, not a keyboard. */
const KEYBOARD_MIN_PX = 120;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  // A <select> counts too: cancelling its mousedown would keep it from opening.
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
    return true;
  if (el instanceof HTMLInputElement) {
    return ![
      "button",
      "checkbox",
      "radio",
      "range",
      "color",
      "file",
      "submit",
      "reset",
      "image",
    ].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

export function useKeepKeyboard(taRef: RefObject<HTMLTextAreaElement | null>) {
  // Tallest visual viewport seen per orientation ≈ the keyboard-less height.
  // Measured against it rather than `innerHeight`, because a page opting into
  // `interactive-widget=resizes-content` shrinks both together.
  const tallest = useRef(new Map<string, number>());
  const touchTap = useRef(false);
  const savedMode = useRef<string | null | undefined>(undefined);

  const viewportHeight = () => {
    const vv = window.visualViewport;
    return vv ? vv.height * vv.scale : window.innerHeight;
  };
  const orientation = () =>
    window.innerWidth > window.innerHeight ? "l" : "p";

  useEffect(() => {
    const vv = window.visualViewport;
    const track = () => {
      const k = orientation();
      const h = viewportHeight();
      if (h > (tallest.current.get(k) ?? 0)) tallest.current.set(k, h);
    };
    track();
    vv?.addEventListener("resize", track);
    window.addEventListener("resize", track);
    return () => {
      vv?.removeEventListener("resize", track);
      window.removeEventListener("resize", track);
    };
  }, []);

  const keyboardShown = () => {
    const max = Math.max(
      tallest.current.get(orientation()) ?? 0,
      window.innerHeight,
    );
    return max - viewportHeight() > KEYBOARD_MIN_PX;
  };

  const restore = useCallback(() => {
    const ta = taRef.current;
    if (!ta || savedMode.current === undefined) return;
    if (savedMode.current === null) ta.removeAttribute("inputmode");
    else ta.setAttribute("inputmode", savedMode.current);
    savedMode.current = undefined;
  }, [taRef]);

  return useMemo(
    () => ({
      /** Wire to the textarea's `onBlur`: leaving it for real (another field,
       *  elsewhere on the page) must not leave it keyboard-less next time. */
      onTextareaBlur: restore,
      /** Spread on the composer's root. */
      rootProps: {
        onPointerDownCapture: (e: PointerEvent) => {
          touchTap.current = e.pointerType === "touch";
          const ta = taRef.current;
          if (!touchTap.current || !ta) return;
          const target = e.target as Element;
          if (ta.contains(target)) {
            restore(); // asking for the keyboard: give it back
            return;
          }
          if (isEditable(target)) return; // another field wants its own keyboard
          if (
            document.activeElement === ta &&
            !keyboardShown() &&
            savedMode.current === undefined
          ) {
            savedMode.current = ta.getAttribute("inputmode");
            ta.setAttribute("inputmode", "none");
          }
        },
        onMouseDownCapture: (e: MouseEvent) => {
          // Touch-synthesised mousedown only: keep focus where it is.
          if (!touchTap.current) return;
          const ta = taRef.current;
          if (
            ta &&
            document.activeElement === ta &&
            !isEditable(e.target as Element)
          )
            e.preventDefault();
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taRef, restore],
  );
}
