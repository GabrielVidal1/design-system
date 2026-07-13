import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `theme.tsx` keeps its state in module-level singletons (mode/listeners/
// watching), by design — see its file comment. That means every test needs a
// *fresh* module instance (vi.resetModules + a dynamic re-import) or state
// leaks between tests; there is no exported reset hook.

type MatchMediaMock = ReturnType<typeof makeMatchMedia>;

function makeMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.delete(cb);
    },
  };
  return {
    mql,
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb({ matches }));
    },
  };
}

function installMatchMedia(initialMatches = false): MatchMediaMock {
  const mock = makeMatchMedia(initialMatches);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => mock.mql),
  );
  return mock;
}

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTheme / setTheme', () => {
  it('defaults to "system" and resolves against the OS preference', async () => {
    installMatchMedia(true); // OS is dark
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    expect(result.current.resolved).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme flips the `dark` class on <html> and persists to localStorage', async () => {
    installMatchMedia(false);
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem('ui-theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('reads a previously persisted theme on init', async () => {
    window.localStorage.setItem('ui-theme', 'light');
    installMatchMedia(true); // OS says dark, but the explicit choice wins
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.resolved).toBe('light');
  });

  it('toggle() flips light <-> dark', async () => {
    installMatchMedia(false);
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('light'));
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
  });

  it('toggle() from "system" flips to the opposite of what is currently showing', async () => {
    installMatchMedia(true); // system resolves dark
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('dark');

    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
  });

  it('a live prefers-color-scheme change updates both the DOM class and the hook value', async () => {
    const mock = installMatchMedia(false);
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('light');

    act(() => mock.setMatches(true));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(result.current.resolved).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  it('does not react to a system change once an explicit theme is set', async () => {
    const mock = installMatchMedia(false);
    const { useTheme } = await import('./theme');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('light'));
    act(() => mock.setMatches(true));
    expect(result.current.theme).toBe('light');
    expect(result.current.resolved).toBe('light');
  });
});

describe('ThemeToggle', () => {
  it('icon variant toggles the theme and updates its label on click', async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { ThemeToggle } = await import('./theme-toggle');
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Switch to dark theme' });
    await user.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('segmented variant renders a radiogroup and setTheme on click, checked state follows', async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { ThemeToggle } = await import('./theme-toggle');
    render(<ThemeToggle variant="segmented" />);

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    const darkRadio = screen.getByRole('radio', { name: 'Dark' });
    expect(darkRadio).toHaveAttribute('aria-checked', 'false');

    await user.click(darkRadio);
    expect(darkRadio).toHaveAttribute('aria-checked', 'true');
    expect(window.localStorage.getItem('ui-theme')).toBe('dark');
  });
});
