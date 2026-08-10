import * as React from 'react';

/**
 * The text a {@link PhoneKeyboard} is editing, plus enough about the last edit
 * for a field to animate it: which characters moved, in which direction, and a
 * monotonic id so a re-inserted character still restarts its animation.
 */
export interface PhoneTextState {
  /** The full text. */
  value: string;
  /** Selection/caret position — always the end of `value` (this is a mockup keyboard). */
  caret: number;
  /** What the last edit did. `'set'` for a programmatic jump with no animation. */
  op: 'insert' | 'delete' | 'set';
  /** The characters that last edit added or removed. */
  chars: string;
  /** Monotonic edit counter — a stable React key for the animation of `chars`. */
  editId: number;
}

export const EMPTY_TEXT: PhoneTextState = { value: '', caret: 0, op: 'set', chars: '', editId: 0 };

export type PhoneTextEdit =
  | { op: 'insert'; chars: string }
  | { op: 'delete'; count: number }
  | { op: 'set'; value: string };

export function applyEdit(state: PhoneTextState, edit: PhoneTextEdit): PhoneTextState {
  const editId = state.editId + 1;
  if (edit.op === 'insert') {
    const value = state.value + edit.chars;
    return { value, caret: value.length, op: 'insert', chars: edit.chars, editId };
  }
  if (edit.op === 'delete') {
    const count = Math.min(Math.max(0, edit.count), state.value.length);
    if (count === 0) return state;
    const value = state.value.slice(0, state.value.length - count);
    return { value, caret: value.length, op: 'delete', chars: state.value.slice(value.length), editId };
  }
  return { value: edit.value, caret: edit.value.length, op: 'set', chars: '', editId };
}

export interface PhoneTextStore {
  state: PhoneTextState;
  edit: (edit: PhoneTextEdit) => void;
}

const PhoneTextContext = React.createContext<PhoneTextStore | null>(null);

/** The buffer state, when inside a {@link PhoneKeyboardProvider}. */
export function usePhoneTextStore(): PhoneTextStore | null {
  return React.useContext(PhoneTextContext);
}

/**
 * The text of the nearest {@link PhoneKeyboardProvider} — what a
 * {@link PhoneTextField} (or any custom screen) renders. Throws outside a
 * provider, so a screen that needs the text says so loudly.
 *
 * @summary Read the text being typed by the enclosing PhoneKeyboard.
 */
export function usePhoneText(): PhoneTextState {
  const store = usePhoneTextContext('usePhoneText');
  return store.state;
}

export function usePhoneTextContext(who: string): PhoneTextStore {
  const store = React.useContext(PhoneTextContext);
  if (!store) throw new Error(`${who} must be used inside a <PhoneKeyboardProvider> (or <PhonePreview keyboard>)`);
  return store;
}

export interface PhoneKeyboardProviderProps {
  children?: React.ReactNode;
  /** Controlled text. Omit for an uncontrolled buffer. */
  value?: string;
  /** Initial text of an uncontrolled buffer. */
  defaultValue?: string;
  /** Fires on every edit — a keypress, a delete, a programmatic `type()`. */
  onValueChange?: (value: string, state: PhoneTextState) => void;
}

/**
 * Holds the text a {@link PhoneKeyboard} types so siblings *above* the keyboard
 * (the screen, a composer bubble, a {@link PhoneTextField}) can render it. A
 * standalone `<PhoneKeyboard>` creates one implicitly; `<PhonePreview keyboard>`
 * wraps the whole screen in one.
 *
 * @summary Shares one text buffer between a PhoneKeyboard and the screen above it.
 */
export function PhoneKeyboardProvider({ children, value, defaultValue = '', onValueChange }: PhoneKeyboardProviderProps) {
  const [uncontrolled, setUncontrolled] = React.useState<PhoneTextState>(() => ({
    ...EMPTY_TEXT,
    value: defaultValue,
    caret: defaultValue.length,
  }));

  // A controlled `value` wins, but keeps the edit metadata of the local state so
  // animations still run when the parent echoes the change back.
  const state = React.useMemo<PhoneTextState>(
    () => (value === undefined ? uncontrolled : { ...uncontrolled, value, caret: value.length }),
    [value, uncontrolled],
  );

  const changed = React.useRef(onValueChange);
  changed.current = onValueChange;

  const edit = React.useCallback((next: PhoneTextEdit) => {
    setUncontrolled((prev) => {
      const applied = applyEdit(prev, next);
      if (applied !== prev) changed.current?.(applied.value, applied);
      return applied;
    });
  }, []);

  const store = React.useMemo<PhoneTextStore>(() => ({ state, edit }), [state, edit]);
  return <PhoneTextContext.Provider value={store}>{children}</PhoneTextContext.Provider>;
}

/**
 * Buffer for a `<PhoneKeyboard>` that is *not* wrapped in a provider: same
 * store, kept locally so the keyboard works on its own.
 */
export function useLocalPhoneText(
  value: string | undefined,
  defaultValue: string,
  onValueChange: ((value: string, state: PhoneTextState) => void) | undefined,
): PhoneTextStore {
  const [state, setState] = React.useState<PhoneTextState>(() => ({
    ...EMPTY_TEXT,
    value: defaultValue,
    caret: defaultValue.length,
  }));

  const changed = React.useRef(onValueChange);
  changed.current = onValueChange;

  const edit = React.useCallback((next: PhoneTextEdit) => {
    setState((prev) => {
      const applied = applyEdit(prev, next);
      if (applied !== prev) changed.current?.(applied.value, applied);
      return applied;
    });
  }, []);

  const merged = React.useMemo<PhoneTextState>(
    () => (value === undefined ? state : { ...state, value, caret: value.length }),
    [value, state],
  );

  return React.useMemo(() => ({ state: merged, edit }), [merged, edit]);
}
