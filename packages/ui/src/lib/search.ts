import Fuse, { type FuseOptionKey, type FuseResultMatch } from 'fuse.js';

/** One row of {@link runSearch} output — mirrors a Fuse result, but the matches
 * may be a mix of fuzzy hits (from Fuse) and exact-phrase hits (computed here). */
export interface SearchResult<T> {
  item: T;
  refIndex: number;
  matches: readonly FuseResultMatch[];
}

interface ParsedQuery {
  /** Double-quoted segments — matched as exact, case-insensitive substrings. */
  phrases: string[];
  /** Everything outside quotes — matched fuzzily by Fuse. */
  rest: string;
}

/**
 * Split a raw query into exact `"quoted"` phrases and the leftover fuzzy text:
 * `foo "bar baz" qux` → `{ phrases: ['bar baz'], rest: 'foo qux' }`.
 *
 * An unterminated quote is treated as literal text (it stays in `rest`), so a
 * query that is mid-typing (`foo "ba`) keeps fuzzy-searching instead of
 * suddenly matching nothing.
 */
export function parseQuery(query: string): ParsedQuery {
  const phrases: string[] = [];
  let rest = '';
  let last = 0;
  const re = /"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) {
    rest += query.slice(last, m.index);
    const phrase = m[1].trim();
    if (phrase) phrases.push(phrase);
    last = re.lastIndex;
  }
  rest += query.slice(last);
  // Any `"` left in `rest` is an unbalanced quote from a mid-typed query — drop
  // it so the leftover text still fuzzy-searches instead of the literal quote
  // poisoning the match.
  return { phrases, rest: rest.replace(/"/g, ' ').replace(/\s+/g, ' ').trim() };
}

/** Normalise a Fuse key (string, path array, or weighted object) to a dotted path. */
function keyToPath<T>(key: FuseOptionKey<T>): string {
  if (typeof key === 'string') return key;
  if (Array.isArray(key)) return key.join('.');
  const name = (key as { name: string | string[] }).name;
  return Array.isArray(name) ? name.join('.') : name;
}

/** Read a dotted path off an object as a string — same coercion the highlighter
 * uses (arrays via `String`, i.e. comma-joined) so match indices line up. */
function valueAt(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur == null ? '' : String(cur);
}

/** Test one item against every quoted phrase and, if all are present, collect
 * the `<mark>`-ready match indices per key. An item passes only when EVERY
 * phrase appears (case-insensitively) in at least one searched key. */
function exactMatch<T>(
  item: T,
  keyPaths: string[],
  phrases: string[],
): { ok: boolean; matches: FuseResultMatch[] } {
  const indicesByKey = new Map<string, [number, number][]>();
  const found = phrases.map(() => false);

  for (const path of keyPaths) {
    const value = valueAt(item, path);
    if (!value) continue;
    const hay = value.toLowerCase();
    phrases.forEach((phrase, pi) => {
      const needle = phrase.toLowerCase();
      let at = hay.indexOf(needle);
      if (at === -1) return;
      found[pi] = true;
      const arr = indicesByKey.get(path) ?? [];
      while (at !== -1) {
        arr.push([at, at + needle.length - 1]);
        at = hay.indexOf(needle, at + needle.length);
      }
      indicesByKey.set(path, arr);
    });
  }

  const ok = found.every(Boolean);
  const matches: FuseResultMatch[] = ok
    ? [...indicesByKey.entries()].map(
        ([key, indices]) =>
          ({ key, value: valueAt(item, key), indices } as unknown as FuseResultMatch),
      )
    : [];
  return { ok, matches };
}

/** Merge two match lists, consolidating by key so the highlighter (which looks
 * matches up by key) sees a single entry per field with all its ranges. */
function mergeMatches(
  a: readonly FuseResultMatch[],
  b: readonly FuseResultMatch[],
): FuseResultMatch[] {
  const byKey = new Map<string, FuseResultMatch>();
  for (const m of [...a, ...b]) {
    const key = m.key ?? '';
    const prev = byKey.get(key);
    if (prev) {
      byKey.set(key, {
        ...prev,
        indices: [...(prev.indices ?? []), ...(m.indices ?? [])],
      } as FuseResultMatch);
    } else {
      byKey.set(key, m);
    }
  }
  return [...byKey.values()];
}

/**
 * Search `items` with quote-aware semantics:
 *
 * - A bare query is fuzzy-matched by Fuse (unchanged behaviour).
 * - Any `"double-quoted"` segment must appear **exactly** (case-insensitive
 *   substring) in one of the searched keys — great for pinning down an exact
 *   name/id when the fuzzy ranking would otherwise bury it.
 * - The two can mix: `parser "utils.ts"` fuzzy-matches `parser` and then keeps
 *   only items whose fields contain the literal `utils.ts`.
 *
 * Returns results in Fuse relevance order when there is fuzzy text, otherwise in
 * input order. Exact-phrase and fuzzy match indices are merged so the caller's
 * highlighter marks both.
 */
export function runSearch<T>(
  fuse: Fuse<T>,
  items: T[],
  keys: FuseOptionKey<T>[],
  rawQuery: string,
  limit?: number,
): SearchResult<T>[] {
  const query = rawQuery.trim();
  if (!query) return items.map((item, refIndex) => ({ item, refIndex, matches: [] }));

  const { phrases, rest } = parseQuery(query);

  // No quoted phrase → plain fuzzy, exactly as before.
  if (phrases.length === 0) {
    return fuse.search(rest || query, limit ? { limit } : undefined).map((r) => ({
      item: r.item,
      refIndex: r.refIndex,
      matches: (r.matches ?? []) as readonly FuseResultMatch[],
    }));
  }

  const keyPaths = keys.map(keyToPath);

  // Candidate pool: when there's fuzzy text, rank/narrow by it first (no limit
  // yet — the exact filter still has to run); otherwise consider every item and
  // keep input order. `limit` is applied after the exact filter below.
  const pool: SearchResult<T>[] = rest
    ? fuse.search(rest).map((r) => ({
        item: r.item,
        refIndex: r.refIndex,
        matches: [...(r.matches ?? [])] as FuseResultMatch[],
      }))
    : items.map((item, refIndex) => ({ item, refIndex, matches: [] as FuseResultMatch[] }));

  const out: SearchResult<T>[] = [];
  for (const cand of pool) {
    const { ok, matches } = exactMatch(cand.item, keyPaths, phrases);
    if (!ok) continue;
    out.push({
      item: cand.item,
      refIndex: cand.refIndex,
      matches: mergeMatches(cand.matches, matches),
    });
    if (limit && out.length >= limit) break;
  }
  return out;
}
