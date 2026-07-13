// The docs' search index — generated at build time by the `search-index` Vite
// plugin (apps/docs/plugins/search-index.ts), which walks packages/ui/src with
// the TypeScript compiler API and writes public/search-index.json: one entry per
// exported component, hook and utility, plus one per prop. Nothing is
// hand-maintained; add a component and it is searchable on the next build.

/** Mirrors `IndexEntry` in the plugin. */
export interface IndexEntry {
  id: string;
  name: string;
  kind: 'component' | 'hook' | 'util' | 'prop';
  summary: string;
  /** Prop entries only — the declared type, e.g. `?: number`. */
  type?: string;
  /** Component entries only — every prop name, space-joined. */
  props?: string;
  /** Component entries only — the other symbols exported from the same module. */
  exports?: string;
  file: string;
  route: string;
}

let cache: Promise<IndexEntry[]> | null = null;

/** Fetch the static index once, lazily — the palette calls this on first open. */
export function loadSearchIndex(): Promise<IndexEntry[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}search-index.json`).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<IndexEntry[]>;
  });
  return cache;
}
