import * as React from 'react';
import { Check, Minus } from 'lucide-react';

import { cn } from '../../lib/utils';

const BOX_SIZES = {
  sm: 'size-4',
  md: 'size-5',
} as const;

const ICON_SIZES = {
  sm: 'size-3',
  md: 'size-3.5',
} as const;

export type CheckboxSize = keyof typeof BOX_SIZES;

export interface CheckboxProps
  extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'role'> {
  /** Controlled state. Pair with `onCheckedChange`. */
  checked?: boolean;
  /** Uncontrolled initial state. @default false */
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Mixed/partial state — a dash instead of a tick, `aria-checked="mixed"`. Purely visual: a click still toggles `checked` like normal. */
  indeterminate?: boolean;
  size?: CheckboxSize;
  /** Text beside the control — the whole row becomes the tap target. */
  label?: React.ReactNode;
  /** Muted line under the label. */
  description?: React.ReactNode;
  /** Class for the outer `<label>` row (only when `label`/`description` set). */
  labelClassName?: string;
}

/**
 * A tri-state checkbox — the `role="checkbox"` control every form
 * hand-rolls. Controlled (`checked` + `onCheckedChange`) or uncontrolled
 * (`defaultChecked`); `indeterminate` draws the mixed dash (e.g. a "select
 * all" row over a partial selection). With `label`/`description` it renders
 * the whole labelled row and the text toggles too.
 *
 * @summary Checkbox with indeterminate state, and a labelled-row layout for forms.
 */
export function Checkbox({
  checked,
  defaultChecked = false,
  onCheckedChange,
  indeterminate = false,
  size = 'md',
  label,
  description,
  labelClassName,
  className,
  disabled,
  onClick,
  ...props
}: CheckboxProps) {
  const [own, setOwn] = React.useState(defaultChecked);
  const isOn = checked ?? own;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (checked === undefined) setOwn(!isOn);
    onCheckedChange?.(!isOn);
  };

  const Icon = indeterminate ? Minus : Check;

  const control = (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : isOn}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
        isOn || indeterminate ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-transparent',
        BOX_SIZES[size],
        className,
      )}
      {...props}
    >
      {(isOn || indeterminate) && <Icon className={ICON_SIZES[size]} strokeWidth={3} />}
    </button>
  );

  if (!label && !description) return control;

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3',
        disabled && 'cursor-not-allowed opacity-70',
        labelClassName,
      )}
    >
      {control}
      <span className="min-w-0">
        {label && <span className="block text-sm font-medium">{label}</span>}
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}
