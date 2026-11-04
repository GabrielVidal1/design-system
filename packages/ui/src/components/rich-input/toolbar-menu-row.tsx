import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../lib/utils';

/**
 * The rows of the composer toolbar's `+` menu (the stashed controls): every
 * benched control reads as one settings row — `icon  Label ……… value ▾` for a
 * select, a switch for an on/off control, a plain action row otherwise — so
 * the menu is a tidy list instead of a heap of differently-shaped chips.
 *
 * A toolbar item opts in with {@link RichToolbarItem.menuNode}; the row faces
 * here are what that node is built from, so every consumer's rows line up.
 */

const ROW =
  'flex min-h-9 w-full items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-2.5 py-1.5 text-left text-[13px] transition-colors';

/**
 * A select row's face — no element of its own to click, so it can sit inside a
 * caller's popover trigger (which is the button). `value` is the current pick,
 * shown muted on the right with the dropdown chevron.
 */
export function ToolbarMenuRowFace({
  icon,
  label,
  value,
  chevron = true,
  className,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  /** The dropdown chevron after the value (default true). */
  chevron?: boolean;
  className?: string;
}) {
  return (
    <span
      data-toolbar-menu-row=""
      className={cn(ROW, 'group-hover/row:border-input group-hover/row:bg-accent/50', className)}
    >
      {icon != null && (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
      {value != null && (
        <span className="flex min-w-0 max-w-[60%] items-center gap-1 truncate text-[12px] text-muted-foreground">
          {value}
        </span>
      )}
      {chevron && <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
    </span>
  );
}

/** A menu row that acts on a press (attach files, open the history…). */
export const ToolbarMenuRowButton = forwardRef<
  HTMLButtonElement,
  {
    icon?: ReactNode;
    label: ReactNode;
    value?: ReactNode;
    chevron?: boolean;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'>
>(function ToolbarMenuRowButton({ icon, label, value, chevron = false, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      {...props}
      className={cn('group/row block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)}
    >
      <ToolbarMenuRowFace icon={icon} label={label} value={value} chevron={chevron} />
    </button>
  );
});

/** An on/off menu row: the label, and a switch on the right. */
export function ToolbarMenuSwitch({
  icon,
  label,
  checked,
  onCheckedChange,
  disabled,
  title,
}: {
  icon?: ReactNode;
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onCheckedChange(!checked)}
      className="group/row block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <span className={cn(ROW, 'group-hover/row:border-input group-hover/row:bg-accent/50')}>
        {icon != null && (
          <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
        <span
          aria-hidden
          className={cn(
            'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
            checked ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'absolute size-3 rounded-full bg-background shadow-sm transition-transform',
              checked ? 'translate-x-3.5' : 'translate-x-0.5',
            )}
          />
        </span>
      </span>
    </button>
  );
}

/**
 * The row a stashed control gets when it brings no {@link RichToolbarItem.menuNode}:
 * its label on the left, the control itself on the right — still a row like
 * the others.
 */
export function ToolbarMenuFallbackRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={cn(ROW, 'justify-between')}>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
      <span className="flex shrink-0 items-center">{children}</span>
    </div>
  );
}
