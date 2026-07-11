import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  Monitor,
  RotateCw,
  Smartphone,
  X,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { useEscape, useScrollLock } from '../../hooks/use-overlay';
import { Button } from '../button';
import { Input } from '../input';
import { Spinner } from '../spinner';

export type IframePreviewDevice = 'desktop' | 'phone';

/** Logical width the phone tier lays the embedded page out at. */
const PHONE_WIDTH = 414;

/** How long a blank iframe may hang before we suggest the site refuses framing. */
const BLOCK_HINT_MS = 6000;

export interface IframePreviewOverlayProps {
  open: boolean;
  onClose: () => void;
  /** The page to frame. Changing it (while open) navigates the iframe. */
  url: string;
  /** Called whenever the user commits a new URL in the address field. */
  onUrlChange?: (url: string) => void;
  title?: string;
  /** Show the editable address field. Default `true`. */
  editableUrl?: boolean;
  /** Extra controls, rendered in the toolbar next to the built-in ones. */
  actions?: React.ReactNode;
  /** Phone/desktop tier toggle (desktop viewports only). Default `true`. */
  devices?: boolean;
  device?: IframePreviewDevice;
  onDeviceChange?: (device: IframePreviewDevice) => void;
  /**
   * Append a cache-busting query param on every (re)load, so a just-deployed
   * page can't be served from the browser cache. Default `false`.
   */
  cacheBust?: boolean;
  sandbox?: string;
  allow?: string;
  className?: string;
  /** Rendered under the toolbar, above the frame — a banner, a tab bar… */
  children?: React.ReactNode;
}

/** `https://x` for a bare `x`, so typing `foo.dev` in the field just works. */
function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

function withBust(url: string, nonce: number): string {
  try {
    const u = new URL(url, typeof window === 'undefined' ? undefined : window.location.href);
    u.searchParams.set('_ts', String(nonce));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * The full-screen half of {@link IframePreview}, driven entirely from props —
 * use it directly when the trigger lives somewhere else (a menu item, a
 * floating gizmo) or when the URL is owned by the app.
 *
 * The iframe is keyed on the resolved source, so every open — and every hit of
 * the reload button — remounts it and re-fetches the page rather than showing a
 * stale render.
 */
export function IframePreviewOverlay({
  open,
  onClose,
  url,
  onUrlChange,
  title,
  editableUrl = true,
  actions,
  devices = true,
  device: deviceProp,
  onDeviceChange,
  cacheBust = false,
  sandbox,
  allow = 'clipboard-write; fullscreen; geolocation',
  className,
  children,
}: IframePreviewOverlayProps) {
  const [src, setSrc] = React.useState(url);
  const [draft, setDraft] = React.useState(url);
  const [nonce, setNonce] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [blocked, setBlocked] = React.useState(false);
  const [deviceState, setDeviceState] = React.useState<IframePreviewDevice>('desktop');
  const device = deviceProp ?? deviceState;

  useScrollLock(open);
  useEscape(onClose, open);

  // Every open (and every external url change) starts from a fresh fetch.
  React.useEffect(() => {
    if (!open) return;
    setSrc(url);
    setDraft(url);
    setNonce((n) => n + 1);
  }, [open, url]);

  const resolved = React.useMemo(
    () => (cacheBust ? withBust(src, nonce) : src),
    [cacheBust, src, nonce],
  );
  const frameKey = `${resolved}#${nonce}`;

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setBlocked(false);
    const t = window.setTimeout(() => setBlocked(true), BLOCK_HINT_MS);
    return () => window.clearTimeout(t);
  }, [open, frameKey]);

  const reload = () => setNonce((n) => n + 1);

  const navigate = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normalizeUrl(draft);
    if (!next) return;
    setDraft(next);
    setSrc(next);
    setNonce((n) => n + 1);
    onUrlChange?.(next);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  const setDevice = (next: IframePreviewDevice) => {
    setDeviceState(next);
    onDeviceChange?.(next);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'ds-iframe-preview fixed inset-0 z-[95] flex h-[100dvh] w-screen flex-col bg-background text-foreground',
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Preview'}
    >
      <header
        className="flex shrink-0 flex-col gap-1.5 border-b border-border bg-card/80 px-2 py-2 backdrop-blur"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            icon={<RotateCw />}
            aria-label="Reload"
            tooltip="Reload"
            onClick={reload}
          />

          {editableUrl ? (
            <form onSubmit={navigate} className="min-w-0 flex-1">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="url"
                type="text"
                aria-label="Preview URL"
                className="h-8 w-full truncate rounded-full px-3 text-xs sm:text-sm"
              />
            </form>
          ) : (
            <span className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground sm:text-sm">
              {title ?? src}
            </span>
          )}

          {devices && (
            <div className="hidden items-center gap-0.5 rounded-full border border-border p-0.5 sm:flex">
              <Button
                variant={device === 'desktop' ? 'default' : 'ghost'}
                size="icon-sm"
                icon={<Monitor />}
                aria-label="Desktop width"
                tooltip="Desktop"
                className="rounded-full"
                onClick={() => setDevice('desktop')}
              />
              <Button
                variant={device === 'phone' ? 'default' : 'ghost'}
                size="icon-sm"
                icon={<Smartphone />}
                aria-label="Phone width"
                tooltip="Phone"
                className="rounded-full"
                onClick={() => setDevice('phone')}
              />
            </div>
          )}

          <a
            href={src}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open in a new tab"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>

          <Button
            variant="ghost"
            size="icon-sm"
            icon={<X />}
            aria-label="Close preview"
            tooltip="Close"
            onClick={onClose}
          />
        </div>

        {actions && (
          <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {actions}
          </div>
        )}
      </header>

      {children}

      <div className="relative min-h-0 flex-1 bg-muted/30">
        <div
          className={cn(
            'mx-auto h-full transition-[width] duration-200',
            device === 'phone'
              ? 'w-full max-w-[414px] border-x border-border bg-background shadow-xl'
              : 'w-full',
          )}
          style={device === 'phone' ? { width: PHONE_WIDTH } : undefined}
        >
          <iframe
            key={frameKey}
            src={resolved}
            title={title ?? 'Preview'}
            sandbox={sandbox}
            allow={allow}
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              setLoading(false);
              setBlocked(false);
            }}
            className="size-full border-0 bg-white"
          />
        </div>

        {loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
            <Spinner size="lg" />
            {blocked && (
              <p className="pointer-events-auto max-w-xs px-6 text-center text-xs text-muted-foreground">
                Still blank — the site may refuse to be framed.{' '}
                <a href={src} target="_blank" rel="noreferrer noopener" className="underline">
                  Open it in a new tab
                </a>
                .
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export interface IframePreviewProps
  extends Omit<IframePreviewOverlayProps, 'open' | 'onClose' | 'url'> {
  /** Initial URL. The field can navigate away from it; reopening resets to it. */
  url: string;
  /** Controlled open state. Omit to let the component own it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Custom trigger. A render prop gets `open()`; a node is wrapped in a button. */
  children?: React.ReactNode | ((api: { open: () => void }) => React.ReactNode);
  /** Label of the default button trigger. */
  label?: string;
  /** Class for the default trigger. */
  triggerClassName?: string;
}

/**
 * A trigger — a button by default, any element you like — that opens the page
 * at `url` full-screen in an iframe, with an editable address field, a reload
 * that really re-fetches, a phone/desktop tier and a slot for your own
 * controls. Built for phones: `100dvh`, safe-area padding, tap-sized buttons
 * and a toolbar that stays one row wide.
 */
export function IframePreview({
  url,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  label,
  triggerClassName,
  className,
  ...overlay
}: IframePreviewProps) {
  const [openState, setOpenState] = React.useState(defaultOpen);
  const open = openProp ?? openState;

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const trigger =
    typeof children === 'function' ? (
      children({ open: () => setOpen(true) })
    ) : children ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          'cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          triggerClassName,
        )}
      >
        {children}
      </button>
    ) : (
      <Button
        variant="outline"
        icon={<ExternalLink />}
        aria-haspopup="dialog"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {label ?? 'Preview'}
      </Button>
    );

  return (
    <>
      {trigger}
      <IframePreviewOverlay
        {...overlay}
        className={className}
        url={url}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
