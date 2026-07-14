import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@gabvdl/ui';

/**
 * Chrome for a full-page demo: one slim bar (back to the demos index, the
 * demo's name, which primitives it proves, the theme toggle) above an app that
 * owns the rest of the viewport. `h-dvh overflow-hidden` — the demo scrolls
 * inside itself, like the real service frontends these pages imitate.
 */
export function DemoShell({
  name,
  proves,
  children,
}: {
  name: string;
  /** The components this screen is built from — the card's receipt. */
  proves: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${name} — gabvdl/ui demos`;
    return () => {
      document.title = 'gabvdl/ui';
    };
  }, [name]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/demos"
            className="mono inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> demos
          </Link>
          <span className="mono truncate text-sm text-foreground">{name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono hidden truncate text-[11px] text-muted-foreground md:inline">{proves}</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
