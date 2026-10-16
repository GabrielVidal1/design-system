import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

import type { AutoTagMatch } from './use-auto-tag';

/**
 * The auto-tag layer: a mark (light wash + underline, in the tag's colour)
 * under every word that a **selected** tag's triggers matched — nothing more.
 * A word whose tag is still off gets no decoration at all: the tag list floats
 * that tag to the front instead, and turning it on is an ordinary chip tap.
 * No ring, no buttons, nothing to answer in the sentence.
 *
 * A `<textarea>` has no addressable insides — you cannot wrap one of its words
 * in a span, and a caret inside it must keep behaving like a caret. So the
 * marks live on a **mirror** *behind* the textarea: the same string with
 * the same typography, its glyphs transparent, its matched runs decorated.
 * Behind, so nothing ever paints over the real glyphs or takes a click; laid
 * out by the same wrapping the textarea uses, so a mark lands exactly
 * under its word (and follows it onto the next line when it wraps). The
 * mirror's scroll is slaved to the textarea's so the two never drift.
 */

const DEFAULT_COLOR = 'var(--color-primary, currentColor)';

/** Structure only — the typography is copied off the textarea at runtime. */
const MIRROR_CLASS =
  'pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words text-transparent';

/**
 * Every property that can change where a glyph lands. Copied from the
 * textarea's *computed* style rather than restated as classes: a consumer is
 * free to restyle the composer's text (this library's own host app sets
 * `textarea { font-family: monospace }` globally), and a mirror that guessed
 * the font would lay words out narrower than they are — putting every
 * mark a few characters to the left of the word it belongs to.
 */
const MIRRORED_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'wordSpacing',
  'lineHeight',
  'textIndent',
  'textTransform',
  'tabSize',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
] as const;

function readMirrorStyle(ta: HTMLTextAreaElement): CSSProperties {
  const cs = getComputedStyle(ta);
  const out: Record<string, string> = {};
  for (const p of MIRRORED_PROPS) out[p] = cs[p];
  // The mirror sits *on* the textarea's border box, so the border has to be
  // reserved as space rather than drawn.
  out.borderStyle = 'solid';
  out.borderColor = 'transparent';
  // A classic (non-overlay) scrollbar narrows the textarea's text column; the
  // mirror has none, so reserve the same width or every wrapped line drifts.
  const bar =
    ta.offsetWidth - ta.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  if (bar > 0.5) out.paddingRight = `${parseFloat(cs.paddingRight) + bar}px`;
  return out as CSSProperties;
}

export function AutoTagOverlay({
  taRef,
  value,
  marks,
}: {
  taRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  /** Hits whose tag is selected. */
  marks: AutoTagMatch[];
}) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [mirrorStyle, setMirrorStyle] = useState<CSSProperties>();


  // Typing can scroll the textarea before any scroll event reaches us.
  useEffect(() => {
    if (mirrorRef.current && taRef.current) mirrorRef.current.scrollTop = taRef.current.scrollTop;
  });

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const sync = () => {
      setMirrorStyle((prev) => {
        const next = readMirrorStyle(ta);
        return sameStyle(prev, next) ? prev : next;
      });
      if (mirrorRef.current) mirrorRef.current.scrollTop = ta.scrollTop;
    };
    sync();
    // A webfont landing after mount re-flows every word.
    document.fonts?.ready.then(sync).catch(() => {});
    ta.addEventListener('scroll', sync);
    // Guarded: the overlay must still mount where there is no ResizeObserver
    // (jsdom, older WebViews) — it simply stops re-syncing on resize.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    ro?.observe(ta);
    return () => {
      ta.removeEventListener('scroll', sync);
      ro?.disconnect();
    };
  }, [taRef]);

  return (
    <div ref={mirrorRef} aria-hidden className={MIRROR_CLASS} style={mirrorStyle}>
      {segments(value, marks).map((seg, i) =>
        seg.match ? (
          <span
            key={seg.match.key}
            data-at-key={seg.match.key}
            className="ds-auto-tag-mark rounded-[3px]"
            style={{ '--ds-at': seg.match.tag.color || DEFAULT_COLOR } as CSSProperties}
          >
            {seg.text}
          </span>
        ) : (
          <span key={`t${i}`}>{seg.text}</span>
        ),
      )}
      {/* A trailing newline is not laid out without something after it —
          the same trick a textarea's own scroll height uses. */}
      {'​'}
    </div>
  );
}

/** Split the text into plain runs and matched runs, in order. */
function segments(text: string, matches: AutoTagMatch[]): { text: string; match?: AutoTagMatch }[] {
  const out: { text: string; match?: AutoTagMatch }[] = [];
  let at = 0;
  for (const m of matches) {
    if (m.start < at) continue; // defensive: overlaps are resolved upstream
    if (m.start > at) out.push({ text: text.slice(at, m.start) });
    out.push({ text: text.slice(m.start, m.end), match: m });
    at = m.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

function sameStyle(a: CSSProperties | undefined, b: CSSProperties): boolean {
  if (!a) return false;
  const ka = Object.keys(a) as (keyof CSSProperties)[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}
