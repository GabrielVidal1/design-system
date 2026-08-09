import * as React from 'react';

import { cn } from '../../lib/utils';

export interface FieldProps {
  /** The field's label. Rendered as a `<label>` wired to the control via `id`. */
  label?: React.ReactNode;
  /** Muted helper line under the control. Hidden while `error` is set. */
  hint?: React.ReactNode;
  /** Validation message. Replaces `hint`, tints the label and the message red. */
  error?: React.ReactNode;
  /** Shows a `*` after the label. Purely visual — doesn't set `required` on the control. */
  required?: boolean;
  /**
   * Id to wire the label/hint/error to, via the control's own `id` and
   * `aria-describedby`. Auto-generated when omitted — only pass this if the
   * control already needs a stable id for another reason.
   */
  htmlFor?: string;
  /** Class for the outer wrapper. */
  className?: string;
  /**
   * A single form control (`Input`, `Textarea`, `Select`, …). Its `id` and
   * `aria-describedby`/`aria-invalid` are filled in automatically unless
   * already set — pass a plain node instead to opt out.
   */
  children: React.ReactNode;
}

/**
 * The label + hint/error wrapper every form re-implements around `Input`,
 * `Textarea` and `Select`. Generates the control's `id` (or uses `htmlFor`),
 * wires `aria-describedby` to the hint/error text and `aria-invalid` on
 * error, so a form only ever needs to pass `label`/`hint`/`error` — no
 * hand-rolled ids.
 *
 * @summary Label + hint/error wrapper for a single form control, so forms look uniform.
 */
export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const control =
    React.isValidElement(children) ?
      React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        'aria-describedby':
          [(children.props as { 'aria-describedby'?: string })['aria-describedby'], describedBy]
            .filter(Boolean)
            .join(' ') || undefined,
        'aria-invalid': error ? true : (children.props as { 'aria-invalid'?: boolean })['aria-invalid'],
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn('text-sm font-medium', error && 'text-destructive')}
        >
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error ?
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      : hint ?
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      : null}
    </div>
  );
}
