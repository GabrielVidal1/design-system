/*
 * Key layouts for <PhoneKeyboard>.
 *
 * Traced off a real Gboard screenshot (Pixel 9, 1080px wide): 10 columns of
 * 107px, the shift / backspace / ?123 / enter keys 1.54 columns wide, the space
 * bar 4. Every geometry number in phone-keyboard.tsx is that measurement scaled
 * off a 390px screen-width baseline.
 */

/** What pressing a non-character key does. */
export type PhoneKeyAction =
  | 'shift'
  | 'backspace'
  | 'enter'
  | 'space'
  | 'symbols'
  | 'letters'
  | 'more'
  | 'emoji';

export interface PhoneKey {
  /** Text inserted when the key is pressed. Omitted for action keys. */
  char?: string;
  /** Main glyph. Defaults to `char`; ignored when `icon` is set. */
  label?: string;
  /** Built-in icon to draw instead of a label. */
  icon?: 'shift' | 'backspace' | 'enter' | 'emoji';
  /** Small secondary glyph printed above and right of the label (Gboard's long-press hint). */
  hint?: string;
  /** Width in key units — 1 is a letter key. @default 1 */
  width?: number;
  /** Action keys: what it does instead of inserting `char`. */
  action?: PhoneKeyAction;
  /** Filled background: `muted` for ?123 / space, `accent` for enter. */
  fill?: 'muted' | 'accent';
  /** Accessible name, when the label alone would not read well. */
  aria?: string;
  /** Dead space, not a key — how QWERTY's 9-key middle row stays on the 10-column grid. */
  spacer?: true;
}

export type PhoneKeyRow = PhoneKey[];

export interface PhoneKeyboardLayout {
  /** Letter pages: `pages.letters` is shown first, `?123` flips to `symbols`. */
  letters: PhoneKeyRow[];
  symbols: PhoneKeyRow[];
  more: PhoneKeyRow[];
}

const SHIFT: PhoneKey = { action: 'shift', icon: 'shift', width: 1.54, aria: 'Shift' };
const BACKSPACE: PhoneKey = { action: 'backspace', icon: 'backspace', width: 1.54, aria: 'Backspace' };
const ENTER: PhoneKey = { action: 'enter', icon: 'enter', width: 1.54, fill: 'accent', aria: 'Enter' };
const EMOJI: PhoneKey = { action: 'emoji', icon: 'emoji', aria: 'Emoji' };
const SPACE: PhoneKey = { action: 'space', char: ' ', width: 4, fill: 'muted', aria: 'Space' };
const TO_SYMBOLS: PhoneKey = { action: 'symbols', label: '?123', width: 1.54, fill: 'muted' };
const TO_LETTERS: PhoneKey = { action: 'letters', label: 'ABC', width: 1.54, fill: 'muted' };
const TO_MORE: PhoneKey = { action: 'more', label: '=\\<', width: 1.54, fill: 'muted' };

/** `A1 Z2 E3 …` — one row of letters paired with the hints printed above them. */
function letterRow(letters: string, hints = ''): PhoneKeyRow {
  return [...letters].map((char, i) => ({ char, hint: hints[i] || undefined }));
}

/** The bottom row is the same on every page bar its page-switch key. */
function bottomRow(first: PhoneKey): PhoneKeyRow {
  return [first, { char: ',' }, EMOJI, SPACE, { char: '.' }, ENTER];
}

const SYMBOL_PAGES = {
  symbols: [
    letterRow('1234567890'),
    [
      { char: '@' },
      { char: '#' },
      { char: '€' },
      { char: '_' },
      { char: '&' },
      { char: '-' },
      { char: '+' },
      { char: '(' },
      { char: ')' },
      { char: '/' },
    ],
    [TO_MORE, { char: '*' }, { char: '"' }, { char: "'" }, { char: ':' }, { char: ';' }, { char: '!' }, { char: '?' }, BACKSPACE],
    bottomRow(TO_LETTERS),
  ] as PhoneKeyRow[],
  more: [
    [
      { char: '~' },
      { char: '`' },
      { char: '|' },
      { char: '•' },
      { char: '√' },
      { char: 'π' },
      { char: '÷' },
      { char: '×' },
      { char: '¶' },
      { char: '∆' },
    ],
    [
      { char: '£' },
      { char: '¢' },
      { char: '$' },
      { char: '¥' },
      { char: '^' },
      { char: '°' },
      { char: '=' },
      { char: '{' },
      { char: '}' },
      { char: '\\' },
    ],
    [
      { action: 'symbols', label: '?123', width: 1.54, fill: 'muted' },
      { char: '%' },
      { char: '©' },
      { char: '®' },
      { char: '™' },
      { char: '✓' },
      { char: '[' },
      { char: ']' },
      BACKSPACE,
    ],
    bottomRow(TO_LETTERS),
  ] as PhoneKeyRow[],
};

/** French AZERTY — the layout the reference screenshot was taken on. */
export const AZERTY: PhoneKeyboardLayout = {
  letters: [
    letterRow('AZERTYUIOP', '1234567890'),
    letterRow('QSDFGHJKLM', '@#€_&-+()/'),
    [SHIFT, ...letterRow('WXCVBN', '*"\':;!'), { char: "'" }, BACKSPACE],
    bottomRow(TO_SYMBOLS),
  ],
  ...SYMBOL_PAGES,
};

const HALF_GAP: PhoneKey = { spacer: true, width: 0.5 };

/** US QWERTY. */
export const QWERTY: PhoneKeyboardLayout = {
  letters: [
    letterRow('QWERTYUIOP', '1234567890'),
    [HALF_GAP, ...letterRow('ASDFGHJKL', '@#€_&-+()'), HALF_GAP],
    [SHIFT, ...letterRow('ZXCVBNM', '*"\':;!?'), BACKSPACE],
    bottomRow(TO_SYMBOLS),
  ],
  ...SYMBOL_PAGES,
};

export const LAYOUTS = { azerty: AZERTY, qwerty: QWERTY } as const;

/** Name of a built-in layout. */
export type PhoneKeyboardLayoutName = keyof typeof LAYOUTS;

export type PhoneKeyboardPage = keyof PhoneKeyboardLayout;

/** Total width of a row, in key units — rows are laid out proportionally. */
export function rowUnits(row: PhoneKeyRow): number {
  return row.reduce((sum, key) => sum + (key.width ?? 1), 0);
}

/**
 * Where a character lives in a layout: which page, row and index, and whether
 * shift has to be held for it. Used by the typing animation to light up the
 * real key (and flip to the symbols page) for each character it inserts.
 */
export interface KeyLocation {
  page: PhoneKeyboardPage;
  row: number;
  index: number;
  /** The character needs shift (an uppercase letter whose key label is lower). */
  shift: boolean;
}

export function findKey(layout: PhoneKeyboardLayout, char: string): KeyLocation | null {
  const pages: PhoneKeyboardPage[] = ['letters', 'symbols', 'more'];
  const lower = char.toLowerCase();
  // Layout labels are written upper-case, so the *character* decides whether a
  // thumb would have to reach for shift — not how the key is printed.
  const shift = char !== lower;
  for (const page of pages) {
    const rows = layout[page];
    for (let row = 0; row < rows.length; row++) {
      for (let index = 0; index < rows[row].length; index++) {
        const key = rows[row][index];
        if (key.char === undefined || key.spacer) continue;
        if (key.char === char || key.char.toLowerCase() === lower) return { page, row, index, shift };
      }
    }
  }
  return null;
}
