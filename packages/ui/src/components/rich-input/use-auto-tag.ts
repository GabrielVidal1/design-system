import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RichTag } from './types';
import { tagSlug } from './use-mention';

/**
 * **Auto-tag** — the composer reading what you typed and offering the tags it
 * recognises, instead of waiting for you to remember they exist.
 *
 * A tag opts in by carrying {@link RichTag.triggers}. Once the typing pauses
 * (see {@link AutoTagConfig.debounceMs}) the text is scanned for them, and each
 * hit is offered in place — circled where it sits in the sentence, with an
 * accept/refuse pair — rather than as a menu somewhere else. Accepting selects
 * the tag; the word then stays marked in the tag's colour for as long as it is
 * selected, which is what makes the connection between "the word I typed" and
 * "the tag that is now on" legible at a glance.
 *
 * Two rules keep it from crying wolf, because a wrong suggestion interrupts
 * someone mid-sentence and a missing one costs nothing:
 *  - **nothing is inferred** — a tag with no `triggers` is never suggested, and
 *    a tag's own label/slug is not silently added to its trigger list;
 *  - **a refusal sticks** for the rest of the composing session (the same word
 *    for the same tag never asks twice), and selected tags never re-ask at all.
 */

/** How eager auto-tag is. */
export interface AutoTagConfig {
  /** Quiet time before the text is scanned. Default 1000 ms. */
  debounceMs?: number;
  /** Most suggestions offered at once. Default 5. */
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
  // the losers disappear rather than stacking two rings on one word.
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
   * Hits whose tag is already selected — drawn as a permanent mark in the tag
   * colour, with no call to action. Uncapped: they are a reflection of the
   * selection, not an interruption.
   */
  marks: AutoTagMatch[];
  /** Hits still to be answered, best-scoring first, capped at `max`. */
  suggestions: AutoTagMatch[];
  /** Accept: select the tag (the hit becomes a mark). */
  accept: (m: AutoTagMatch) => void;
  /** Refuse: drop it, and don't offer this word for this tag again this session. */
  refuse: (m: AutoTagMatch) => void;
  /** Forget the refusals (the composer cleared / sent). */
  reset: () => void;
}

const EMPTY: AutoTagMatch[] = [];

export function useAutoTag({
  enabled,
  tags,
  value,
  selected,
  config,
  mentionPrefix,
  onAccept,
}: {
  enabled: boolean;
  tags: RichTag[];
  value: string;
  selected: ReadonlySet<string>;
  config: AutoTagConfig;
  mentionPrefix: string;
  onAccept: (tag: RichTag) => void;
}): AutoTagApi {
  const { debounceMs = DEBOUNCE_MS, max = MAX, minChars = MIN_CHARS } = config;
  const [settled, setSettled] = useState('');
  // `<tag id>::<matched text>`, lowercased — a refusal is about the word, not
  // the character offset, so editing elsewhere in the line can't resurrect it.
  const [refused, setRefused] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setSettled(value), debounceMs);
    return () => clearTimeout(t);
  }, [enabled, value, debounceMs]);

  const all = useMemo(() => {
    // Only ever scan text the user has stopped editing: the overlay positions
    // rings by character offset, so a scan of stale text would draw them
    // against the wrong words. Mid-keystroke the composer simply shows none.
    if (!enabled || settled !== value || value.trim().length < minChars) return EMPTY;
    const candidates = tags.filter((t) => (t.triggers?.length ?? 0) > 0);
    if (candidates.length === 0) return EMPTY;
    return findAutoTagMatches(value, candidates, { mentionPrefix });
  }, [enabled, settled, value, minChars, tags, mentionPrefix]);

  const marks = useMemo(() => all.filter((m) => selected.has(m.tag.id)), [all, selected]);

  const suggestions = useMemo(
    () =>
      all
        .filter(
          (m) =>
            !selected.has(m.tag.id) &&
            !refused.has(`${m.tag.id}::${m.text.toLowerCase()}`),
        )
        .sort((a, b) => b.score - a.score || a.start - b.start)
        .slice(0, max)
        .sort((a, b) => a.start - b.start),
    [all, selected, refused, max],
  );

  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;

  const accept = useCallback((m: AutoTagMatch) => onAcceptRef.current(m.tag), []);

  const refuse = useCallback((m: AutoTagMatch) => {
    setRefused((prev) => new Set(prev).add(`${m.tag.id}::${m.text.toLowerCase()}`));
  }, []);

  const reset = useCallback(() => setRefused(new Set()), []);

  return { marks, suggestions, accept, refuse, reset };
}
