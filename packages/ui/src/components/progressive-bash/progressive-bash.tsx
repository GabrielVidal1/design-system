import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react';

import { cn } from '../../lib/utils';
import {
  tokenizeCommand,
  splitOutput,
  parseEchoMarkers,
  type CmdToken,
  type OutputLine,
  type OutputSpan,
  type SubMarker,
} from './parse';
import { computeGapMs, DEFAULT_TUNING, type BashEntry, type PlaybackTuning } from './playback';

export type { BashEntry, PlaybackTuning } from './playback';

/** Imperative handle for feeding entries and driving the terminal. */
export interface ProgressiveBashHandle {
  /** Append one or more entries (deduped by id). Plays continuously. */
  push: (entry: BashEntry | BashEntry[]) => void;
  /** Remove everything and reset the playhead. */
  clear: () => void;
  /** Reveal every entry instantly (skip the animation). */
  skipToEnd: () => void;
  /** Force the scroll view to the latest line. */
  scrollToBottom: () => void;
}

export interface ProgressiveBashProps {
  /**
   * The command/output series to play, oldest → newest. Growing this array (a
   * fresh batch streamed in) appends to the queue; already-played entries are
   * never re-animated. You can also feed entries imperatively via
   * {@link ProgressiveBashHandle.push} — both merge, deduped by `id`.
   */
  entries?: BashEntry[];
  /** Command typing rate, chars/sec. @default 55 */
  typeSpeed?: number;
  /** Output reveal rate, lines/sec. @default 24 */
  outputSpeed?: number;
  /**
   * Fixed seconds between entries. When omitted, gaps are derived from each
   * entry's `timestamp` and compressed into a lively, bounded, continuous
   * playback (see {@link computeGapMs}).
   */
  delay?: number;
  /** Floor / ceiling / saturation for timestamp-derived gaps (ms). */
  minGap?: number;
  maxGap?: number;
  gapReference?: number;
  /** Pause between a typed command and its output (ms). @default 260 */
  think?: number;
  /** Reveal everything immediately (or honors `prefers-reduced-motion`). */
  instant?: boolean;
  /**
   * "Join in progress" — when the terminal mounts, every entry whose
   * `timestamp` is already in the past relative to this reference is rendered
   * fully-written (no replay), and live typing resumes at the first entry
   * at/after it. Pass a wall-clock ms reference, or `true` for `Date.now()`.
   * This is what stops a page reload from re-typing a whole finished session.
   */
  catchUp?: number | boolean;
  /**
   * Pin each command's prompt line to the top of the scroll viewport, so while
   * a long output scrolls by you can still see which command produced it (the
   * next command's prompt pushes the previous one up, like sticky table
   * headers). @default false
   */
  stickyPrompt?: boolean;
  /**
   * [EXPERIMENTAL] Parse each command for `echo "Title..[value]"` step markers
   * (see {@link parseEchoMarkers}) and hoist the matching output lines into
   * titled sub-part headers — turning one chained command into a labelled,
   * multi-step block. @default false
   */
  experimentalSubparts?: boolean;
  /** Prompt glyph shown before each command. @default '❯' */
  prompt?: string;
  /** Show each entry's `description` as a `# comment` line. @default true */
  showDescriptions?: boolean;
  /** Fired when the playhead catches up to the last known entry. */
  onIdle?: () => void;
  className?: string;
  bodyClassName?: string;
  /** Override any of the terminal color CSS vars (`--tb-*`). */
  style?: CSSProperties;
  apiRef?: Ref<ProgressiveBashHandle>;
}

// A GitHub-dark-ish palette. Set as CSS vars on the root so a consumer can
// retheme by overriding `--tb-*` via `style`/`className`.
const PALETTE: Record<string, string> = {
  '--tb-bg': '#0a0d12',
  '--tb-fg': '#c9d3e0',
  '--tb-out': '#aab6c6',
  '--tb-dim': '#5b6675',
  '--tb-red': '#ff7b72',
  '--tb-green': '#4bc98a',
  '--tb-yellow': '#e3b341',
  '--tb-blue': '#6cb6ff',
  '--tb-cyan': '#56d4dd',
  '--tb-magenta': '#d2a8ff',
  '--tb-orange': '#ffa657',
  '--tb-prompt': '#4bc98a',
  '--tb-header': '#111722',
  '--tb-border': 'rgba(255,255,255,0.08)',
};

const CMD_COLOR: Record<CmdToken['kind'], string> = {
  program: 'var(--tb-fg)',
  subcommand: 'var(--tb-cyan)',
  flag: 'var(--tb-yellow)',
  string: 'var(--tb-green)',
  operator: 'var(--tb-magenta)',
  path: 'var(--tb-cyan)',
  var: 'var(--tb-magenta)',
  number: 'var(--tb-orange)',
  comment: 'var(--tb-dim)',
  plain: 'var(--tb-fg)',
};

const LINE_COLOR: Record<OutputLine['kind'], string> = {
  error: 'var(--tb-red)',
  warn: 'var(--tb-yellow)',
  success: 'var(--tb-green)',
  info: 'var(--tb-blue)',
  section: 'var(--tb-cyan)',
  plain: 'var(--tb-out)',
};

const ACCENT_COLOR: Record<NonNullable<OutputSpan['accent']>, string> = {
  url: 'var(--tb-blue)',
  path: 'var(--tb-cyan)',
  number: 'var(--tb-orange)',
  string: 'var(--tb-green)',
  flag: 'var(--tb-yellow)',
  hash: 'var(--tb-magenta)',
};

interface Parsed {
  tokens: CmdToken[];
  cmdLen: number;
  lines: OutputLine[];
}

/** Truncate a token stream to the first `n` visible characters. */
function sliceTokens(tokens: CmdToken[], n: number): CmdToken[] {
  if (n <= 0) return [];
  const out: CmdToken[] = [];
  let used = 0;
  for (const t of tokens) {
    if (used + t.text.length <= n) {
      out.push(t);
      used += t.text.length;
    } else {
      out.push({ ...t, text: t.text.slice(0, n - used) });
      break;
    }
    if (used >= n) break;
  }
  return out;
}

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const NEAR_BOTTOM_PX = 40;

interface Cursor {
  index: number; // entry currently animating; === list.length ⇒ idle/caught-up
  phase: 'gap' | 'type' | 'think' | 'output' | 'idle';
  typed: number;
  outLines: number;
  acc: number; // ms accumulated in the current phase
  gapMs: number;
}

/**
 * An animated terminal that "types" a series of shell commands and reveals each
 * command's output line-by-line — turning an intermittent batch of
 * command/output records into a continuously-playing terminal. Commands and
 * output are regex-tokenized and colorized like a real shell + pager (programs,
 * flags, paths, URLs, pass/fail lines, `=== section ===` dividers).
 *
 * Feed it via the `entries` prop (append to stream more) or imperatively via
 * `apiRef.push(...)`. Timestamps on entries are compressed into a lively,
 * bounded inter-command delay so replay stays continuous no matter how sparse
 * the real timing was. The view auto-scrolls to the newest line but releases
 * that lock the moment you scroll up (like a chat log).
 *
 * Extras: `catchUp` renders already-past entries fully-written on mount (a
 * reload doesn't re-type a finished session); `stickyPrompt` pins each
 * command's prompt line to the top while its output scrolls; and
 * `experimentalSubparts` hoists `echo "Title..[value]"` step markers inside a
 * chained command into titled sub-part headers.
 */
export function ProgressiveBash({
  entries,
  typeSpeed = DEFAULT_TUNING.typeSpeed,
  outputSpeed = DEFAULT_TUNING.outputSpeed,
  delay,
  minGap = DEFAULT_TUNING.minGapMs,
  maxGap = DEFAULT_TUNING.maxGapMs,
  gapReference = DEFAULT_TUNING.gapReferenceMs,
  think = DEFAULT_TUNING.thinkMs,
  instant = false,
  catchUp,
  stickyPrompt = false,
  experimentalSubparts = false,
  prompt = '❯',
  showDescriptions = true,
  onIdle,
  className,
  bodyClassName,
  style,
  apiRef,
}: ProgressiveBashProps) {
  const skip = instant || reducedMotion();

  // The merged, deduped entry list (prop + imperative pushes).
  const [list, setList] = useState<BashEntry[]>(() => entries ?? []);
  const seen = useRef<Set<string>>(new Set((entries ?? []).map((e) => e.id)));
  const listRef = useRef(list);
  listRef.current = list;

  const appendEntries = useCallback((incoming: BashEntry[]) => {
    const fresh = incoming.filter((e) => e && !seen.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.current.add(e.id));
    setList((l) => [...l, ...fresh]);
  }, []);

  // Absorb new entries appended to the controlled prop.
  useEffect(() => {
    if (entries) appendEntries(entries);
  }, [entries, appendEntries]);

  const parsed = useMemo(() => {
    const map = new Map<string, Parsed>();
    for (const e of list) {
      const markers = experimentalSubparts ? parseEchoMarkers(e.command ?? '') : undefined;
      map.set(e.id, {
        tokens: tokenizeCommand(e.command ?? ''),
        cmdLen: (e.command ?? '').length,
        lines: e.output ? splitOutput(e.output, markers) : [],
      });
    }
    return map;
  }, [list, experimentalSubparts]);
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  const tuning: PlaybackTuning = useMemo(
    () => ({
      typeSpeed,
      outputSpeed,
      fixedDelay: delay,
      minGapMs: minGap,
      maxGapMs: maxGap,
      gapReferenceMs: gapReference,
      thinkMs: think,
    }),
    [typeSpeed, outputSpeed, delay, minGap, maxGap, gapReference, think],
  );
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;

  // Progress mirror that drives the paint.
  const [render, setRender] = useState<Cursor>({ index: 0, phase: 'gap', typed: 0, outLines: 0, acc: 0, gapMs: 0 });
  const cursor = useRef<Cursor>(render);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const kickRef = useRef<() => void>(() => {});
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  // The persistent playback loop — created once, reads everything via refs so a
  // growing entry list never restarts what already played (mirrors ProgressiveText).
  useEffect(() => {
    let lastTs = 0;
    const frame = (ts: number) => {
      if (lastTs === 0) {
        lastTs = ts;
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      const dt = ts - lastTs;
      lastTs = ts;

      const l = listRef.current;
      const cur = cursor.current;
      const t = tuningRef.current;
      let changed = false;

      if (cur.index >= l.length) {
        // Caught up: idle until more entries arrive.
        runningRef.current = false;
        return;
      }
      const p = parsedRef.current.get(l[cur.index].id);
      const cmdLen = p?.cmdLen ?? 0;
      const lineCount = p?.lines.length ?? 0;

      cur.acc += dt;
      switch (cur.phase) {
        case 'gap':
          if (cur.acc >= cur.gapMs) {
            cur.phase = 'type';
            cur.acc = 0;
            changed = true;
          }
          break;
        case 'type': {
          const iv = 1000 / Math.max(1, t.typeSpeed);
          while (cur.typed < cmdLen && cur.acc >= iv) {
            cur.acc -= iv;
            cur.typed++;
            changed = true;
          }
          if (cur.typed >= cmdLen) {
            cur.phase = 'think';
            cur.acc = 0;
          }
          break;
        }
        case 'think':
          if (cur.acc >= t.thinkMs) {
            cur.acc = 0;
            if (lineCount > 0) {
              cur.phase = 'output';
            } else {
              advance(cur, l, t);
              changed = true;
            }
          }
          break;
        case 'output': {
          const iv = 1000 / Math.max(0.5, t.outputSpeed);
          while (cur.outLines < lineCount && cur.acc >= iv) {
            cur.acc -= iv;
            cur.outLines++;
            changed = true;
          }
          if (cur.outLines >= lineCount) {
            advance(cur, l, t);
            changed = true;
          }
          break;
        }
        default:
          break;
      }

      if (changed) setRender({ ...cur });
      if (cur.index >= l.length) {
        runningRef.current = false;
        onIdleRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    // Move the cursor to the next entry, computing its compressed start gap.
    const advance = (cur: Cursor, l: BashEntry[], t: PlaybackTuning) => {
      const prev = l[cur.index];
      const nextIdx = cur.index + 1;
      cur.index = nextIdx;
      cur.typed = 0;
      cur.outLines = 0;
      cur.acc = 0;
      if (nextIdx >= l.length) {
        cur.phase = 'idle';
      } else {
        cur.gapMs = computeGapMs(prev?.timestamp, l[nextIdx].timestamp, t);
        cur.phase = 'gap';
      }
    };

    kickRef.current = () => {
      if (runningRef.current) return;
      const cur = cursor.current;
      const l = listRef.current;
      if (cur.index >= l.length) return; // nothing new to play
      if (cur.phase === 'idle') {
        // Resuming after a lull: schedule the fresh entry's gap.
        const prev = l[cur.index - 1];
        cur.gapMs = cur.index === 0 ? t0Gap(tuningRef.current) : computeGapMs(prev?.timestamp, l[cur.index].timestamp, tuningRef.current);
        cur.phase = 'gap';
        cur.acc = 0;
      }
      runningRef.current = true;
      lastTs = 0;
      rafRef.current = requestAnimationFrame(frame);
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip / instant: jump straight to fully-revealed.
  useEffect(() => {
    if (!skip) return;
    cursor.current = { index: list.length, phase: 'idle', typed: 0, outLines: 0, acc: 0, gapMs: 0 };
    setRender({ ...cursor.current });
  }, [skip, list.length]);

  // Catch-up: on first paint, fast-forward past every entry already in the past
  // relative to the `catchUp` reference so a reload doesn't re-type finished
  // history — only entries at/after "now" animate live. Runs once.
  const caughtUp = useRef(false);
  useEffect(() => {
    if (caughtUp.current || skip || !catchUp || list.length === 0) return;
    caughtUp.current = true;
    const ref = typeof catchUp === 'number' ? catchUp : Date.now();
    let idx = 0;
    while (idx < list.length && list[idx].timestamp != null && (list[idx].timestamp as number) <= ref) idx++;
    if (idx <= 0) return; // nothing is in the past — play normally
    cursor.current = {
      index: idx,
      phase: idx >= list.length ? 'idle' : 'gap',
      typed: 0,
      outLines: 0,
      acc: 0,
      gapMs: 0,
    };
    setRender({ ...cursor.current });
  }, [catchUp, list, skip]);

  // React to list growth: (re)start the loop unless skipping.
  useEffect(() => {
    if (skip) return;
    if (list.length === 0) return;
    // First entry's initial gap.
    if (cursor.current.index === 0 && cursor.current.phase === 'gap' && cursor.current.typed === 0 && cursor.current.gapMs === 0) {
      cursor.current.gapMs = t0Gap(tuning);
    }
    kickRef.current();
  }, [list, skip, tuning]);

  // ---- Autoscroll-lock (release the moment the user scrolls up) -------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stick.current = true;
    setAtBottom(true);
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stick.current = near;
    setAtBottom((cur) => (cur === near ? cur : near));
  }, []);

  useEffect(() => {
    if (stick.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [render]);

  useImperativeHandle(
    apiRef,
    () => ({
      push: (e: BashEntry | BashEntry[]) => appendEntries(Array.isArray(e) ? e : [e]),
      clear: () => {
        seen.current = new Set();
        cursor.current = { index: 0, phase: 'gap', typed: 0, outLines: 0, acc: 0, gapMs: 0 };
        setRender({ ...cursor.current });
        setList([]);
      },
      skipToEnd: () => {
        cursor.current = { index: listRef.current.length, phase: 'idle', typed: 0, outLines: 0, acc: 0, gapMs: 0 };
        setRender({ ...cursor.current });
      },
      scrollToBottom,
    }),
    [appendEntries, scrollToBottom],
  );

  const rootStyle: CSSProperties = { ...PALETTE, ...style, background: 'var(--tb-bg)' } as CSSProperties;

  return (
    <div
      className={cn('ds-terminal relative flex h-full min-h-0 flex-col font-mono text-[12.5px] leading-[1.55]', className)}
      style={rootStyle}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-2.5', bodyClassName)}
        style={{ color: 'var(--tb-fg)' }}
      >
        {list.length === 0 ? (
          <div className="select-none py-6 text-center" style={{ color: 'var(--tb-dim)' }}>
            {prompt} waiting for commands…
          </div>
        ) : (
          list.map((entry, i) => (
            <BashBlock
              key={entry.id}
              entry={entry}
              parsed={parsed.get(entry.id)!}
              prompt={prompt}
              showDescriptions={showDescriptions}
              stickyPrompt={stickyPrompt}
              state={blockState(i, render)}
            />
          ))
        )}
      </div>
      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] shadow-lg"
          style={{ background: 'var(--tb-header)', color: 'var(--tb-fg)', border: '1px solid var(--tb-border)' }}
        >
          ↓ live
        </button>
      )}
    </div>
  );
}

/** A short initial pause before the very first command types in. */
function t0Gap(t: PlaybackTuning): number {
  return t.fixedDelay != null ? Math.max(0, t.fixedDelay * 1000) : Math.min(300, t.minGapMs);
}

type BlockState =
  | { revealed: false }
  | { revealed: true; typed: number; outLines: number; caret: 'cmd' | 'out' | null; full: boolean };

function blockState(i: number, cur: Cursor): BlockState {
  if (i < cur.index) return { revealed: true, typed: Infinity, outLines: Infinity, caret: null, full: true };
  if (i > cur.index) return { revealed: false };
  // The active block.
  const caret = cur.phase === 'type' || cur.phase === 'think' ? 'cmd' : cur.phase === 'output' ? 'out' : null;
  return { revealed: true, typed: cur.typed, outLines: cur.outLines, caret, full: false };
}

function BashBlock({
  entry,
  parsed,
  prompt,
  showDescriptions,
  stickyPrompt,
  state,
}: {
  entry: BashEntry;
  parsed: Parsed;
  prompt: string;
  showDescriptions: boolean;
  stickyPrompt: boolean;
  state: BlockState;
}) {
  if (!state.revealed) return null;
  const typedTokens = state.full ? parsed.tokens : sliceTokens(parsed.tokens, state.typed);
  const cmdDone = state.full || state.typed >= parsed.cmdLen;
  const lines = state.full ? parsed.lines : parsed.lines.slice(0, state.outLines);
  const failed = entry.isError || (entry.exitCode != null && entry.exitCode !== 0);

  const cmdRowStyle: CSSProperties | undefined = stickyPrompt
    ? { position: 'sticky', top: 0, zIndex: 2, background: 'var(--tb-bg)' }
    : undefined;

  return (
    <div className="mb-1.5">
      <div className="flex flex-col" style={cmdRowStyle}>
        {showDescriptions && entry.description && cmdDone && (
          <div className="whitespace-pre-wrap" style={{ color: 'var(--tb-dim)' }}>
            # {entry.description}
          </div>
        )}
        <div className="flex whitespace-pre-wrap break-all">
          <span
            className="mr-1.5 shrink-0 select-none"
            style={{ color: failed ? 'var(--tb-red)' : 'var(--tb-prompt)' }}
          >
            {entry.cwd ? <span style={{ color: 'var(--tb-blue)' }}>{entry.cwd} </span> : null}
            {prompt}
          </span>
          <span className="min-w-0">
            {typedTokens.map((t, idx) => (
              <span key={idx} style={{ color: CMD_COLOR[t.kind], fontWeight: t.kind === 'program' ? 600 : undefined }}>
                {t.text}
              </span>
            ))}
            {state.caret === 'cmd' && <Caret />}
          </span>
        </div>
      </div>
      {lines.length > 0 && (
        <div className="mt-0.5">
          {lines.map((ln, idx) =>
            ln.sub ? (
              <SubHeader key={idx} sub={ln.sub} />
            ) : ln.divider ? (
              <div
                key={idx}
                className="my-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--tb-cyan)' }}
              >
                <span className="h-px flex-1" style={{ background: 'var(--tb-border)' }} />
                {ln.spans[0]?.text}
                <span className="h-px flex-1" style={{ background: 'var(--tb-border)' }} />
              </div>
            ) : (
              <div key={idx} className="whitespace-pre-wrap break-all" style={{ color: LINE_COLOR[ln.kind] }}>
                {ln.spans.map((s, sIdx) => (
                  <span key={sIdx} style={s.accent ? { color: ACCENT_COLOR[s.accent] } : undefined}>
                    {s.text}
                  </span>
                ))}
                {state.caret === 'out' && idx === lines.length - 1 && <Caret />}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** A hoisted `echo "Title..[value]"` step marker, rendered as a titled header. */
function SubHeader({ sub }: { sub: SubMarker }) {
  return (
    <div className="mb-0.5 mt-1.5 flex items-center gap-2">
      <span
        className="rounded-sm px-1.5 py-px text-[11px] font-semibold"
        style={{ background: 'var(--tb-header)', color: 'var(--tb-cyan)', border: '1px solid var(--tb-border)' }}
      >
        {sub.title}
      </span>
      {sub.value && (
        <span
          className="rounded-sm px-1.5 py-px text-[10.5px] font-medium"
          style={{ color: 'var(--tb-magenta)', border: '1px solid var(--tb-border)' }}
        >
          {sub.value}
        </span>
      )}
      <span className="h-px flex-1" style={{ background: 'var(--tb-border)' }} />
    </div>
  );
}

function Caret() {
  return (
    <span aria-hidden className="ml-px inline-block animate-pulse" style={{ color: 'var(--tb-fg)' }}>
      ▋
    </span>
  );
}
