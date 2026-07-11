import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useTheme, type ThemeMode } from './theme';

export interface ThemeToggleProps {
  /**
   * `icon` — one button, light ⇄ dark.
   * `segmented` — light / system / dark, so "follow the OS" stays reachable.
   */
  variant?: 'icon' | 'segmented';
  className?: string;
}

/** The Sun/Moon button, wired to `useTheme` and persisted. */
export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, isDark, setTheme, toggle } = useTheme();

  if (variant === 'segmented') {
    const modes: [ThemeMode, typeof Sun, string][] = [
      ['light', Sun, 'Light'],
      ['system', Monitor, 'System'],
      ['dark', Moon, 'Dark'],
    ];
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className={cn('inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5', className)}
      >
        {modes.map(([mode, Icon, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={theme === mode}
            aria-label={label}
            title={label}
            onClick={() => setTheme(mode)}
            className={cn(
              'rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground',
              theme === mode && 'bg-muted text-foreground',
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light' : 'Dark'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
