import * as React from 'react';

import { cn } from '../../lib/utils';

interface RadioGroupContextValue {
  value: string | undefined;
  select: (value: string) => void;
  name: string;
  disabled: boolean;
}

const RadioGroupCtx = React.createContext<RadioGroupContextValue | null>(null);

function useRadioGroup(component: string): RadioGroupContextValue {
  const ctx = React.useContext(RadioGroupCtx);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <RadioGroup>`);
  return ctx;
}

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled selected value. Pair with `onValueChange`. */
  value?: string;
  /** Initial selection when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Groups the native accessibility tree; also read by `<Radio>` for its `name`. */
  name?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * A radio group — one selection out of a set, with the WAI-ARIA
 * roving-tabindex radiogroup pattern: Tab enters/leaves once, arrow keys
 * move (and select) between options.
 *
 * ```tsx
 * <RadioGroup value={plan} onValueChange={setPlan}>
 *   <Radio value="free" label="Free" />
 *   <Radio value="pro" label="Pro" description="$9/mo" />
 * </RadioGroup>
 * ```
 *
 * @summary Single-choice radio group with roving-tabindex keyboard navigation.
 */
export function RadioGroup({
  value: controlled,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
  orientation = 'vertical',
  className,
  children,
  ...props
}: RadioGroupProps) {
  const [own, setOwn] = React.useState(defaultValue);
  const value = controlled ?? own;
  const groupName = React.useId();
  const ref = React.useRef<HTMLDivElement>(null);

  const select = React.useCallback(
    (next: string) => {
      if (controlled === undefined) setOwn(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const backward = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    if (![forward, backward, 'Home', 'End'].includes(e.key)) return;
    const all = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)') ?? []);
    const i = all.findIndex((r) => r === document.activeElement);
    if (i === -1) return;
    e.preventDefault();

    const next =
      e.key === 'Home' ? all[0] : e.key === 'End' ? all[all.length - 1] : all[(i + (e.key === forward ? 1 : -1) + all.length) % all.length];

    next?.focus();
    if (next?.dataset.value) select(next.dataset.value);
  }

  return (
    <RadioGroupCtx.Provider value={{ value, select, name: name ?? groupName, disabled }}>
      <div
        ref={ref}
        role="radiogroup"
        aria-orientation={orientation}
        onKeyDown={onKeyDown}
        className={cn('flex', orientation === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2.5', className)}
        {...props}
      >
        {children}
      </div>
    </RadioGroupCtx.Provider>
  );
}

const DOT_SIZES = { sm: 'size-4', md: 'size-5' } as const;
const DOT_INNER_SIZES = { sm: 'size-1.5', md: 'size-2' } as const;

export type RadioSize = keyof typeof DOT_SIZES;

export interface RadioProps extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'role'> {
  /** The value this option selects — matches a `<RadioGroup value>`. */
  value: string;
  size?: RadioSize;
  /** Text beside the control — the whole row becomes the tap target. */
  label?: React.ReactNode;
  /** Muted line under the label. */
  description?: React.ReactNode;
  /** Class for the outer `<label>` row (only when `label`/`description` set). */
  labelClassName?: string;
}

/** One option inside a `<RadioGroup>`. */
export function Radio({
  value,
  size = 'md',
  label,
  description,
  labelClassName,
  className,
  disabled,
  onClick,
  ...props
}: RadioProps) {
  const ctx = useRadioGroup('Radio');
  const selected = ctx.value === value;
  const isDisabled = disabled ?? ctx.disabled;

  const control = (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-value={value}
      name={ctx.name}
      disabled={isDisabled}
      tabIndex={selected || ctx.value === undefined ? 0 : -1}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.select(value);
      }}
      className={cn(
        'inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
        selected ? 'border-primary' : 'border-input',
        DOT_SIZES[size],
        className,
      )}
      {...props}
    >
      {selected && <span aria-hidden className={cn('rounded-full bg-primary', DOT_INNER_SIZES[size])} />}
    </button>
  );

  if (!label && !description) return control;

  return (
    <label
      className={cn('flex cursor-pointer items-start gap-3', isDisabled && 'cursor-not-allowed opacity-70', labelClassName)}
    >
      {control}
      <span className="min-w-0">
        {label && <span className="block text-sm font-medium">{label}</span>}
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}
