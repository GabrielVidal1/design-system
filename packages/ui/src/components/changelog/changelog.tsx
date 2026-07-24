import { useEffect, useState, type ReactNode } from 'react';
import { Sparkles, X } from 'lucide-react';

import { VirtualList } from '../virtual-list';

import { DEFAULT_CHANGELOG_URL, type ChangelogEntry } from './core';
import { ChangelogEntryView } from './entry';
import { useChangelog } from './use-changelog';

export type { ChangelogEntry };

export interface ChangelogProps {
  /**
   * Supply entries directly (controlled). When set, nothing is fetched —
   * pair with `onLoadMore` / `hasMore` / `loading` to page a long history.
   * Omit to auto-load `url` and poll it for new versions.
   */
  entries?: ChangelogEntry[];
  /** URL of the JSONL changelog. Default: /changelog.jsonl */
  url?: string;
  /**
   * @deprecated The data layer is built in since 0.4.0 — no external SDK
   * script is loaded any more. The prop is accepted and ignored.
   */
  sdkUrl?: string;
  /** Modal heading. Default: "Changelog". */
  title?: string;
  /**
   * Custom trigger. Receives `open` (show the modal) and `hasUpdate` (a newer
   * version is available). If omitted, a plain "Changelog" text button renders.
   */
  trigger?: (args: { open: () => void; hasUpdate: boolean }) => ReactNode;
  /** Controlled mode: append the next page (used by the virtual list's tail). */
  onLoadMore?: () => void;
  /** Controlled mode: more pages remain. */
  hasMore?: boolean;
  /** Controlled mode: a page load is in flight. */
  loading?: boolean;
  /**
   * Controlled "new version" reload toast. Set to an entry to show the toast
   * for it — useful when you detect an update yourself (e.g. in controlled
   * mode, where the watcher isn't running). Set to `null`/omit to hide it.
   */
  newVersion?: ChangelogEntry | null;
  /** Called when the user dismisses the "new version" toast. */
  onDismissNewVersion?: () => void;
}

/**
 * A changelog trigger + modal + "new version" reload toast, styled from the
 * design tokens. The entry list is a {@link VirtualList}, so a long history
 * scrolls cheaply and can lazily page in via `onLoadMore`. Data comes from a
 * JSONL changelog fetched (and polled) by the built-in data layer, or pass
 * `entries` directly. Generate the JSONL with the bundled `gabvdl-changelog`
 * CLI (`npx gabvdl-changelog` at deploy time).
 *
 * @summary Renders a parsed `CHANGELOG.md` — trigger button, full page,
 * `useChangelog` fetching/parsing, and a toast when a new version ships.
 */
export function Changelog({
  entries,
  url = DEFAULT_CHANGELOG_URL,
  title = 'Changelog',
  trigger,
  onLoadMore,
  hasMore = false,
  loading = false,
  newVersion = null,
  onDismissNewVersion,
}: ChangelogProps) {
  const controlled = entries !== undefined;
  const [open, setOpen] = useState(false);
  const {
    entries: loaded,
    newVersion: detected,
    dismissNewVersion,
  } = useChangelog({ url, watch: !controlled, enabled: !controlled });

  const data = controlled ? entries : loaded;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // The controlled `newVersion` prop takes precedence over the watcher's own
  // detected update, so a consumer can drive the reload toast directly.
  const activeUpdate = newVersion ?? detected;
  const hasUpdate = activeUpdate !== null;
  const dismissUpdate = () => {
    dismissNewVersion();
    onDismissNewVersion?.();
  };

  return (
    <>
      {trigger ? (
        trigger({ open: () => setOpen(true), hasUpdate })
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Changelog
          {hasUpdate && (
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <h2 className="flex-1 text-base font-bold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <VirtualList
              items={data}
              className="min-h-0 flex-1 px-5"
              estimateSize={120}
              overscan={4}
              getItemKey={(e) => e.version}
              onEndReached={onLoadMore}
              hasMore={hasMore}
              loading={loading}
              emptyState={<p className="py-6 text-center text-sm text-muted-foreground">No changelog yet.</p>}
              renderItem={(e) => (
                <ChangelogEntryView entry={e} className="border-b border-border py-4 last:border-none" />
              )}
            />
          </div>
        </div>
      )}

      {activeUpdate && <NewVersionToast entry={activeUpdate} onDismiss={dismissUpdate} />}
    </>
  );
}

/**
 * The "new version → reload" toast on its own — for apps that don't render a
 * changelog trigger but still want the update prompt. Pair with
 * {@link useChangelog}: `const { newVersion, dismissNewVersion } = useChangelog({ watch: true })`.
 */
export function NewVersionToast({
  entry,
  onDismiss,
}: {
  entry: ChangelogEntry;
  onDismiss?: () => void;
}) {
  return (
    <div className="fixed left-1/2 top-3 z-[9999] w-[min(92vw,400px)] -translate-x-1/2">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-card p-3.5 shadow-xl">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            New version · v{entry.version}
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            {entry.title || entry.changes[0] || 'A new version is available.'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => location.reload()}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Reload
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
