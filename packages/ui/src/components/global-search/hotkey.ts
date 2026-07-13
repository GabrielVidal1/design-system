import { useEffect } from 'react';

export interface Hotkey {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  /** `Mod` — Cmd on Apple platforms, Ctrl everywhere else. */
  mod: boolean;
}

const isApple = () =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

/**
 * Parse a combo string — `Ctrl+K`, `Meta+K`, `Cmd+Shift+P`, `Mod+K`, `/` — into
 * the flags a `keydown` handler compares against. `Mod` is the portable one: it
 * means Cmd on a Mac and Ctrl elsewhere.
 */
export function parseHotkey(combo: string): Hotkey {
  const parts = combo.split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const key = parts[parts.length - 1] ?? '';
  const has = (...names: string[]) => parts.slice(0, -1).some((p) => names.includes(p));
  return {
    key,
    ctrl: has('ctrl', 'control'),
    meta: has('meta', 'cmd', 'command'),
    shift: has('shift'),
    alt: has('alt', 'option'),
    mod: has('mod'),
  };
}

function matches(e: KeyboardEvent, h: Hotkey): boolean {
  if (e.key.toLowerCase() !== h.key) return false;
  const mod = isApple() ? e.metaKey : e.ctrlKey;
  if (h.mod && !mod) return false;
  if (h.ctrl && !e.ctrlKey) return false;
  if (h.meta && !e.metaKey) return false;
  if (h.shift !== e.shiftKey) return false;
  if (h.alt !== e.altKey) return false;
  // A bare key (no modifier in the combo) must not fire while a modifier is held
  // — `/` shouldn't hijack Ctrl+/.
  if (!h.mod && !h.ctrl && !h.meta && (e.ctrlKey || e.metaKey)) return false;
  return true;
}

/** Whether the event came from somewhere the user is typing. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

/**
 * Bind a global keyboard shortcut. Combos with a modifier (`Mod+K`) fire even
 * while an input has focus; bare keys (`/`) stand down so they can be typed.
 */
export function useHotkey(combo: string | null | undefined, handler: () => void, enabled = true) {
  useEffect(() => {
    if (!combo || !enabled) return;
    const hk = parseHotkey(combo);
    const bare = !hk.mod && !hk.ctrl && !hk.meta && !hk.alt;
    const onKeyDown = (e: KeyboardEvent) => {
      if (bare && isTyping(e.target)) return;
      if (!matches(e, hk)) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled, handler]);
}

/** Render a combo the way the current platform writes it: `⌘K` / `Ctrl K`. */
export function formatHotkey(combo: string): string[] {
  const hk = parseHotkey(combo);
  const apple = isApple();
  const out: string[] = [];
  if (hk.mod) out.push(apple ? '⌘' : 'Ctrl');
  if (hk.ctrl) out.push(apple ? '⌃' : 'Ctrl');
  if (hk.meta && !hk.mod) out.push(apple ? '⌘' : 'Win');
  if (hk.alt) out.push(apple ? '⌥' : 'Alt');
  if (hk.shift) out.push(apple ? '⇧' : 'Shift');
  out.push(hk.key.length === 1 ? hk.key.toUpperCase() : hk.key);
  return out;
}
