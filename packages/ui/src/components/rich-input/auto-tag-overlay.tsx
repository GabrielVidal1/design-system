import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { Check, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { AutoTagMatch } from './use-auto-tag';

/**
 * The auto-tag layer: rings around the words auto-tag recognised, and the
 * accept/refuse pair for the ones still to be answered.
 *
 * A `<textarea>` has no addressable insides — you cannot wrap one of its words
 * in a span, and a caret inside it must keep behaving like a caret. So the
 * decoration is drawn around it, in three stacked layers sharing one box:
 *
 * 1. a **mirror** *behind* the textarea — the same string with the same
 *    typography, its text transparent, carrying the coloured mark of every
 *    already-accepted hit. Behind, so its tints sit under the real glyphs
 *    instead of painting over them;
 * 2. the **textarea** itself, untouched;
 * 3. a **ring layer** on top holding the SVG outlines and the buttons — the
 *    only part that takes pointer events, and only on the buttons.
 *
 * The mirror is also the measuring instrument: its spans are laid out by the
 * same wrapping the textarea uses, so `getClientRects()` on a span gives the
 * exact box of that word — one rect per line when it wraps, which is why a
 * match can carry several rings. Everything is re-measured on scroll, on
 * resize, and whenever the matches change; the mirror's scroll is slaved to the
 * textarea's so the two never drift.
 */

/** A measured box, relative to the wrapper. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Measured {
  key: string;
  boxes: Box[];
}

const DEFAULT_COLOR = 'var(--color-primary, currentColor)';

/** Typography the mirror must copy from the textarea, verbatim. */
const MIRROR_CLASS =
  'pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words px-2 py-1 text-sm leading-[22px] text-transparent';

export function AutoTagOverlay({
  taRef,
  value,
  marks,
  suggestions,
  onAccept,
  onRefuse,
}: {
  taRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  marks: AutoTagMatch[];
  suggestions: AutoTagMatch[];
  onAccept: (m: AutoTagMatch) => void;
  onRefuse: (m: AutoTagMatch) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<Measured[]>([]);

  const active = [...marks, ...suggestions].sort((a, b) => a.start - b.start);
  // Cheap identity of what is drawn — remeasuring keys off this rather than off
  // the arrays, which are new objects on every render.
  const sig = active.map((m) => `${m.key}:${m.end}`).join('|');
  const pending = new Set(suggestions.map((m) => m.key));

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const mirror = mirrorRef.current;
    if (!wrap || !mirror) return;
    const base = wrap.getBoundingClientRect();
    const next: Measured[] = [];
    for (const el of mirror.querySelectorAll<HTMLElement>('[data-at-key]')) {
      const key = el.dataset.atKey;
      if (!key) continue;
      const boxes = [...el.getClientRects()]
        // A wrapped span reports a zero-width rect at the break — drawing a
        // ring around nothing looks like a rendering bug.
        .filter((r) => r.width > 0.5)
        .map((r) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }));
      if (boxes.length) next.push({ key, boxes });
    }
    setMeasured((prev) => (sameBoxes(prev, next) ? prev : next));
  }, []);

  // Layout effect: measure in the same frame the mirror is painted, so a ring
  // never shows up one frame late (and one word behind).
  useLayoutEffect(measure, [measure, sig, value]);

  useEffect(() => {
    const ta = taRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) return;
    const sync = () => {
      if (mirrorRef.current) mirrorRef.current.scrollTop = ta.scrollTop;
      measure();
    };
    ta.addEventListener('scroll', sync);
    // Guarded: the overlay must still mount where there is no ResizeObserver
    // (jsdom, older WebViews) — it simply stops re-measuring on resize.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    ro?.observe(wrap);
    ro?.observe(ta);
    return () => {
      ta.removeEventListener('scroll', sync);
      ro?.disconnect();
    };
  }, [taRef, measure]);

  const byKey = new Map(measured.map((m) => [m.key, m.boxes]));

  return (
    <>
      <div ref={wrapRef} className="pointer-events-none absolute inset-0">
        <div ref={mirrorRef} aria-hidden className={MIRROR_CLASS}>
          {segments(value, active).map((seg, i) =>
            seg.match ? (
              <span
                key={seg.match.key}
                data-at-key={seg.match.key}
                className={cn(
                  'rounded-[3px]',
                  // An accepted hit keeps its colour for as long as the tag is
                  // on; a pending one is only measured, and gets its ring from
                  // the SVG layer.
                  !pending.has(seg.match.key) && 'ds-auto-tag-mark',
                )}
                style={
                  pending.has(seg.match.key)
                    ? undefined
                    : ({ '--ds-at': seg.match.tag.color || DEFAULT_COLOR } as CSSProperties)
                }
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

        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {suggestions.flatMap((m) =>
            (byKey.get(m.key) ?? []).map((b, i) => (
              <rect
                key={`${m.key}-${i}`}
                x={b.x - 2.5}
                y={b.y - 1}
                width={b.w + 5}
                height={b.h}
                rx={6}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                stroke={m.tag.color || DEFAULT_COLOR}
                className="ds-auto-tag-ants"
              />
            )),
          )}
        </svg>
      </div>

      {suggestions.map((m) => {
        const boxes = byKey.get(m.key);
        if (!boxes?.length) return null;
        const last = boxes[boxes.length - 1];
        return (
          <AutoTagCta
            key={m.key}
            match={m}
            x={last.x + last.w + 6}
            y={last.y + last.h / 2}
            onAccept={() => onAccept(m)}
            onRefuse={() => onRefuse(m)}
          />
        );
      })}
    </>
  );
}

/** The accept/refuse pair, parked at the end of the ringed word. */
function AutoTagCta({
  match,
  x,
  y,
  onAccept,
  onRefuse,
}: {
  match: AutoTagMatch;
  x: number;
  y: number;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const color = match.tag.color || DEFAULT_COLOR;
  const label = match.tag.label || match.tag.id;
  return (
    <span
      className="ds-auto-tag-cta pointer-events-auto absolute z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-full border bg-card/95 p-0.5 shadow-sm backdrop-blur-[1px]"
      style={{ left: x, top: y, borderColor: color }}
      role="group"
      aria-label={`Suggested tag ${label}`}
    >
      <button
        type="button"
        // Keep the caret where it was: the point of answering in place is not
        // having to find your spot again afterwards.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onAccept}
        title={`Add ${label}`}
        aria-label={`Add tag ${label}`}
        className="inline-flex size-4 items-center justify-center rounded-full transition-colors hover:bg-muted"
        style={{ color }}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRefuse}
        title={`Dismiss ${label}`}
        aria-label={`Dismiss suggested tag ${label}`}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" strokeWidth={3} />
      </button>
    </span>
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

function sameBoxes(a: Measured[], b: Measured[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => {
    const n = b[i];
    return (
      m.key === n.key &&
      m.boxes.length === n.boxes.length &&
      m.boxes.every((x, j) => {
        const y = n.boxes[j];
        return (
          Math.abs(x.x - y.x) < 0.5 &&
          Math.abs(x.y - y.y) < 0.5 &&
          Math.abs(x.w - y.w) < 0.5 &&
          Math.abs(x.h - y.h) < 0.5
        );
      })
    );
  });
}
