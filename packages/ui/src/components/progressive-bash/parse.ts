// Regex tokenizers that turn a raw shell command and its output into typed
// spans, so the terminal can colorize them the way a real shell / pager would.
// Everything here is pure and synchronous — the component colors the *already
// revealed* substring, so highlighting composes with the typewriter reveal.

export type CmdKind =
  | 'program'
  | 'subcommand'
  | 'flag'
  | 'string'
  | 'operator'
  | 'path'
  | 'var'
  | 'number'
  | 'comment'
  | 'plain';

export interface CmdToken {
  text: string;
  kind: CmdKind;
}

const OPERATOR = /^(\|\||&&|>>|<<|[|&;<>()])/;
const STRING = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/;
const VAR = /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/;
const FLAG = /^-{1,2}[A-Za-z0-9][A-Za-z0-9-]*/;
const NUMBER = /^\d+(?:\.\d+)?/;
const WORD = /^[^\s|&;<>()]+/;
const WS = /^\s+/;

function looksLikePath(word: string): boolean {
  return /[/~]/.test(word) && !/^-/.test(word);
}

/**
 * Break a shell command into colorable tokens. The first bare word is the
 * program; the next bare word (if it isn't a flag/path) is treated as its
 * subcommand (`git commit`, `docker compose`, `make up`). Whitespace is kept as
 * `plain` tokens so the reconstruction is loss-less.
 */
export function tokenizeCommand(command: string): CmdToken[] {
  const tokens: CmdToken[] = [];
  let rest = command;
  let sawProgram = false;
  let sawSubcommand = false;
  // A `#` starting a token runs the rest of the line as a comment.
  const hashAt = command.search(/(^|\s)#/);
  let commentTail = '';
  if (hashAt >= 0) {
    const idx = command[hashAt] === '#' ? hashAt : hashAt + 1;
    commentTail = command.slice(idx);
    rest = command.slice(0, idx);
  }

  while (rest.length > 0) {
    let m: RegExpMatchArray | null;
    if ((m = rest.match(WS))) {
      tokens.push({ text: m[0], kind: 'plain' });
    } else if ((m = rest.match(STRING))) {
      tokens.push({ text: m[0], kind: 'string' });
    } else if ((m = rest.match(OPERATOR))) {
      tokens.push({ text: m[0], kind: 'operator' });
      sawProgram = false; // a new pipeline stage restarts program detection
      sawSubcommand = false;
    } else if ((m = rest.match(VAR))) {
      tokens.push({ text: m[0], kind: 'var' });
    } else if ((m = rest.match(FLAG))) {
      tokens.push({ text: m[0], kind: 'flag' });
    } else if ((m = rest.match(WORD))) {
      const w = m[0];
      let kind: CmdKind;
      if (!sawProgram) {
        kind = 'program';
        sawProgram = true;
      } else if (!sawSubcommand && !looksLikePath(w) && /^[a-z][a-z0-9:._-]*$/i.test(w) && !/[=]/.test(w)) {
        kind = 'subcommand';
        sawSubcommand = true;
      } else if (looksLikePath(w)) {
        kind = 'path';
      } else if (NUMBER.test(w)) {
        kind = 'number';
      } else {
        kind = 'plain';
      }
      tokens.push({ text: w, kind });
    } else {
      tokens.push({ text: rest[0], kind: 'plain' });
      rest = rest.slice(1);
      continue;
    }
    rest = rest.slice(m[0].length);
  }
  if (commentTail) tokens.push({ text: commentTail, kind: 'comment' });
  return tokens;
}

export type LineKind = 'section' | 'error' | 'success' | 'warn' | 'info' | 'plain';

export interface OutputSpan {
  text: string;
  /** Inline accent, layered on top of the line's base color. */
  accent?: 'path' | 'url' | 'number' | 'string' | 'flag' | 'hash';
}

export interface OutputLine {
  kind: LineKind;
  /** `true` for `===.*===` / `--- … ---` divider lines (rendered as a bar). */
  divider: boolean;
  /**
   * Set when this line is an `echo "Title..[value]"` sub-part marker (see
   * {@link parseEchoMarkers}). The raw echo line is swallowed and rendered as a
   * titled step header instead of plain output.
   */
  sub?: SubMarker;
  spans: OutputSpan[];
  raw: string;
}

/** A `Title..[value]` step marker echoed inside a compound command. */
export interface SubMarker {
  /** The human title (text before `..[`). */
  title: string;
  /** The bracketed tag/value (text inside `[...]`), if any. */
  value?: string;
  /** The exact echoed string, used to match the marker line in the output. */
  raw: string;
}

// `echo "Title..[value]"` / `echo 'Title..[value]'` inside a command.
const ECHO_RE = /\becho\s+(?:"([^"]*)"|'([^']*)'|([^\s|&;<>()]+))/g;
const MARKER_RE = /^(.*?)\.\.\[([^\]]*)\]\s*$/;

/** Parse `Title..[value]` from a bare echoed string, or `null` if it isn't one. */
export function parseMarkerText(text: string): SubMarker | null {
  const m = text.match(MARKER_RE);
  if (!m) return null;
  return { title: m[1].trim(), value: m[2].trim() || undefined, raw: text };
}

/**
 * [EXPERIMENTAL] Pull `echo "Title..[value]"` step markers out of a compound
 * command. Agents often chain steps like
 * `echo "Install..[deps]" && npm i && echo "Build..[vite]" && npm run build`;
 * each specially-formatted echo prints a heading into the output that we can
 * then hoist into a titled sub-part (see {@link splitOutput}'s `markers` arg).
 * Only echoes using the `..[...]` syntax are treated as markers — ordinary
 * `echo "hello"` lines are left untouched.
 */
export function parseEchoMarkers(command: string): SubMarker[] {
  const markers: SubMarker[] = [];
  let m: RegExpExecArray | null;
  ECHO_RE.lastIndex = 0;
  while ((m = ECHO_RE.exec(command))) {
    const text = m[1] ?? m[2] ?? m[3] ?? '';
    const marker = parseMarkerText(text);
    if (marker) markers.push(marker);
  }
  return markers;
}

const SECTION_RE = /^\s*(={2,}|-{2,}|#{2,})\s*(.*?)\s*(={2,}|-{2,}|#{2,})?\s*$/;
const ERROR_RE = /(^|\b)(error|errors|fatal|fail(?:ed|ure|s)?|panic|denied|refused|exception|traceback|cannot|not found|no such|✗|✖|❌|✘)(\b|:)/i;
const SUCCESS_RE = /(^|\b)(ok|pass(?:ed|es)?|success(?:ful)?|done|complete[d]?|built|ready|up[- ]to[- ]date|installed|✓|✔|✅|√)(\b|:)/i;
const WARN_RE = /(^|\b)(warn(?:ing|ings)?|deprecat(?:ed|ion)|skip(?:ped|ping)?|notice|caution|⚠)(\b|:)/i;
const INFO_RE = /(^|\b)(=== RUN|=== CONT|info|note|debug|→|›|»|\$)(\b|\s|$)/;

const INLINE_RE =
  /(https?:\/\/[^\s'"]+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b[0-9a-f]{7,40}\b)|((?:\.{0,2}\/|~\/)[\w./@-]+|\b[\w.-]+\/[\w./@-]+)|(-{1,2}[A-Za-z][\w-]*)|(\b\d+(?:\.\d+)?%?\b)/g;

/** Split one output line into inline-highlighted spans (URLs, paths, …). */
function inlineSpans(text: string): OutputSpan[] {
  const spans: OutputSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    let accent: OutputSpan['accent'];
    if (m[1]) accent = 'url';
    else if (m[2]) accent = 'string';
    else if (m[3]) accent = 'hash';
    else if (m[4]) accent = 'path';
    else if (m[5]) accent = 'flag';
    else if (m[6]) accent = 'number';
    spans.push({ text: m[0], accent });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text }];
}

/** Classify a single output line and produce its inline spans. */
export function classifyLine(line: string): OutputLine {
  const sec = line.match(SECTION_RE);
  const divider = !!sec && (sec[2]?.length ?? 0) >= 0 && /^\s*(={2,}|-{3,}|#{2,})/.test(line);
  if (divider) {
    return { kind: 'section', divider: true, spans: [{ text: sec![2] || line.trim() }], raw: line };
  }
  let kind: LineKind = 'plain';
  if (ERROR_RE.test(line)) kind = 'error';
  else if (WARN_RE.test(line)) kind = 'warn';
  else if (SUCCESS_RE.test(line)) kind = 'success';
  else if (INFO_RE.test(line)) kind = 'info';
  return { kind, divider: false, spans: inlineSpans(line), raw: line };
}

/**
 * Split raw output into lines. Blocks delimited by `=== … ===` (or `--- … ---`)
 * lines are kept as their own section markers — this mirrors how test runners
 * (`=== RUN`, `--- PASS`) and check scripts group their output, and lets the
 * player reveal one section at a time.
 *
 * Pass `markers` (from {@link parseEchoMarkers}) to hoist matching
 * `echo "Title..[value]"` output lines into titled sub-part headers.
 */
export function splitOutput(output: string, markers?: SubMarker[]): OutputLine[] {
  const byRaw = markers && markers.length ? new Map(markers.map((m) => [m.raw, m])) : null;
  return output
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      if (byRaw) {
        const hit = byRaw.get(line.trim());
        if (hit) return { kind: 'section' as LineKind, divider: false, sub: hit, spans: [{ text: line }], raw: line };
      }
      return classifyLine(line);
    });
}
