import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_CHANGELOG_URL,
  fetchChangelog,
  latestEntry,
  watchChangelog,
  type ChangelogEntry,
} from './core';

export interface UseChangelogOptions {
  /** URL of the JSONL changelog. Default: /changelog.jsonl */
  url?: string;
  /** Poll for new versions and surface them via `newVersion`. Default: false. */
  watch?: boolean;
  /** Poll interval (ms) when watching. Default: 20s. */
  intervalMs?: number;
  /** Set false to skip fetching entirely (e.g. entries supplied elsewhere). */
  enabled?: boolean;
}

export interface UseChangelogResult {
  /** Parsed entries, newest first. */
  entries: ChangelogEntry[];
  /** The highest-semver entry, or null. */
  latest: ChangelogEntry | null;
  /** A version newer than the one loaded first — show a reload prompt. */
  newVersion: ChangelogEntry | null;
  /** Hide the `newVersion` prompt (until an even newer version appears). */
  dismissNewVersion: () => void;
  /** Initial load in flight. */
  loading: boolean;
  /** Re-fetch on demand. */
  reload: () => void;
}

/**
 * Load (and optionally poll) a JSONL changelog. The data layer behind
 * {@link Changelog} and {@link ChangelogPage}, exposed for custom UIs:
 * wire `newVersion` to your own toast, or render `entries` any way you like.
 */
export function useChangelog(options: UseChangelogOptions = {}): UseChangelogResult {
  const { url = DEFAULT_CHANGELOG_URL, watch = false, intervalMs, enabled = true } = options;
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [newVersion, setNewVersion] = useState<ChangelogEntry | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    void fetchChangelog(url).then((e) => {
      if (!alive) return;
      setEntries(e);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [url, enabled, tick]);

  useEffect(() => {
    if (!enabled || !watch) return;
    return watchChangelog({
      url,
      intervalMs,
      onUpdate: (latest, all) => {
        setEntries(all);
        setNewVersion(latest);
      },
    });
  }, [url, watch, intervalMs, enabled]);

  const latest = useMemo(() => latestEntry(entries), [entries]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const dismissNewVersion = useCallback(() => {
    setDismissed(newVersion?.version ?? null);
  }, [newVersion]);

  return {
    entries,
    latest,
    newVersion: newVersion && newVersion.version === dismissed ? null : newVersion,
    dismissNewVersion,
    loading,
    reload,
  };
}
