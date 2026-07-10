import type { ReactNode } from 'react';

/** Merge overlapping/adjacent [start,end) ranges, dropping any shorter than
 * `minLen` (so single fuzzy-char hits don't produce noisy highlights). */
function mergeRanges(ranges: [number, number][], minLen = 1): [number, number][] {
  const kept = ranges.filter(([s, e]) => e - s >= minLen).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of kept) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function mark(text: string, key: number): ReactNode {
  return (
    <mark key={key} className="rounded-sm bg-primary/25 px-0.5 text-foreground">
      {text}
    </mark>
  );
}

/**
 * Wrap the matched ranges of `text` in `<mark>`, highlighting the whole string
 * (no windowing). `indices` are Fuse.js match indices — inclusive `[start, end]`
 * pairs.
 */
export function highlightAll(text: string, indices: readonly [number, number][]): ReactNode {
  const ranges = mergeRanges(indices.map(([s, e]) => [s, e + 1] as [number, number]), 2);
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let k = 0;
  for (const [s, e] of ranges) {
    if (s > cursor) parts.push(text.slice(cursor, s));
    parts.push(mark(text.slice(s, e), k++));
    cursor = e;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

/**
 * Build a compact snippet of `text` centered on the first match, with the
 * matched ranges wrapped in `<mark>` and ellipses at any trimmed edge. Good for
 * long fields (message bodies, descriptions) where you only want the hit in
 * context. `indices` are Fuse.js match indices — inclusive `[start, end]` pairs.
 */
export function highlightSnippet(
  text: string,
  indices: readonly [number, number][],
  window = 260,
): ReactNode {
  const ranges = mergeRanges(indices.map(([s, e]) => [s, e + 1] as [number, number]), 2);
  const first = ranges[0]?.[0] ?? 0;
  const start = Math.max(0, first - 60);
  const end = Math.min(text.length, start + window);

  const parts: ReactNode[] = [];
  if (start > 0) parts.push('… ');
  let cursor = start;
  let k = 0;
  for (const [rs, re] of ranges) {
    if (re <= start) continue;
    if (rs >= end) break;
    const s = Math.max(rs, start);
    const e = Math.min(re, end);
    if (s > cursor) parts.push(text.slice(cursor, s));
    parts.push(mark(text.slice(s, e), k++));
    cursor = e;
  }
  if (cursor < end) parts.push(text.slice(cursor, end));
  if (end < text.length) parts.push(' …');
  return parts;
}
