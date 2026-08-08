import * as React from 'react';

import { cn } from '../../lib/utils';

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  /**
   * Grow with the content instead of scrolling internally, between `rows`
   * (the floor) and `maxRows`. @default true
   */
  autoGrow?: boolean;
  /** Ceiling for `autoGrow`, in rows. @default 10 */
  maxRows?: number;
}

/**
 * A multi-line text input, styled to match `Input`. Auto-grows with its
 * content by default (between `rows` and `maxRows`), so callers don't
 * hand-roll a `scrollHeight` measurer for every settings/comment box.
 *
 * @summary Multi-line text input, styled to the theme tokens, that auto-grows with content.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = true, maxRows = 10, rows = 3, onChange, style, ...props },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

  const measure = React.useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, maxRows * lineHeight)}px`;
  }, [autoGrow, maxRows]);

  React.useLayoutEffect(measure, [measure, props.value, props.defaultValue]);

  return (
    <textarea
      ref={innerRef}
      rows={rows}
      onChange={(e) => {
        onChange?.(e);
        if (autoGrow) measure();
      }}
      style={autoGrow ? { ...style, resize: 'none', overflow: 'hidden' } : style}
      className={cn(
        'w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 md:text-sm',
        !autoGrow && 'resize-y',
        className,
      )}
      {...props}
    />
  );
});
