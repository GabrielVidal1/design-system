import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sparkles, X } from 'lucide-react';

import { VirtualList } from '../virtual-list';

const SDK_URL = 'https://changelog-widget.dev.gabvdl.xyz/script.js';
const DEFAULT_CHANGELOG = '/changelog.jsonl';

export interface ChangelogEntry {
  version: string;
  date?: string;
  title?: string;
  changes: string[];
  sha?: string;
}

interface ChangelogSDK {
  fetch(url?: string): Promise<ChangelogEntry[]>;
  latest(entries: ChangelogEntry[]): ChangelogEntry | null;
  watch(opts: {
    url?: string;
    intervalMs?: number;
    onUpdate: (latest: ChangelogEntry, entries: ChangelogEntry[]) => void;
  }): () => void;
}

/** Read window.Changelog without a global augmentation (keeps this drop-in). */
function globalSdk(): ChangelogSDK | undefined {
  return (window as unknown as { Changelog?: ChangelogSDK }).Changelog;
}

/** Load the SDK script once (idempotent) and resolve window.Changelog. */
function loadSdk(src: string): Promise<ChangelogSDK> {
  const present = globalSdk();
  if (present) return Promise.resolve(present);
  return new Promise((resolve, reject) => {
    const done = () => {
      const sdk = globalSdk();
      sdk ? resolve(sdk) : reject(new Error('SDK missing'));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', () => reject(new Error('SDK failed')), { once: true });
      const sdk = globalSdk();
      if (sdk) resolve(sdk);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.addEventListener('load', done, { once: true });
    s.addEventListener('error', () => reject(new Error('SDK failed')), { once: true });
    document.head.appendChild(s);
  });
}

export interface ChangelogProps {
  /**
   * Supply entries directly (controlled). When set, the hosted SDK is not
   * loaded — pair with `onLoadMore` / `hasMore` / `loading` to page a long
   * history. Omit to auto-load from the changelog-widget SDK.
   */
  entries?: ChangelogEntry[];
  /** URL of the JSONL changelog (SDK mode). Default: /changelog.jsonl */
  url?: string;
  /** URL of the SDK script (SDK mode). Default: the hosted changelog script. */
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
   * mode, where the SDK watcher isn't running). Set to `null`/omit to hide it.
   */
  newVersion?: ChangelogEntry | null;
  /** Called when the user dismisses the "new version" toast. */
  onDismissNewVersion?: () => void;
}

/**
 * A changelog trigger + modal + "new version" reload toast, styled from the
 * design tokens. The entry list is a {@link VirtualList}, so a long history
 * scrolls cheaply and can lazily page in via `onLoadMore`. Data comes from the
 * headless changelog-widget SDK by default, or pass `entries` directly.
 */
export function Changelog({
  entries,
  url = DEFAULT_CHANGELOG,
  sdkUrl = SDK_URL,
  title = 'Changelog',
  trigger,
  onLoadMore,
  hasMore = false,
  loading = false,
  newVersion = null,
  onDismissNewVersion,
}: ChangelogProps) {
  const controlled = entries !== undefined;
  const [loaded, setLoaded] = useState<ChangelogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [update, setUpdate] = useState<ChangelogEntry | null>(null);
  const stopRef = useRef<() => void>(() => {});

  const data = controlled ? entries : loaded;

  useEffect(() => {
    if (controlled) return;
    let alive = true;
    loadSdk(sdkUrl)
      .then((sdk) => {
        if (!alive) return;
        void sdk.fetch(url).then((e) => alive && setLoaded(e));
        stopRef.current = sdk.watch({
          url,
          onUpdate: (latest, all) => {
            if (!alive) return;
            setLoaded(all);
            setUpdate(latest);
          },
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      stopRef.current();
    };
  }, [controlled, url, sdkUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // The controlled `newVersion` prop takes precedence over the SDK watcher's
  // own detected update, so a consumer can drive the reload toast directly.
  const activeUpdate = newVersion ?? update;
  const hasUpdate = activeUpdate !== null;
  const dismissUpdate = () => {
    setUpdate(null);
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
              renderItem={(e) => <Entry entry={e} />}
            />
          </div>
        </div>
      )}

      {activeUpdate && (
        <div className="fixed left-1/2 top-3 z-[9999] w-[min(92vw,400px)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-card p-3.5 shadow-xl">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                New version · v{activeUpdate.version}
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                {activeUpdate.title || activeUpdate.changes[0] || 'A new version is available.'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => location.reload()}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={dismissUpdate}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const showTitle = entry.title && !(entry.changes.length === 1 && entry.changes[0] === entry.title);
  return (
    <div className="border-b border-border py-4 last:border-none">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
          v{entry.version}
        </span>
        {entry.date && <span className="text-xs text-muted-foreground">{entry.date}</span>}
      </div>
      {showTitle && <p className="mb-1.5 text-sm font-semibold text-foreground">{entry.title}</p>}
      <ul className="space-y-1">
        {entry.changes.map((c, i) => (
          <li key={i} className="relative pl-4 text-[13px] leading-snug text-muted-foreground">
            <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-primary" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
