import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible name for the toolbar. @default 'Toolbar' */
  label?: string;
  /** Collapse trailing items into a "⋯" menu when they don't fit.
   *  @default true */
  overflow?: boolean;
  /** Lay the toolbar out vertically (left rail). Disables overflow.
   *  @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /** Groups/buttons/separators. Overflow collapses **direct children** — pass
   *  an array, not a wrapper component or fragment, or the strip can only
   *  collapse as one block. */
  children: React.ReactNode;
}

export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Group heading — visually hidden inline, shown in the overflow menu. */
  label?: string;
  children: React.ReactNode;
}

export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** What the tool does — the aria-label/tooltip inline, the row text in the
   *  overflow menu. */
  label: string;
  /** The selected-tool state (`aria-pressed`). */
  active?: boolean;
  /** Keyboard hint shown in the overflow menu (e.g. `V`, `⌘Z`). */
  shortcut?: string;
  /** The icon (or any content). */
  children?: React.ReactNode;
}

/** True while rendering inside the overflow menu — children switch from
 *  icon-square to labelled-row layout. */
const OverflowContext = React.createContext(false);

/** The toolbar's axis, so groups and separators orient themselves. */
const OrientationContext = React.createContext<'horizontal' | 'vertical'>('horizontal');

/**
 * The editor toolbar: `ToolbarGroup`s of icon `ToolbarButton`s (with an
 * `active` tool state) separated by hairlines, plus `ToolbarSeparator` for
 * ad-hoc breaks. When the strip is wider than its container, trailing groups
 * collapse into a "⋯" menu — sized live via ResizeObserver, so it adapts to
 * phones and to desktop panel resizes alike. Arrow keys walk the tools.
 *
 * @summary Editor toolbar — grouped icon buttons with an active-tool state
 * that collapse into a "⋯" menu when they don't fit.
 */
export function Toolbar({
  label = 'Toolbar',
  overflow = true,
  orientation = 'horizontal',
  children,
  className,
  ...props
}: ToolbarProps) {
  const units = React.Children.toArray(children);
  const vertical = orientation === 'vertical';
  const collapse = overflow && !vertical;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(units.length);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // How many units fit: measured from a hidden copy of the full strip, so the
  // visible strip never has to render-then-shrink.
  React.useLayoutEffect(() => {
    if (!collapse) return;
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;

    const compute = () => {
      const kids = Array.from(measure.children) as HTMLElement[];
      // Last measured child is the "⋯" button.
      const more = kids.pop();
      const moreW = (more?.offsetWidth ?? 36) + GAP;
      const avail = root.clientWidth;
      // Never collapse blind: unmeasurable (display:none, jsdom), or a child
      // that rendered a fragment/multiple nodes so DOM nodes ≠ React units —
      // slicing units wouldn't match what was measured.
      if (avail <= 0 || kids.length !== units.length || kids.every((k) => k.offsetWidth === 0)) {
        setVisibleCount(units.length);
        return;
      }
      let used = 0;
      let fit = 0;
      for (const kid of kids) {
        used += kid.offsetWidth + (fit > 0 ? GAP : 0);
        if (used > avail) break;
        fit++;
      }
      if (fit >= kids.length) {
        setVisibleCount(kids.length);
        return;
      }
      // Not everything fits — walk back until the "⋯" button fits too.
      while (fit > 0) {
        used = 0;
        for (let i = 0; i < fit; i++) used += kids[i].offsetWidth + (i > 0 ? GAP : 0);
        if (used + moreW <= avail) break;
        fit--;
      }
      setVisibleCount(fit);
    };

    compute();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(compute);
    ro.observe(root);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [collapse, units.length]);

  const allFit = !collapse || visibleCount >= units.length;
  const visible = allFit ? units : units.slice(0, visibleCount);
  const hidden = allFit ? [] : units.slice(visibleCount);

  React.useEffect(() => {
    if (allFit) setMenuOpen(false);
  }, [allFit]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const fwd = vertical ? 'ArrowDown' : 'ArrowRight';
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    if (e.key !== fwd && e.key !== back) return;
    const root = rootRef.current;
    if (!root) return;
    const tools = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(
      (b) => !measureRef.current?.contains(b),
    );
    const i = tools.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1 || tools.length === 0) return;
    e.preventDefault();
    tools[(i + (e.key === fwd ? 1 : -1) + tools.length) % tools.length]?.focus();
  };

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(
        'ds-toolbar relative flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-sm',
        vertical && 'w-fit flex-col',
        className,
      )}
      {...props}
    >
      <OrientationContext.Provider value={orientation}>
      {visible}

      {!allFit && (
        <div className="relative ml-auto shrink-0">
          <MoreButton open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />
          {menuOpen && (
            <OverflowMenu onClose={() => setMenuOpen(false)}>{hidden}</OverflowMenu>
          )}
        </div>
      )}

      {/* Hidden twin used only for measuring — every unit plus the "⋯".
          The zero-sized clipping wrapper is load-bearing: the twin is as wide
          as the *uncollapsed* strip, and an absolutely positioned box that
          wide still counts as scrollable overflow, which propagates all the
          way up and makes the whole page scroll sideways on a phone — the
          opposite of what a collapsing toolbar is for. Clipped to a 0×0 box it
          can't, and `w-max` keeps the twin at its natural width inside it. */}
      {collapse && (
        <div
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 size-0 overflow-clip"
        >
          <div ref={measureRef} className="flex w-max items-center gap-2 p-1">
            {units}
            <MoreButton open={false} onToggle={() => {}} />
          </div>
        </div>
      )}
      </OrientationContext.Provider>
    </div>
  );
}

const GAP = 8; // the strip's gap-2, used when summing measured unit widths

function MoreButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label="More tools"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        'flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        open && 'bg-muted text-foreground',
      )}
    >
      <MoreHorizontal className="size-4" />
    </button>
  );
}

/** The collapsed tools, re-rendered as labelled rows in a dropdown. */
function OverflowMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useOutsideClick<HTMLDivElement>(onClose);
  useEscape(onClose);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="More tools"
      className="ds-toolbar-overflow absolute right-0 top-full z-50 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
    >
      <OverflowContext.Provider value={true}>{children}</OverflowContext.Provider>
    </div>
  );
}

/**
 * A group of related tools. Inline it reads as a cluster with hairlines
 * between neighbouring groups; in the overflow menu it becomes a titled
 * section.
 *
 * @summary Cluster of related toolbar buttons, separated by hairlines inline
 * and titled in the overflow menu.
 */
export function ToolbarGroup({ label, children, className, ...props }: ToolbarGroupProps) {
  const inOverflow = React.useContext(OverflowContext);
  const vertical = React.useContext(OrientationContext) === 'vertical';

  if (inOverflow) {
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-0.5">
        {label && (
          <div className="px-2 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'ds-toolbar-group flex shrink-0 items-center gap-0.5',
        // Hairline between neighbouring groups.
        vertical
          ? 'flex-col [.ds-toolbar-group+&]:border-t [.ds-toolbar-group+&]:border-border [.ds-toolbar-group+&]:pt-2'
          : '[.ds-toolbar-group+&]:border-l [.ds-toolbar-group+&]:border-border [.ds-toolbar-group+&]:pl-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * One tool. Inline it is a finger-sized icon square (`label` becomes the
 * tooltip and accessible name); in the overflow menu it is an icon + label
 * (+ shortcut) row. `active` marks the selected tool via `aria-pressed`.
 *
 * @summary Icon tool button with an `active` (selected-tool) state; renders
 * as a labelled row inside the toolbar's overflow menu.
 */
export function ToolbarButton({
  label,
  active = false,
  shortcut,
  children,
  className,
  ...props
}: ToolbarButtonProps) {
  const inOverflow = React.useContext(OverflowContext);

  if (inOverflow) {
    return (
      <button
        type="button"
        role="menuitem"
        aria-pressed={active}
        className={cn(
          'flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
        {...props}
      >
        <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
          {children}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {shortcut && (
          <kbd className="shrink-0 font-mono text-[11px] uppercase tabular-nums opacity-60">
            {shortcut}
          </kbd>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * A hairline break between tools, for splits finer than whole groups.
 *
 * @summary Hairline divider between toolbar items.
 */
export function ToolbarSeparator({ className }: { className?: string }) {
  const inOverflow = React.useContext(OverflowContext);
  const vertical = React.useContext(OrientationContext) === 'vertical';
  const flat = inOverflow || vertical;
  return (
    <div
      role="separator"
      aria-orientation={flat ? 'horizontal' : 'vertical'}
      className={cn(
        flat ? 'my-1 h-px w-full min-w-6 shrink-0 bg-border' : 'mx-0.5 h-6 w-px shrink-0 bg-border',
        className,
      )}
    />
  );
}
