// The changelog data layer, self-contained in @gabvdl/ui: JSONL parsing,
// semver ordering, fetching and new-version polling. Formerly the hosted
// changelog-widget SDK (window.Changelog) — inlined so consumers need no
// external script and the component works offline / in dev.

const PREFIX = '[changelog]';
export const DEFAULT_CHANGELOG_URL = '/changelog.jsonl';
const DEFAULT_INTERVAL = 20_000;

/** Keep-a-Changelog style change categories, plus `breaking`. */
export interface ChangelogSections {
  breaking?: string[];
  added?: string[];
  changed?: string[];
  deprecated?: string[];
  removed?: string[];
  fixed?: string[];
  security?: string[];
}

export const SECTION_ORDER: (keyof ChangelogSections)[] = [
  'breaking',
  'added',
  'changed',
  'deprecated',
  'removed',
  'fixed',
  'security',
];

export const SECTION_LABEL: Record<keyof ChangelogSections, string> = {
  breaking: 'Breaking',
  added: 'Added',
  changed: 'Changed',
  deprecated: 'Deprecated',
  removed: 'Removed',
  fixed: 'Fixed',
  security: 'Security',
};

export interface ChangelogEntry {
  /** Semver version — orders the log. */
  version: string;
  date?: string;
  title?: string;
  /** Flat list of changes (always present after parsing; may mirror `sections`). */
  changes: string[];
  /** Optional categorised changes; when present the UIs group by section. */
  sections?: ChangelogSections;
  sha?: string;
}

/* ── semver ──────────────────────────────────────────────────────────────── */

interface Parsed {
  major: number;
  minor: number;
  patch: number;
  pre: string;
}

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/;

export function parseSemver(v: unknown): Parsed | null {
  if (typeof v !== 'string') return null;
  const m = SEMVER_RE.exec(v.trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? '' };
}

/** True when the string looks like a semver version we can order. */
export function isSemver(v: unknown): v is string {
  return parseSemver(v) !== null;
}

function comparePre(a: string, b: string): number {
  // No prerelease outranks a prerelease (1.0.0 > 1.0.0-rc.1).
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i];
    const y = bs[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      const d = +x - +y;
      if (d !== 0) return d > 0 ? 1 : -1;
    } else if (x !== y) {
      return x > y ? 1 : -1;
    }
  }
  return 0;
}

/** Compare two semver strings: -1 (a<b), 0 (a==b), 1 (a>b). */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (pa[k] !== pb[k]) return pa[k] > pb[k] ? 1 : -1;
  }
  return comparePre(pa.pre, pb.pre);
}

/* ── parsing ─────────────────────────────────────────────────────────────── */

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function validateSections(raw: unknown): ChangelogSections | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: ChangelogSections = {};
  let any = false;
  for (const key of SECTION_ORDER) {
    const v = (raw as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      const items = v.filter(isNonEmptyString);
      if (items.length > 0) {
        out[key] = items;
        any = true;
      }
    }
  }
  return any ? out : undefined;
}

/** Validate a single parsed changelog entry, or null if unusable. */
function validateEntry(raw: unknown, lineNo: number): ChangelogEntry | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn(`${PREFIX} ignoring malformed line ${lineNo}: expected an object, got`, raw);
    return null;
  }
  const entry = raw as Record<string, unknown>;

  if (!isSemver(entry.version)) {
    console.warn(`${PREFIX} ignoring line ${lineNo}: "version" is not semver`, entry.version);
    return null;
  }

  const out: ChangelogEntry = { version: entry.version as string, changes: [] };
  if (isNonEmptyString(entry.date)) out.date = entry.date;
  if (isNonEmptyString(entry.title)) out.title = entry.title;
  if (isNonEmptyString(entry.sha)) out.sha = entry.sha;
  if (Array.isArray(entry.changes)) {
    out.changes = entry.changes.filter(isNonEmptyString);
  } else if (entry.changes !== undefined) {
    console.warn(`${PREFIX} line ${lineNo}: "changes" is not an array, ignoring`, entry.changes);
  }
  const sections = validateSections(entry.sections);
  if (sections) {
    out.sections = sections;
    // Keep the flat list usable even when only sections were supplied.
    if (out.changes.length === 0) {
      out.changes = SECTION_ORDER.flatMap((k) => sections[k] ?? []);
    }
  }
  if (!out.title) out.title = out.changes[0] ?? `Version ${out.version}`;
  return out;
}

/**
 * Parse a raw JSONL document into validated entries, newest (highest semver)
 * first. Blank/unparseable/invalid lines are skipped with a console.warn.
 */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.warn(`${PREFIX} ignoring unparseable line ${i + 1}`);
      continue;
    }
    const valid = validateEntry(parsed, i + 1);
    if (valid) entries.push(valid);
  }
  // De-dupe by version (last write wins), then sort newest-first.
  const byVersion = new Map<string, ChangelogEntry>();
  for (const e of entries) byVersion.set(e.version, e);
  return [...byVersion.values()].sort((a, b) => compareSemver(b.version, a.version));
}

/* ── fetching + polling ──────────────────────────────────────────────────── */

/** Fetch and parse a JSONL changelog. Failures resolve to [] with a warning. */
export async function fetchChangelog(url: string = DEFAULT_CHANGELOG_URL): Promise<ChangelogEntry[]> {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) {
      console.warn(`${PREFIX} failed to load "${url}": HTTP ${res.status}`);
      return [];
    }
    return parseChangelog(await res.text());
  } catch {
    console.warn(`${PREFIX} failed to load "${url}"`);
    return [];
  }
}

/** The highest-semver entry, or null. */
export function latestEntry(entries: ChangelogEntry[]): ChangelogEntry | null {
  // parseChangelog() already sorts newest-first; be defensive if given an unsorted list.
  let top: ChangelogEntry | null = null;
  for (const e of entries) {
    if (!top || compareSemver(e.version, top.version) > 0) top = e;
  }
  return top;
}

export interface WatchOptions {
  url?: string;
  intervalMs?: number;
  onUpdate: (latest: ChangelogEntry, entries: ChangelogEntry[]) => void;
}

/**
 * Poll a JSONL changelog and fire `onUpdate` whenever a version newer than the
 * one present when watching started appears. Skips polling while the tab is
 * hidden and re-checks when it becomes visible again. Returns an unsubscribe.
 */
export function watchChangelog(options: WatchOptions): () => void {
  if (typeof window === 'undefined') return () => {};
  const url = options.url ?? DEFAULT_CHANGELOG_URL;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL;
  let baseline: ChangelogEntry | null = null;
  let started = false;
  let stopped = false;

  const check = async () => {
    if (stopped || document.hidden) return;
    let entries: ChangelogEntry[];
    try {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!res.ok) return;
      entries = parseChangelog(await res.text());
    } catch {
      return; // transient — try again next tick
    }
    if (stopped) return;
    const top = latestEntry(entries);
    if (!top) return;
    if (!started) {
      baseline = top; // first successful load defines "the version you're running"
      started = true;
      return;
    }
    if (!baseline || compareSemver(top.version, baseline.version) > 0) {
      baseline = top;
      options.onUpdate(top, entries);
    }
  };

  const onVisible = () => {
    if (!document.hidden) void check();
  };

  void check();
  const timer = intervalMs > 0 ? window.setInterval(check, intervalMs) : undefined;
  if (timer !== undefined) document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    if (timer !== undefined) {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}
