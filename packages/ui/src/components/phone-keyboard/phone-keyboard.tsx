import * as React from 'react';
import { ArrowBigUp, ClipboardList, CornerDownLeft, Delete, Globe, LayoutGrid, Mic, Settings, Smile } from 'lucide-react';

import {
  LAYOUTS,
  findKey,
  rowUnits,
  type PhoneKey,
  type PhoneKeyboardLayout,
  type PhoneKeyboardLayoutName,
  type PhoneKeyboardPage,
} from './layouts';
import {
  useLocalPhoneText,
  usePhoneTextStore,
  type PhoneTextState,
  type PhoneTextStore,
} from './text-buffer';

/* ─── Theme ───────────────────────────────────────────────────────────────── */

export interface PhoneKeyboardTheme {
  /** Keyboard background (and the nav-bar strip below it). */
  bg: string;
  /** Letter / icon colour. */
  glyph: string;
  /** The small hint glyph above each letter. */
  hint: string;
  /** Fill of the `muted` keys — space bar, `?123`. */
  pill: string;
  /** Fill of the enter key. */
  accent: string;
  /** Glyph on the enter key. */
  accentGlyph: string;
  /** Tap feedback wash. */
  press: string;
  /** Fill behind an engaged shift key. */
  active: string;
}

/** Gboard's Material You dark theme, sampled off the reference screenshot. */
export const PHONE_KEYBOARD_DARK: PhoneKeyboardTheme = {
  bg: '#1e1f20',
  glyph: '#e3e3e3',
  hint: '#c4c7c5',
  pill: '#444746',
  accent: '#a8c7fa',
  accentGlyph: '#062e6f',
  press: 'rgba(227, 227, 227, 0.18)',
  active: 'rgba(168, 199, 250, 0.24)',
};

/** The same keyboard in daylight. */
export const PHONE_KEYBOARD_LIGHT: PhoneKeyboardTheme = {
  bg: '#f3f6fc',
  glyph: '#1f1f1f',
  hint: '#5f6368',
  pill: '#dde3ea',
  accent: '#0b57d0',
  accentGlyph: '#ffffff',
  press: 'rgba(11, 87, 208, 0.14)',
  active: 'rgba(11, 87, 208, 0.16)',
};

/* ─── Geometry ────────────────────────────────────────────────────────────── */

/**
 * Every fixed dimension below is the reference screenshot's pixel measurement
 * (Pixel 9, 1080px wide) mapped onto a 390px-wide screen, then scaled by
 * `width / 390`. Keeping them in one table is what makes the mockup hold its
 * proportions at any width.
 */
const M = {
  base: 390,
  toolbar: 45,
  row: 60,
  padBottom: 15,
  navBar: 46,
  letterFont: 27,
  hintFont: 11.5,
  hintDx: 11,
  hintCy: 0.26,
  letterCy: 0.527,
  pill: 34,
  mic: 32,
  toolbarIcon: 18,
  gifFont: 11.5,
  navIcon: 18,
  shiftIcon: 32,
  backspaceIcon: 27,
  enterIcon: 22,
  emojiIcon: 20,
  punctFont: 22,
  pageFont: 15,
  spaceFont: 14,
  pressInset: 3,
  pressRadius: 11,
} as const;

/* ─── Animation options ───────────────────────────────────────────────────── */

export interface PhoneKeyboardTypeOptions {
  /** Characters per second. @default 11 */
  cps?: number;
  /** Random ± fraction applied to every gap, so the rhythm reads as a thumb. @default 0.4 */
  jitter?: number;
  /** Extra pause after `.`, `!`, `?`, `,` and newlines, in ms. @default 240 */
  punctuationPause?: number;
  /** How long each key stays lit, ms. @default 110 */
  flash?: number;
}

export interface PhoneKeyboardDeleteOptions {
  /** How long the key is held before the repeat starts, ms. @default 420 */
  holdDelay?: number;
  /** Interval of the first repeat, ms. @default 115 */
  from?: number;
  /** Interval the repeat accelerates to, ms. @default 26 */
  to?: number;
  /** Repeats over which it accelerates from `from` to `to`. @default 12 */
  ramp?: number;
  /** After this many repeats the hold starts eating whole words, as Gboard does. `Infinity` to keep it character-by-character. @default 18 */
  wordsAfter?: number;
}

export interface PhoneKeyboardReplaceOptions {
  delete?: PhoneKeyboardDeleteOptions;
  type?: PhoneKeyboardTypeOptions;
  /** Pause between the last delete and the first keystroke, ms. @default 220 */
  gap?: number;
}

/** Imperative control of the keyboard — the `ref` of {@link PhoneKeyboard}. */
export interface PhoneKeyboardHandle {
  /** The text currently in the buffer. */
  readonly value: string;
  /** True while an animation is running. */
  readonly busy: boolean;
  /** The keyboard's root element. */
  readonly element: HTMLDivElement | null;
  /**
   * Type `text` one character at a time, lighting up the real key for each —
   * flipping to the `?123` page and tapping shift on the way, like a thumb
   * would. Resolves when the last character lands; cancels any animation
   * already running.
   */
  type: (text: string, options?: PhoneKeyboardTypeOptions) => Promise<void>;
  /**
   * Hold the delete key down: `count` characters (default: the whole buffer),
   * with the accelerating repeat of a real key-repeat, eating whole words once
   * it gets going.
   */
  backspace: (count?: number, options?: PhoneKeyboardDeleteOptions) => Promise<void>;
  /** Hold delete until the field is empty, then type `text` — one gesture. */
  replace: (text: string, options?: PhoneKeyboardReplaceOptions) => Promise<void>;
  /** Press one key: a character (`'a'`, `'!'`) or an action (`'backspace'`, `'enter'`, `'shift'`). */
  press: (key: string) => void;
  /** Jump the buffer to `value` with no animation. */
  setValue: (value: string) => void;
  /** Cancel whatever is running. Pending promises resolve. */
  stop: () => void;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */

export interface PhoneKeyboardProps {
  /** Built-in layout name, or a layout of your own. @default 'azerty' */
  layout?: PhoneKeyboardLayoutName | PhoneKeyboardLayout;
  /** Rendered width in px — every dimension scales off it. @default 390 */
  width?: number;
  /** Colour set: a preset name or your own tokens. @default 'dark' */
  theme?: 'dark' | 'light' | PhoneKeyboardTheme;
  /** Controlled text. Ignored inside a `PhoneKeyboardProvider`, which owns it. */
  value?: string;
  /** Initial text of an uncontrolled keyboard. */
  defaultValue?: string;
  /** Every edit — a tap, a delete, a programmatic `type()`. */
  onValueChange?: (value: string, state: PhoneTextState) => void;
  /** A key was pressed (before the buffer changes). */
  onKeyPress?: (key: PhoneKey) => void;
  /** The enter key. Return `true` to also insert a newline. */
  onEnter?: (value: string) => boolean | void;
  /** The mic button. Rendered as a plain circle when omitted. */
  onMic?: () => void;
  /** Gboard's suggestion/tool strip along the top. @default true */
  toolbar?: boolean | React.ReactNode;
  /** The Android navigation strip under the keys. @default true */
  navBar?: boolean;
  /** Label on the space bar — Gboard shows the enabled languages. @default 'FR • EN' */
  spaceLabel?: string;
  /** Uppercase key labels (as in the reference) or lower-case until shift is on. @default 'upper' */
  labelCase?: 'upper' | 'auto';
  /** Engage shift at the start of a sentence, like Gboard. @default true */
  autoCapitalize?: boolean;
  /** Route the user's *physical* keyboard through the on-screen keys while it has focus. @default false */
  captureKeys?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label for the keyboard region. @default 'On-screen keyboard' */
  'aria-label'?: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

function keyId(page: PhoneKeyboardPage, row: number, index: number) {
  return `${page}:${row}:${index}`;
}

/** Characters a single delete-repeat should eat once the hold is eating words. */
function wordChunk(value: string): number {
  const trimmed = value.replace(/\s+$/, '');
  const cut = trimmed.lastIndexOf(' ');
  const target = cut === -1 ? 0 : cut + 1;
  return Math.max(1, value.length - target);
}

/** Where a page-switch key sits on a page, so the animation can light it up. */
function findAction(rows: PhoneKey[][], action: string): { row: number; index: number } | null {
  for (let row = 0; row < rows.length; row++) {
    const index = rows[row].findIndex((k) => k.action === action);
    if (index !== -1) return { row, index };
  }
  return null;
}

/**
 * The next page on the way from `from` to `to`. `more` is two taps away from the
 * letters (`?123` then `=\<`), so the animation walks it one hop at a time.
 */
function nextPage(from: PhoneKeyboardPage, to: PhoneKeyboardPage): PhoneKeyboardPage {
  if (from === to) return to;
  if (to === 'letters') return 'letters';
  if (to === 'more' && from === 'letters') return 'symbols';
  return to;
}

const PAGE_ACTION: Record<PhoneKeyboardPage, string> = {
  letters: 'letters',
  symbols: 'symbols',
  more: 'more',
};

/* ─── Component ───────────────────────────────────────────────────────────── */

/**
 * A pixel-traced Gboard: the Android on-screen keyboard as a React component,
 * for phone mockups that have to *look* used. Tap the keys and the text lands in
 * the shared buffer a {@link PhoneTextField} renders; drive it through its `ref`
 * and it types character by character, taps shift for capitals, flips to `?123`
 * for symbols, and holds the delete key — accelerating, then eating whole
 * words — before typing the replacement.
 *
 * AZERTY (the reference layout) and QWERTY ship in, each with a `?123` symbols
 * page and a `=\<` second page. Pure inline styles bar two keyframes, so it
 * needs no Tailwind; `keyboard.css` (in `styles.css`) adds the caret blink and
 * the per-character type/delete motion.
 *
 * @summary Gboard-accurate on-screen phone keyboard that types, deletes and
 * replaces text character by character through an imperative ref.
 */
export const PhoneKeyboard = React.forwardRef<PhoneKeyboardHandle, PhoneKeyboardProps>(function PhoneKeyboard(
  {
    layout: layoutProp = 'azerty',
    width = 390,
    theme: themeProp = 'dark',
    value,
    defaultValue = '',
    onValueChange,
    onKeyPress,
    onEnter,
    onMic,
    toolbar = true,
    navBar = true,
    spaceLabel = 'FR • EN',
    labelCase = 'upper',
    autoCapitalize = true,
    captureKeys = false,
    className,
    style,
    'aria-label': ariaLabel = 'On-screen keyboard',
  },
  ref,
) {
  const layout = typeof layoutProp === 'string' ? LAYOUTS[layoutProp] : layoutProp;
  const theme =
    themeProp === 'dark' ? PHONE_KEYBOARD_DARK : themeProp === 'light' ? PHONE_KEYBOARD_LIGHT : themeProp;
  const u = width / M.base;

  // The buffer lives in the provider when there is one, so the screen above the
  // keyboard can render the text; otherwise the keyboard keeps it locally.
  const shared = usePhoneTextStore();
  const local = useLocalPhoneText(value, defaultValue, onValueChange);
  const store: PhoneTextStore = shared ?? local;

  const [page, setPage] = React.useState<PhoneKeyboardPage>('letters');
  const [shift, setShift] = React.useState(false);
  const [pressed, setPressed] = React.useState<ReadonlySet<string>>(() => new Set());
  const [held, setHeld] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const run = React.useRef(0);
  const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>());

  // Latest-value refs: the async animations read these between awaits.
  const valueRef = React.useRef(store.state.value);
  valueRef.current = store.state.value;
  const pageRef = React.useRef(page);
  pageRef.current = page;
  const shiftRef = React.useRef(shift);
  shiftRef.current = shift;
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;
  const notify = React.useRef({ onKeyPress, onEnter, onValueChange });
  notify.current = { onKeyPress, onEnter, onValueChange };

  React.useEffect(
    () => () => {
      run.current++;
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  /** Light a key for `ms`, then let it go. */
  const flash = React.useCallback((id: string, ms = 110) => {
    setPressed((prev) => new Set(prev).add(id));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setPressed((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, ms);
    timers.current.add(timer);
  }, []);

  /* ─── Key handling ──────────────────────────────────────────────────────── */

  /** Shift is engaged, either by the key or by Gboard's start-of-sentence rule. */
  const autoShift = autoCapitalize && /(^|[.!?]\s|\n)$/.test(store.state.value);
  const shiftOn = shift || autoShift;
  const shiftOnRef = React.useRef(shiftOn);
  shiftOnRef.current = shiftOn;

  const runKey = React.useCallback(
    (key: PhoneKey) => {
      notify.current.onKeyPress?.(key);
      switch (key.action) {
        case 'shift':
          setShift((s) => !s);
          return;
        case 'backspace':
          store.edit({ op: 'delete', count: 1 });
          return;
        case 'symbols':
          setPage('symbols');
          return;
        case 'letters':
          setPage('letters');
          return;
        case 'more':
          setPage('more');
          return;
        case 'emoji':
          store.edit({ op: 'insert', chars: '🙂' });
          return;
        case 'enter': {
          const insert = notify.current.onEnter?.(valueRef.current);
          if (insert || notify.current.onEnter === undefined) store.edit({ op: 'insert', chars: '\n' });
          return;
        }
        default:
          break;
      }
      if (key.char === undefined) return;
      const chars = shiftOnRef.current ? key.char.toUpperCase() : key.char.toLowerCase();
      store.edit({ op: 'insert', chars });
      if (shiftRef.current) setShift(false); // shift is a one-shot, as on a phone
    },
    [store],
  );

  const tap = React.useCallback(
    (key: PhoneKey, id: string) => {
      run.current++; // a real tap wins over a running animation
      setBusy(false);
      setHeld(false);
      flash(id);
      runKey(key);
    },
    [flash, runKey],
  );

  /* ─── The animations ────────────────────────────────────────────────────── */

  /** Bail out of an animation loop that has been cancelled or superseded. */
  const alive = (token: number) => run.current === token && rootRef.current !== null;

  const typeText = React.useCallback(
    async (text: string, options: PhoneKeyboardTypeOptions = {}) => {
      const { cps = 11, jitter = 0.4, punctuationPause = 240, flash: flashMs = 110 } = options;
      const token = ++run.current;
      setBusy(true);
      const startPage = pageRef.current;
      const step = 1000 / Math.max(0.5, cps);

      for (const char of [...text]) {
        if (!alive(token)) break;
        const loc = findKey(layoutRef.current, char);

        while (loc && loc.page !== pageRef.current && alive(token)) {
          const hop = nextPage(pageRef.current, loc.page);
          const at = findAction(layoutRef.current[pageRef.current], PAGE_ACTION[hop]);
          if (at) flash(keyId(pageRef.current, at.row, at.index), flashMs);
          setPage(hop);
          pageRef.current = hop;
          await sleep(step * 0.7);
        }
        if (!alive(token)) break;

        if (loc?.shift && !shiftRef.current) {
          const at = findAction(layoutRef.current[pageRef.current], 'shift');
          if (at) flash(keyId(pageRef.current, at.row, at.index), flashMs + 60);
          setShift(true);
          shiftRef.current = true;
          await sleep(step * 0.5);
          if (!alive(token)) break;
        }

        if (loc) flash(keyId(loc.page, loc.row, loc.index), flashMs);
        store.edit({ op: 'insert', chars: char });
        valueRef.current += char;
        if (shiftRef.current) {
          setShift(false);
          shiftRef.current = false;
        }

        const wobble = 1 + (Math.random() * 2 - 1) * jitter;
        const pause = /[.!?,\n]/.test(char) ? punctuationPause : 0;
        await sleep(step * wobble + pause);
      }

      if (alive(token) && pageRef.current !== startPage) {
        setPage(startPage);
        pageRef.current = startPage;
      }
      if (alive(token)) setBusy(false);
    },
    [flash, store],
  );

  const backspace = React.useCallback(
    async (count?: number, options: PhoneKeyboardDeleteOptions = {}) => {
      const { holdDelay = 420, from = 115, to = 26, ramp = 12, wordsAfter = 18 } = options;
      const token = ++run.current;
      const total = count ?? valueRef.current.length;
      if (total <= 0 || valueRef.current.length === 0) return;

      const at = findAction(layoutRef.current[pageRef.current], 'backspace');
      const id = at ? keyId(pageRef.current, at.row, at.index) : null;

      setBusy(true);
      let done = 0;
      const eat = (n: number) => {
        const chunk = Math.min(n, valueRef.current.length, total - done);
        if (chunk <= 0) return false;
        store.edit({ op: 'delete', count: chunk });
        valueRef.current = valueRef.current.slice(0, valueRef.current.length - chunk);
        done += chunk;
        return true;
      };

      if (id) flash(id, total > 1 ? holdDelay : 110);
      eat(1);

      if (total > 1) {
        setHeld(true);
        await sleep(holdDelay);
        let repeat = 0;
        while (alive(token) && done < total && valueRef.current.length > 0) {
          const t = ramp <= 0 ? 1 : Math.min(1, repeat / ramp);
          const words = repeat >= wordsAfter;
          if (!eat(words ? wordChunk(valueRef.current) : 1)) break;
          repeat++;
          await sleep(from + (to - from) * t);
        }
        setHeld(false);
      }
      if (alive(token)) setBusy(false);
    },
    [flash, store],
  );

  const replace = React.useCallback(
    async (text: string, options: PhoneKeyboardReplaceOptions = {}) => {
      const token = run.current + 1;
      await backspace(undefined, options.delete);
      if (run.current !== token) return; // superseded mid-delete
      await sleep(options.gap ?? 220);
      if (run.current !== token) return;
      await typeText(text, options.type);
    },
    [backspace, typeText],
  );

  /* ─── Imperative handle ─────────────────────────────────────────────────── */

  const busyRef = React.useRef(busy);
  busyRef.current = busy;

  React.useImperativeHandle(
    ref,
    (): PhoneKeyboardHandle => ({
      get value() {
        return valueRef.current;
      },
      get busy() {
        return busyRef.current;
      },
      get element() {
        return rootRef.current;
      },
      type: typeText,
      backspace,
      replace,
      press: (key: string) => {
        const rows = layoutRef.current[pageRef.current];
        for (let row = 0; row < rows.length; row++) {
          for (let index = 0; index < rows[row].length; index++) {
            const candidate = rows[row][index];
            const matches =
              candidate.action === key ||
              candidate.char === key ||
              (candidate.char !== undefined && candidate.char.toLowerCase() === key.toLowerCase());
            if (matches) {
              tap(candidate, keyId(pageRef.current, row, index));
              return;
            }
          }
        }
        if (key.length === 1) runKey({ char: key }); // not on this page: insert it anyway
      },
      setValue: (next: string) => {
        run.current++;
        setBusy(false);
        setHeld(false);
        valueRef.current = next;
        store.edit({ op: 'set', value: next });
      },
      stop: () => {
        run.current++;
        setBusy(false);
        setHeld(false);
      },
    }),
    [typeText, backspace, replace, tap, runKey, store],
  );

  /* ─── Rendering ─────────────────────────────────────────────────────────── */

  const rows = layout[page];
  const keysHeight = rows.length * M.row * u;
  const px = (n: number) => n * u;

  const onPhysicalKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!captureKeys || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      const rows_ = layoutRef.current[pageRef.current];
      const at = findAction(rows_, 'backspace');
      if (at) tap(rows_[at.row][at.index], keyId(pageRef.current, at.row, at.index));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const rows_ = layoutRef.current[pageRef.current];
      const at = findAction(rows_, 'enter');
      if (at) tap(rows_[at.row][at.index], keyId(pageRef.current, at.row, at.index));
      return;
    }
    if ([...e.key].length === 1) {
      e.preventDefault();
      run.current++;
      const loc = findKey(layoutRef.current, e.key);
      if (loc) {
        if (loc.page !== pageRef.current) setPage(loc.page);
        flash(keyId(loc.page, loc.row, loc.index));
      }
      store.edit({ op: 'insert', chars: e.key });
    }
  };

  return (
    <div
      ref={rootRef}
      className={className}
      role="group"
      aria-label={ariaLabel}
      tabIndex={captureKeys ? 0 : undefined}
      onKeyDown={captureKeys ? onPhysicalKey : undefined}
      style={{
        width,
        flex: 'none',
        background: theme.bg,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        outline: 'none',
        ...style,
      }}
    >
      {toolbar !== false && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: px(M.toolbar),
            padding: `0 ${px(6)}px 0 ${px(16)}px`,
            color: theme.glyph,
          }}
        >
          {toolbar === true ? (
            <>
              <LayoutGrid size={px(M.toolbarIcon)} strokeWidth={2.2} aria-hidden />
              <span
                aria-hidden
                style={{
                  fontSize: px(M.gifFont),
                  fontWeight: 700,
                  letterSpacing: px(-0.2),
                  // the wordmark is markedly dimmer than the icons beside it
                  color: theme.hint,
                  opacity: 0.56,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                GIF
              </span>
              <ClipboardList size={px(M.toolbarIcon)} strokeWidth={2.2} aria-hidden />
              <Settings size={px(M.toolbarIcon)} strokeWidth={2.2} aria-hidden />
              <button
                type="button"
                onClick={onMic}
                aria-label="Voice input"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: px(M.mic),
                  height: px(M.mic),
                  borderRadius: 999,
                  border: 0,
                  padding: 0,
                  background: theme.glyph,
                  color: theme.bg,
                  cursor: onMic ? 'pointer' : 'default',
                }}
              >
                <Mic size={px(M.toolbarIcon)} strokeWidth={2.2} aria-hidden />
              </button>
            </>
          ) : (
            toolbar
          )}
        </div>
      )}

      <div style={{ height: keysHeight }}>
        {rows.map((row, r) => {
          const units = rowUnits(row);
          return (
            <div key={r} style={{ display: 'flex', height: px(M.row), padding: `0 ${px(1.7)}px` }}>
              {row.map((key, i) => {
                if (key.spacer)
                  return <span key={i} aria-hidden style={{ flex: `${(key.width ?? 1) / units} 0 0` }} />;
                const id = keyId(page, r, i);
                const isHeldKey = held && key.action === 'backspace';
                const isPressed = pressed.has(id) || isHeldKey;
                // Only a *deliberate* shift gets a pill; the auto-capital at the
                // start of a sentence just fills the arrow, as Gboard does.
                const engaged = (key.action === 'shift' && shift) || isHeldKey;
                const fill =
                  key.fill === 'accent'
                    ? theme.accent
                    : key.fill === 'muted'
                      ? theme.pill
                      : engaged
                        ? theme.active
                        : 'transparent';
                const glyph = key.fill === 'accent' ? theme.accentGlyph : theme.glyph;

                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={key.aria ?? key.label ?? key.char}
                    aria-pressed={key.action === 'shift' ? shiftOn : undefined}
                    onPointerDown={(e) => {
                      e.preventDefault(); // keep focus, no 300ms tap delay
                      tap(key, id);
                    }}
                    onClick={(e) => e.preventDefault()}
                    style={{
                      position: 'relative',
                      flex: `${(key.width ?? 1) / units} 0 0`,
                      height: '100%',
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      color: glyph,
                      font: 'inherit',
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {/* the key's own pill (space bar, ?123, enter) */}
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: px(M.pressInset),
                        right: px(M.pressInset),
                        top: `calc(50% - ${px(M.pill / 2)}px)`,
                        height: px(M.pill),
                        borderRadius: 999,
                        background: fill,
                        transition: 'background 120ms ease',
                      }}
                    />
                    {/* tap feedback */}
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: px(M.pressInset),
                        borderRadius: px(M.pressRadius),
                        background: theme.press,
                        opacity: isPressed ? 1 : 0,
                        transform: isPressed ? 'scale(1)' : 'scale(0.86)',
                        transition: isPressed ? 'opacity 40ms linear' : 'opacity 160ms ease, transform 160ms ease',
                      }}
                    />
                    <KeyFace
                      keySpec={key}
                      u={u}
                      theme={theme}
                      shiftOn={shiftOn}
                      labelCase={labelCase}
                      spaceLabel={spaceLabel}
                    />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ height: px(M.padBottom) }} />

      {navBar && (
        <div
          aria-hidden
          style={{
            position: 'relative',
            height: px(M.navBar),
            color: theme.glyph,
          }}
        >
          {[
            { left: '25%', node: <Triangle size={px(M.navIcon)} /> },
            { left: '50%', node: <Dot size={px(M.navIcon)} /> },
            { left: '75%', node: <Squarish size={px(M.navIcon)} /> },
            { left: '87.4%', node: <Globe size={px(M.navIcon - 0.5)} strokeWidth={2} /> },
          ].map(({ left, node }, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {node}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

/* ─── Key faces ───────────────────────────────────────────────────────────── */

function KeyFace({
  keySpec,
  u,
  theme,
  shiftOn,
  labelCase,
  spaceLabel,
}: {
  keySpec: PhoneKey;
  u: number;
  theme: PhoneKeyboardTheme;
  shiftOn: boolean;
  labelCase: 'upper' | 'auto';
  spaceLabel: string;
}) {
  const px = (n: number) => n * u;
  const centred: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1,
  };

  if (keySpec.icon === 'shift') {
    return (
      <span aria-hidden style={centred}>
        <ArrowBigUp
          size={px(M.shiftIcon)}
          fill={shiftOn ? 'currentColor' : 'none'}
          strokeWidth={shiftOn ? 1 : 1.8}
        />
      </span>
    );
  }
  if (keySpec.icon === 'backspace') {
    return (
      <span aria-hidden style={centred}>
        <Delete size={px(M.backspaceIcon)} strokeWidth={1.7} />
      </span>
    );
  }
  if (keySpec.icon === 'enter') {
    return (
      <span aria-hidden style={centred}>
        <CornerDownLeft size={px(M.enterIcon)} strokeWidth={2.4} />
      </span>
    );
  }
  if (keySpec.icon === 'emoji') {
    return (
      <span aria-hidden style={centred}>
        <Smile size={px(M.emojiIcon)} strokeWidth={1.9} />
      </span>
    );
  }
  if (keySpec.action === 'space') {
    return (
      <span
        aria-hidden
        style={{
          ...centred,
          fontSize: px(M.spaceFont),
          fontWeight: 500,
          letterSpacing: px(-0.2),
          color: theme.glyph,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {spaceLabel}
      </span>
    );
  }

  const raw = keySpec.label ?? keySpec.char ?? '';
  const isLetter = keySpec.char !== undefined && /^\p{L}$/u.test(keySpec.char);
  const label = !isLetter
    ? raw
    : labelCase === 'upper' || shiftOn
      ? raw.toUpperCase()
      : raw.toLowerCase();
  const big = keySpec.label !== undefined && keySpec.char === undefined; // ?123 / ABC / =\<
  const fontSize = big ? px(M.pageFont) : isLetter ? px(M.letterFont) : px(M.punctFont);

  return (
    <>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${M.letterCy * 100}%`,
          transform: 'translateY(-50%)',
          fontSize,
          fontWeight: big ? 500 : 400,
          lineHeight: 1,
          fontFamily: 'system-ui, "Roboto", sans-serif',
        }}
      >
        {label}
      </span>
      {keySpec.hint && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: `calc(50% + ${px(M.hintDx)}px)`,
            top: `${M.hintCy * 100}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: px(M.hintFont),
            lineHeight: 1,
            color: theme.hint,
            fontFamily: 'system-ui, "Roboto", sans-serif',
          }}
        >
          {keySpec.hint}
        </span>
      )}
    </>
  );
}

/*
 * The three nav-bar glyphs Android draws while a keyboard is up — hide-keyboard,
 * home, recents. Each shape fills its viewBox so `size` is the glyph's real
 * width, matching the 45px the reference screenshot gives them.
 */
const Triangle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M1 2h22L12 22z" />
  </svg>
);
const Dot = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="12" r="10" />
  </svg>
);
const Squarish = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
  </svg>
);

/**
 * Height a {@link PhoneKeyboard} takes at a given width — for reserving room
 * above it without measuring the DOM.
 */
export function phoneKeyboardHeight(
  width: number,
  { toolbar = true, navBar = true, rows = 4 }: { toolbar?: boolean; navBar?: boolean; rows?: number } = {},
): number {
  const u = width / M.base;
  return u * ((toolbar ? M.toolbar : 0) + rows * M.row + M.padBottom + (navBar ? M.navBar : 0));
}
