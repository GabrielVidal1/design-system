import { useEffect, useMemo, useState } from 'react';

import type { RichTag } from './types';
import { tagSlug } from './use-mention';

/**
 * **Auto-tag** — the composer reading what you typed and offering the tags it
 * recognises, instead of waiting for you to remember they exist.
 *
 * A tag opts in by carrying {@link RichTag.triggers}. Once the typing pauses
 * (see {@link AutoTagConfig.debounceMs}) the text is scanned for them, and
 * that reading stands while the typing resumes, until the next pause
 * refreshes it — the suggestions never empty out mid-word. A hit
 * whose tag is off moves that tag to the front of the tag list (right after
 * the selected ones) and draws nothing in the text; a hit whose tag is on is
 * marked in the tag's colour, which is what makes "the word I typed" and "the
 * tag that is on" legible together. That is the whole of it: no ring, no
 * accept/refuse buttons in the sentence — turning a tag on is a chip tap, and
 * a wrong guess costs nothing, so there is nothing to dismiss.
 *
 * **Nothing is inferred** — a tag with no `triggers` is never suggested, and a
 * tag's own label/slug is not silently added to its trigger list.
 */

/** How eager auto-tag is. */
export interface AutoTagConfig {
  /** Quiet time before the text is scanned. Default 1000 ms. */
  debounceMs?: number;
  /** Most not-yet-selected hits floated to the front of the list at once. Default 5. */
  max?: number;
  /** Don't scan below this many characters. Default 3. */
  minChars?: number;
}

/** One trigger hit: where it is, which tag claims it, and how sure we are. */
export interface AutoTagMatch {
  /** Stable across re-renders of the same hit — `<tag id>@<start>`. */
  key: string;
  tag: RichTag;
  /** Character range in the scanned text. */
  start: number;
  end: number;
  /** The matched slice, exactly as typed. */
  text: string;
  /** Higher wins when two tags claim overlapping text. */
  score: number;
}

const DEBOUNCE_MS = 1000;
const MAX = 5;
const MIN_CHARS = 3;

/**
 * A word character for boundary purposes. The hyphen counts as one, which is
 * what keeps `commit` from matching inside `commit-project` and `screenshot`
 * from matching inside `screenshot-ish` — kebab-case is one token here, not
 * two, because that is how the triggers themselves are written.
 */
const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9-]/.test(c);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A trigger as a regex: case-insensitive, and tolerant of however much
 * whitespace (or a line break) fell between the words of a phrase.
 */
function triggerRe(trigger: string): RegExp {
  const body = trigger.trim().split(/\s+/).map(escapeRe).join('\\s+');
  return new RegExp(body, 'gi');
}

/**
 * How much a hit is worth. Word count dominates: "generate an image" landing on
 * `nanobanana` is a far surer read than "image" alone, and the same goes for a
 * multi-word name. A trigger that *is* the tag's slug gets a nudge on top —
 * typing a tag's own name is as explicit as it gets — and length breaks ties
 * between two phrases of equal word count.
 */
function scoreOf(tag: RichTag, trigger: string, text: string): number {
  const wordCount = trigger.trim().split(/\s+/).length;
  const isSlug = trigger.toLowerCase() === tagSlug(tag).toLowerCase();
  return wordCount * 10 + (isSlug ? 5 : 0) + Math.min(text.length, 20) / 20;
}

/**
 * Every trigger hit in `text`, best-scoring first and never overlapping —
 * exported so a caller can unit-test its trigger lists, and pure so the hook
 * below stays a thin wrapper around it.
 *
 * `mentionPrefix` suppresses a hit that is already an explicit `#mention`:
 * the text having said it outright is the one case where suggesting it back is
 * pure noise.
 */
export function findAutoTagMatches(
  text: string,
  tags: RichTag[],
  { mentionPrefix = '#' }: { mentionPrefix?: string } = {},
): AutoTagMatch[] {
  const hits: AutoTagMatch[] = [];
  for (const tag of tags) {
    for (const trigger of tag.triggers ?? []) {
      if (!trigger.trim()) continue;
      const re = triggerRe(trigger);
      for (let m = re.exec(text); m; m = re.exec(text)) {
        const start = m.index;
        const end = start + m[0].length;
        const before = text[start - 1];
        // Whole-word only, and never inside an explicit #mention.
        if (isWordChar(before) || isWordChar(text[end])) continue;
        if (before === mentionPrefix) continue;
        hits.push({
          key: `${tag.id}@${start}`,
          tag,
          start,
          end,
          text: m[0],
          score: scoreOf(tag, trigger, m[0]),
        });
        // A zero-width match can't happen (empty triggers are skipped), but a
        // trigger that overlaps itself would loop — step past this hit.
        re.lastIndex = end;
      }
    }
  }
  // Resolve overlaps greedily by score: the surest read of a span wins it, and
  // the losers disappear rather than stacking two marks on one word.
  hits.sort((a, b) => b.score - a.score || a.start - b.start);
  const taken: AutoTagMatch[] = [];
  for (const h of hits) {
    if (taken.some((t) => h.start < t.end && t.start < h.end)) continue;
    taken.push(h);
  }
  return taken.sort((a, b) => a.start - b.start);
}

export interface AutoTagApi {
  /**
   * Hits whose tag is selected — marked in the text in the tag colour.
   * Uncapped: they are a reflection of the selection.
   */
  marks: AutoTagMatch[];
  /** Hits whose tag is not selected, in text order — the best `max` of them.
   * Not drawn: they only float their tags forward in the list. */
  suggestions: AutoTagMatch[];
}

const EMPTY: AutoTagMatch[] = [];

/**
 * Carry a scan of `from` over to `to`, the text as it is now. A hit before the
 * edited stretch keeps its offsets, one after it shifts by the edit's length,
 * and one the edit touched is dropped — so the marks stay under their words
 * while the user types elsewhere, instead of blinking out on every keystroke.
 */
export function carryMatches(matches: AutoTagMatch[], from: string, to: string): AutoTagMatch[] {
  if (from === to) return matches;
  const max = Math.min(from.length, to.length);
  let head = 0;
  while (head < max && from[head] === to[head]) head++;
  let tail = 0;
  while (tail < max - head && from[from.length - 1 - tail] === to[to.length - 1 - tail]) tail++;
  const shift = to.length - from.length;
  const editEnd = from.length - tail;
  const out: AutoTagMatch[] = [];
  let moved = false;
  for (const m of matches) {
    // A hit flush against the edit can grow into a longer word ("commit" →
    // "commits"): only one with a separator still between it and the edit survives.
    if (m.end < head || (m.end === head && !isWordChar(to[head]))) out.push(m);
    else if (m.start > editEnd || (m.start === editEnd && !isWordChar(to[m.start + shift - 1]))) {
      out.push(shift ? { ...m, start: m.start + shift, end: m.end + shift } : m);
      moved ||= shift !== 0;
    }
  }
  // Typing past the last hit (the usual case) changes nothing: same array.
  return out.length === matches.length && !moved ? matches : out;
}

export function useAutoTag({
  enabled,
  tags,
  value,
  selected,
  config,
  mentionPrefix,
}: {
  enabled: boolean;
  tags: RichTag[];
  value: string;
  selected: ReadonlySet<string>;
  config: AutoTagConfig;
  mentionPrefix: string;
}): AutoTagApi {
  const { debounceMs = DEBOUNCE_MS, max = MAX, minChars = MIN_CHARS } = config;
  const [settled, setSettled] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setSettled(value), debounceMs);
    return () => clearTimeout(t);
  }, [enabled, value, debounceMs]);

  // The scan only ever runs on text the user has stopped editing, and its
  // result is *kept* while they type again: what the composer shows mid-word
  // is the last pause's reading, refreshed at the next pause — never an empty
  // list that refills a second later, which made the tag list jump on every
  // burst of typing.
  const scan = useMemo(() => {
    if (!enabled || settled.trim().length < minChars) return EMPTY;
    const candidates = tags.filter((t) => (t.triggers?.length ?? 0) > 0);
    if (candidates.length === 0) return EMPTY;
    return findAutoTagMatches(settled, candidates, { mentionPrefix });
  }, [enabled, settled, minChars, tags, mentionPrefix]);

  // Emptied text (a send, a clear) drops the reading at once rather than a
  // pause later.
  const live = enabled && value.trim().length >= minChars;

  // The marks are drawn by character offset, so they follow the live text:
  // the scan's hits carried over the edits made since it ran.
  const marks = useMemo(
    () => (live ? carryMatches(scan, settled, value).filter((m) => selected.has(m.tag.id)) : EMPTY),
    [live, scan, settled, value, selected],
  );

  // Suggestions only name tags, so the cached scan stands as is until the
  // next pause.
  const suggestions = useMemo(
    () =>
      live
        ? scan
            .filter((m) => !selected.has(m.tag.id))
            .sort((a, b) => b.score - a.score || a.start - b.start)
            .slice(0, max)
            .sort((a, b) => a.start - b.start)
        : EMPTY,
    [live, scan, selected, max],
  );

  return { marks, suggestions };
}
