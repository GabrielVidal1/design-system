import * as React from 'react';

export interface UseCopyOptions {
  /** How long `copied` stays true, in ms. */
  timeout?: number;
  /**
   * On touch devices, offer the native share sheet first (falls back to the
   * clipboard when the user dismisses it, or when sharing is unavailable).
   */
  share?: boolean | { title?: string; text?: string };
}

/**
 * Copy text to the clipboard and flag it for a moment, so a button can swap its
 * icon to a check.
 *
 * Handles the two ways `navigator.clipboard` is unavailable — insecure origins
 * and old WebViews — by falling back to a hidden `<textarea>` + `execCommand`,
 * so it works over plain HTTP on the LAN too.
 *
 * @summary Copy text with success state and a native-share fallback.
 */
export function useCopyToClipboard({ timeout = 1500, share = false }: UseCopyOptions = {}) {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = React.useCallback(
    async (text: string): Promise<boolean> => {
      if (share && typeof navigator !== 'undefined' && navigator.share) {
        try {
          const meta = typeof share === 'object' ? share : {};
          await navigator.share({ ...meta, text: meta.text ?? text });
          return true; // shared, not copied — no check mark to show
        } catch {
          /* dismissed or unsupported — fall through to the clipboard */
        }
      }

      const ok = await writeClipboard(text);
      if (!ok) {
        setError(new Error('clipboard unavailable'));
        return false;
      }

      setError(null);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), timeout);
      return true;
    },
    [share, timeout],
  );

  return { copy, copied, error };
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* blocked (insecure origin, permissions) — try the legacy path */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
