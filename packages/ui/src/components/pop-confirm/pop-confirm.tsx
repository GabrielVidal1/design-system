import * as React from 'react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { Button, type ButtonProps } from '../button';
import { Popover, type PopoverAlign, type PopoverProps, type PopoverSide } from '../popover';

/** The bubble's own mark, drawn inline rather than pulled from an icon set: it
 *  is the one glyph the component always needs, and `currentColor` lets the
 *  wrapper below tint it from a token class instead of hard-coding a fill. */
function WarningGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.85" fill="currentColor" />
    </svg>
  );
}

/** `void` and `undefined` returns close the bubble at once; only a thenable
 *  earns the loading state, so the common synchronous handler never flashes
 *  a spinner for one frame. */
function isThenable(value: unknown): value is Promise<unknown> {
  return typeof (value as Promise<unknown> | undefined)?.then === 'function';
}

export interface PopConfirmProps {
  /** The element whose click asks the question — same shape {@link Popover} takes. */
  trigger: PopoverProps['trigger'];
  /** The question itself, e.g. "Delete this note?". */
  title: React.ReactNode;
  /** Optional second line — the consequence, when the title can't carry it. */
  description?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  /** `destructive` for deletes; anything the {@link Button} accepts otherwise. */
  okVariant?: ButtonProps['variant'];
  /** Replace the warning glyph, or pass `false` to drop it. */
  icon?: React.ReactNode | false;
  /** A returned promise holds the bubble open (OK in its loading state) until it
   *  settles; a rejection leaves it open so the caller can surface the error. */
  onConfirm?: () => void | Promise<void>;
  /** Fired by the Cancel button *and* by every dismissal — Escape, an outside
   *  click, a second click on the trigger. */
  onCancel?: () => void;
  /** Skip the confirmation entirely: the trigger's own `onClick` runs and no
   *  bubble opens. For "this action needs no confirming right now". */
  disabled?: boolean;
  /** Controlled open state. Pair with `onOpenChange`. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Force (or forbid) the bottom-sheet shape. Default: sheet on phones. */
  sheet?: boolean;
  /** Accessible name for the bubble. Defaults to `title` when it is a string —
   *  pass this when it isn't, or the phone sheet renders with no header. */
  ariaLabel?: string;
  /** Class for the anchored panel / sheet. */
  className?: string;
}

/**
 * The one-question confirmation bubble: an icon, a question, optional detail
 * and a Cancel/OK pair, anchored to whatever triggered it. Use it instead of a
 * full `Modal` + `useConfirm` when the action is small and roughly reversible —
 * it keeps the answer next to the thing being answered about.
 *
 * Built on {@link Popover}, so side-flip, outside-click, Escape and the
 * phone bottom sheet all come for free; dismissing by any of those routes
 * counts as a "no" and fires `onCancel`.
 *
 * An async `onConfirm` puts OK into its loading state and pins the bubble open
 * until the promise settles — dismissal is ignored while the action is in
 * flight, and a rejection clears the spinner without closing.
 *
 * @summary Inline Cancel/OK confirmation bubble anchored to its trigger — the
 * lightweight stand-in for a confirm dialog on small, reversible actions.
 */
export function PopConfirm({
  trigger,
  title,
  description,
  okText = 'Yes',
  cancelText = 'No',
  okVariant = 'default',
  icon,
  onConfirm,
  onCancel,
  disabled = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side,
  align,
  sheet,
  ariaLabel,
  className,
}: PopConfirmProps) {
  const [own, setOwn] = React.useState(defaultOpen);
  const [pending, setPending] = React.useState(false);
  const open = openProp !== undefined ? openProp : own;

  // Repeat Popover's own sheet decision instead of guessing with breakpoint
  // classes: the action row has to know which of the two shapes it landed in,
  // and `sheet ?? isMobile` is exactly how Popover picks.
  const isMobile = useIsMobile();
  const asSheet = sheet ?? isMobile;

  // Popover is always driven controlled from here — confirming has to close the
  // bubble by itself, which then lets one handler tell a dismissal (a "no")
  // apart from a button answer (already handled). So PopConfirm resolves the
  // controlled/uncontrolled split itself and hands Popover a plain `open`.
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwn(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const cancel = () => {
    setOpen(false);
    onCancel?.();
  };

  const confirm = () => {
    const result = onConfirm?.();
    if (!isThenable(result)) {
      setOpen(false);
      return;
    }
    setPending(true);
    result.then(
      () => {
        setPending(false);
        setOpen(false);
      },
      () => {
        // Left open on purpose: the caller shows why it failed (a toast, an
        // inline error), and the user still has the same button to retry.
        setPending(false);
      },
    );
  };

  // Hand the trigger back untouched rather than rendering a Popover that can
  // never open — no wrapper element, no `aria-haspopup`/`aria-expanded` lying
  // about a bubble that doesn't exist.
  if (disabled) return trigger;

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          return;
        }
        // Popover only ever asks to *close* by dismissal — the buttons close
        // through `cancel`/`confirm` above. Mid-flight the answer is already
        // given, so a stray Escape doesn't abandon a running action.
        if (!pending) cancel();
      }}
      side={side}
      align={align}
      sheet={sheet}
      // The question names the panel: `aria-label` on the anchored bubble, and
      // the Modal's title in sheet mode — Popover renders a headerless sheet
      // without one, which on a phone is a confirmation with nothing to read
      // above its two buttons. A non-string title has no text to lend, so the
      // caller gets `ariaLabel` for that case.
      label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
      // Width belongs to the anchored bubble only: in sheet mode this class
      // lands on the Modal panel, which sizes itself to the screen.
      className={cn(!asSheet && 'min-w-56', className)}
    >
      <div className="flex gap-2.5">
        {icon !== false && (
          <span className="mt-px flex size-4 shrink-0 items-center justify-center text-amber-600 dark:text-amber-400 [&_svg]:size-4">
            {icon ?? <WarningGlyph />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium text-foreground">{title}</p>
          {description && (
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {/* In a bottom sheet the pair sits under a thumb, so it spreads to the
          full width; anchored, it stays a compact right-aligned pair. */}
      <div className={cn('mt-3 flex gap-2', asSheet ? '[&>*]:flex-1' : 'justify-end')}>
        <Button variant="ghost" size="sm" disabled={pending} onClick={cancel}>
          {cancelText}
        </Button>
        <Button variant={okVariant} size="sm" loading={pending} onClick={confirm}>
          {okText}
        </Button>
      </div>
    </Popover>
  );
}
