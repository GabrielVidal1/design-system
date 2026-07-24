import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';

export interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** The text to copy. A function is called lazily, on click. */
  value: string | (() => string);
  /** Show the label next to the icon. */
  label?: string;
  /** Offer the native share sheet first on touch devices. */
  share?: boolean;
  onCopied?: () => void;
}

/**
 * Copy-to-clipboard with the transient check mark — the six lines re-typed in a
 * dozen projects, minus the empty `catch {}` they all shipped.
 *
 * @summary Copy-to-clipboard button with success feedback and native share fallback.
 * Pairs with the `useCopyToClipboard` hook.
 */
export function CopyButton({
  value,
  label,
  share = false,
  onCopied,
  className,
  ...props
}: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard({ share });

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copy(typeof value === 'function' ? value() : value);
        if (ok) onCopied?.();
      }}
      aria-label={label ?? (copied ? 'Copied' : 'Copy')}
      title={copied ? 'Copied' : 'Copy'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        copied && 'text-emerald-600 dark:text-emerald-400',
        className,
      )}
      {...props}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
