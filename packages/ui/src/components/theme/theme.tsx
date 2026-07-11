import * as React from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

/*
 * A module-level store rather than a context, because the theme is one global
 * fact: `useTheme()` works anywhere with no provider, and `<ThemeProvider>` is
 * only needed to change the storage key or the default. Every subscriber shares
 * one `matchMedia` listener via `useSyncExternalStore`.
 */

let storageKey = 'ui-theme';
let fallback: ThemeMode = 'system';
let mode: ThemeMode | null = null;
const listeners = new Set<() => void>();

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function init(): ThemeMode {
  if (mode) return mode;
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(storageKey) as ThemeMode | null;
  mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : fallback;
  apply();
  watchSystem();
  return mode;
}

function apply() {
  if (typeof document === 'undefined' || !mode) return;
  const dark = mode === 'dark' || (mode === 'system' && systemDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  // Keep the mobile browser chrome in step with the page, or a dark page keeps
  // a white notch bar.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--background').trim();
    if (bg) meta.content = bg;
  }
}

let watching = false;
function watchSystem() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (mode === 'system') {
      apply();
      listeners.forEach((l) => l());
    }
  });
}

/** Set the theme from anywhere — a settings page, a keyboard shortcut, a test. */
export function setTheme(next: ThemeMode) {
  mode = next;
  try {
    window.localStorage.setItem(storageKey, next);
  } catch {
    /* private mode — the theme still applies for this session */
  }
  apply();
  listeners.forEach((l) => l());
}

/** Light ⇄ dark. From `system`, flips to the opposite of what is showing. */
export function toggleTheme() {
  setTheme(resolveTheme() === 'dark' ? 'light' : 'dark');
}

/** What is actually on screen right now (`system` resolved against the OS). */
export function resolveTheme(): 'light' | 'dark' {
  const m = init();
  return m === 'system' ? (systemDark() ? 'dark' : 'light') : m;
}

function subscribe(l: () => void) {
  init();
  listeners.add(l);
  return () => listeners.delete(l);
}

export interface UseThemeResult {
  /** The chosen mode, including `system`. */
  theme: ThemeMode;
  /** The mode in effect — `system` already resolved. */
  resolved: 'light' | 'dark';
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggle: () => void;
}

/** The dark-mode hook. No provider required. */
export function useTheme(): UseThemeResult {
  const theme = React.useSyncExternalStore(
    subscribe,
    () => init(),
    () => fallback,
  );
  const resolved = theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme;
  return { theme, resolved, isDark: resolved === 'dark', setTheme, toggle: toggleTheme };
}

/**
 * Optional — only to override the defaults (`localStorage['ui-theme']`,
 * defaulting to the OS preference). Configure before the first paint.
 */
export function ThemeProvider({
  children,
  storageKey: key = 'ui-theme',
  defaultTheme = 'system',
}: {
  children?: React.ReactNode;
  storageKey?: string;
  defaultTheme?: ThemeMode;
}) {
  if (key !== storageKey || defaultTheme !== fallback) {
    storageKey = key;
    fallback = defaultTheme;
    mode = null; // re-read under the new key
  }
  useTheme(); // mount the subscription so the class lands before paint
  return <>{children}</>;
}
