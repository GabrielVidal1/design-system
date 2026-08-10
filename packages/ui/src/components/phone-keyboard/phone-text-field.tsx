import * as React from 'react';

import { EMPTY_TEXT, applyEdit, usePhoneTextStore, type PhoneTextState } from './text-buffer';

export interface PhoneTextFieldProps {
  /** Text to show. Defaults to the enclosing keyboard's buffer. */
  value?: string;
  /** Shown when the field is empty. */
  placeholder?: string;
  /** Blinking caret after the text. @default true */
  caret?: boolean;
  /** Trailing content inside the field — a send button, a counter. */
  children?: React.ReactNode;
  /** Small label above the field. */
  label?: string;
  /** Minimum height in px (the field grows with the text). @default 44 */
  minHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Diff a plain `value` prop into the same edit metadata the provider tracks, so
 * a standalone field animates its characters too.
 */
function useDerivedState(value: string): PhoneTextState {
  const previous = React.useRef(value);
  const state = React.useRef<PhoneTextState>({ ...EMPTY_TEXT, value, caret: value.length });
  if (previous.current !== value) {
    const before = previous.current;
    previous.current = value;
    if (value.startsWith(before)) {
      state.current = applyEdit(state.current, { op: 'insert', chars: value.slice(before.length) });
    } else if (before.startsWith(value)) {
      state.current = applyEdit(state.current, { op: 'delete', count: before.length - value.length });
    } else {
      state.current = applyEdit(state.current, { op: 'set', value });
    }
  }
  return state.current;
}

/**
 * The composer field a {@link PhoneKeyboard} types into: the text, a blinking
 * caret, and the per-character motion that sells it — each new character pops in
 * as its key lights up, and each deleted one is eaten backwards at the caret
 * while the delete key is held.
 *
 * Inside a `PhoneKeyboardProvider` (or `<PhonePreview keyboard>`) it needs no
 * props at all; pass `value` to drive it from your own state instead.
 *
 * @summary Phone composer field whose characters pop in and get eaten as the
 * on-screen keyboard types and deletes.
 */
export function PhoneTextField({
  value,
  placeholder = 'Message',
  caret = true,
  children,
  label,
  minHeight = 44,
  className,
  style,
}: PhoneTextFieldProps) {
  const store = usePhoneTextStore();
  const derived = useDerivedState(value ?? '');
  const state = value !== undefined ? derived : (store?.state ?? EMPTY_TEXT);

  // The character(s) just deleted linger for one animation, shrinking away at
  // the caret — the visible half of a held delete key.
  const [ghost, setGhost] = React.useState<{ id: number; chars: string } | null>(null);
  React.useEffect(() => {
    if (state.op !== 'delete' || !state.chars) return;
    setGhost({ id: state.editId, chars: state.chars });
    const timer = setTimeout(() => setGhost(null), 220);
    return () => clearTimeout(timer);
  }, [state.editId, state.op, state.chars]);

  const typed = state.op === 'insert' && state.chars ? state.chars : '';
  const head = typed ? state.value.slice(0, state.value.length - typed.length) : state.value;
  const empty = state.value.length === 0;

  return (
    <div className={className} style={style}>
      {label && (
        <div
          style={{
            marginBottom: 6,
            fontSize: 11,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'var(--muted-foreground, #78716c)',
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          minHeight,
          padding: '10px 14px',
          borderRadius: 22,
          border: '1px solid var(--border, rgba(120,113,108,0.35))',
          background: 'var(--card, transparent)',
          color: 'var(--foreground, #0c0a09)',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {empty && !ghost ? (
            <span style={{ color: 'var(--muted-foreground, #78716c)' }}>{placeholder}</span>
          ) : (
            <>
              {head}
              {typed && (
                <span key={state.editId} className="ds-phone-typed">
                  {typed}
                </span>
              )}
            </>
          )}
          {caret && (
            <span
              className="ds-phone-caret"
              style={{
                display: 'inline-block',
                width: 2,
                height: '1.05em',
                marginBottom: '-0.18em',
                background: 'var(--primary, #2563eb)',
                verticalAlign: 'baseline',
              }}
            />
          )}
          {ghost && (
            <span key={ghost.id} className="ds-phone-eaten">
              {ghost.chars}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
