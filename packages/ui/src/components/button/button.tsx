import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';
import { Tooltip, type TooltipSide } from './tooltip';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';

/**
 * Three text tiers (`sm` / `md` / `lg`) plus a square icon-only tier for each.
 * `default` and `icon` are kept as aliases of `md` / `icon-md`.
 */
export type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'icon-sm'
  | 'icon-md'
  | 'icon-lg'
  | 'default'
  | 'icon';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-transparent hover:bg-muted',
  ghost: 'hover:bg-muted',
  destructive: 'text-destructive hover:bg-destructive/10',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 gap-1.5 text-xs [&_svg]:size-3.5',
  md: 'h-9 px-4 gap-2 text-sm [&_svg]:size-4',
  lg: 'h-11 px-6 gap-2.5 text-base [&_svg]:size-5',
  'icon-sm': 'size-8 [&_svg]:size-3.5',
  'icon-md': 'size-9 [&_svg]:size-4',
  'icon-lg': 'size-11 [&_svg]:size-5',
  default: 'h-9 px-4 gap-2 text-sm [&_svg]:size-4',
  icon: 'size-9 [&_svg]:size-4',
};

const ICON_ONLY: ReadonlySet<ButtonSize> = new Set<ButtonSize>([
  'icon-sm',
  'icon-md',
  'icon-lg',
  'icon',
]);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Swap the leading icon for a spinner, disable the button and mark it
   * `aria-busy`. The label stays put so the button does not resize.
   */
  loading?: boolean;
  /** Announced (and shown, on a text-tier button) in place of the label while `loading`. */
  loadingText?: string;
  /** Leading icon — or the only content, on an `icon-*` tier. */
  icon?: React.ReactNode;
  /** Put `icon` after the label instead of before it. */
  iconPosition?: 'left' | 'right';
  /**
   * Hover/focus hint. On an icon-only button it also becomes the accessible
   * name when no `aria-label` is given; otherwise it is wired up as
   * `aria-describedby`.
   */
  tooltip?: React.ReactNode;
  tooltipSide?: TooltipSide;
}

/**
 * The design-system button: four variants, three size tiers (icon-only twins of
 * each), an icon slot, a loading state and an optional tooltip.
 *
 * `type` defaults to `"button"` so dropping one inside a form never submits it
 * by accident — pass `type="submit"` when that is what you want.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    type = 'button',
    loading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    tooltip,
    tooltipSide = 'top',
    disabled,
    children,
    ...props
  },
  ref,
) {
  const iconOnly = ICON_ONLY.has(size);
  const showsLoadingText = loading && !!loadingText && !iconOnly;
  const label = showsLoadingText ? loadingText : children;
  const glyph = loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon;

  // An icon-only button has no text to name it: fall back to the tooltip when
  // it is a plain string, so `<Button size="icon" icon={<X />} tooltip="Close" />`
  // is announced as "Close" rather than as an unlabelled button. When it serves
  // as the name it must not also describe the button — that reads it twice.
  const tooltipIsName = iconOnly && typeof tooltip === 'string' && !props['aria-label'];
  const ariaLabel = props['aria-label'] ?? (tooltipIsName ? (tooltip as string) : undefined);

  const button = (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&_svg]:shrink-0',
        // A disabled button normally stops taking pointer events at all — but a
        // tooltip is exactly what you want to read when a button is disabled or
        // busy, so keep it hoverable in that case.
        tooltip ? 'disabled:cursor-not-allowed' : 'disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {glyph && iconPosition === 'left' && glyph}
      {label}
      {glyph && iconPosition === 'right' && glyph}
      {/* Announce the busy state — unless the visible label already says it. */}
      {loading && !showsLoadingText && (
        <span className="sr-only" role="status">
          {loadingText ?? 'Loading'}
        </span>
      )}
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip content={tooltip} side={tooltipSide} describes={!tooltipIsName}>
      {button}
    </Tooltip>
  );
});
