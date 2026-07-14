import * as React from 'react';

import { cn } from '../../lib/utils';

const TRACK_SIZES = {
  sm: 'h-5 w-8',
  md: 'h-6 w-10',
} as const;

const THUMB_SIZES = {
  sm: 'size-4 group-aria-checked:translate-x-3',
  md: 'size-5 group-aria-checked:translate-x-4',
} as const;

export type SwitchSize = keyof typeof TRACK_SIZES;

export interface SwitchProps
  extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'role'> {
  /** Controlled state. Pair with `onCheckedChange`. */
  checked?: boolean;
  /** Uncontrolled initial state. @default false */
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitchSize;
  /** Text beside the control — the whole row becomes the tap target. */
  label?: React.ReactNode;
  /** Muted line under the label. */
  description?: React.ReactNode;
  /** Class for the outer `<label>` row (only when `label`/`description` set). */
  labelClassName?: string;
}

/**
 * An on/off toggle — the `role="switch"` control every settings page
 * hand-rolls. Controlled (`checked` + `onCheckedChange`) or uncontrolled
 * (`defaultChecked`); with `label`/`description` it renders the whole
 * labelled row and the text toggles too.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  size = 'md',
  label,
  description,
  labelClassName,
  className,
  disabled,
  onClick,
  ...props
}: SwitchProps) {
  const [own, setOwn] = React.useState(defaultChecked);
  const isOn = checked ?? own;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (checked === undefined) setOwn(!isOn);
    onCheckedChange?.(!isOn);
  };

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'group relative inline-flex shrink-0 cursor-pointer touch-manipulation items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
        isOn ? 'bg-primary' : 'bg-input',
        TRACK_SIZES[size],
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none block translate-x-0 rounded-full bg-background shadow-sm transition-transform duration-200 ease-out',
          THUMB_SIZES[size],
        )}
      />
    </button>
  );

  if (!label && !description) return control;

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-70',
        labelClassName,
      )}
    >
      <span className="min-w-0">
        {label && <span className="block text-sm font-medium">{label}</span>}
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>
      {control}
    </label>
  );
}
