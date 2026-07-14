import * as React from 'react';
import { Highlight } from 'prism-react-renderer';

import { cn } from '../../lib/utils';
import { codeTheme } from './prism-theme';
import './prism-langs';

/**
 * Both layers (the highlighted <pre> behind and the transparent <textarea> on
 * top) must produce pixel-identical text layout, so they share one class
 * string. Anything that affects glyph metrics belongs here and nowhere else.
 */
const TEXT_METRICS =
  'font-mono text-[13px] leading-[1.6] tracking-normal [tab-size:2]';

export interface CodeAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange?: (value: string) => void;
  /** Prism language id (see `detectLanguage`). Default `'plain'`. */
  language?: string;
  /** Render the line-number gutter. Default `true`. */
  lineNumbers?: boolean;
  /** Soft-wrap long lines instead of scrolling horizontally. Default `false`. */
  wordWrap?: boolean;
  /** Skip highlighting (still monospace + gutter). */
  plain?: boolean;
  textareaClassName?: string;
}

/**
 * CodeArea — a syntax-highlighted textarea.
 *
 * A prism-highlighted `<pre>` renders behind a transparent-text `<textarea>`
 * overlaid exactly on top: editing keeps native textarea behaviour (IME,
 * undo, selection, autofill of nothing) while the eye sees highlighted code.
 * The gutter lives in the pre as out-of-flow spans, so it never disturbs the
 * text layout the two layers must agree on. The ref points at the textarea.
 */
export const CodeArea = React.forwardRef<HTMLTextAreaElement, CodeAreaProps>(
  function CodeArea(
    {
      value,
      onValueChange,
      language = 'plain',
      lineNumbers = true,
      wordWrap = false,
      plain = false,
      readOnly,
      className,
      textareaClassName,
      onKeyDown,
      style,
      ...rest
    },
    ref,
  ) {
    const lineCount = React.useMemo(() => value.split('\n').length, [value]);
    // Gutter width in ch, from the widest line number (min 2 digits).
    const gutterCh = Math.max(2, String(lineCount).length);
    const gutterPad = lineNumbers ? `calc(${gutterCh}ch + 1.25rem)` : undefined;

    // A trailing newline collapses in the <pre> but adds a row to the
    // textarea; pad the highlighted copy so both layers have equal height.
    const highlighted = value.endsWith('\n') || value === '' ? `${value} ` : value;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented || readOnly) return;
      // Tab indents instead of leaving the editor; Escape restores tabbing.
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const el = e.currentTarget;
        // execCommand keeps the native undo stack alive where supported.
        const inserted =
          typeof document !== 'undefined' &&
          typeof document.execCommand === 'function' &&
          document.execCommand('insertText', false, '  ');
        if (!inserted) {
          const { selectionStart: s, selectionEnd: end } = el;
          const next = `${el.value.slice(0, s)}  ${el.value.slice(end)}`;
          onValueChange?.(next);
          requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
        }
      }
    };

    const wrapClasses = wordWrap
      ? 'whitespace-pre-wrap break-words'
      : 'whitespace-pre';

    return (
      <div
        className={cn('relative overflow-auto', className)}
        style={style}
        data-language={language}
      >
        {/* Sized by the pre; the textarea stretches to match. */}
        <div className={cn('relative min-h-full min-w-full', !wordWrap && 'w-max')}>
          <Highlight code={highlighted} language={plain ? 'plain' : language} theme={codeTheme}>
            {({ tokens, getLineProps, getTokenProps }) => (
              <pre
                aria-hidden="true"
                className={cn(TEXT_METRICS, wrapClasses, 'pointer-events-none select-none px-3 py-2.5')}
                style={{ paddingLeft: gutterPad }}
              >
                {tokens.map((line, i) => {
                  const lineProps = getLineProps({ line });
                  return (
                    <div key={i} {...lineProps} className={cn(lineProps.className, 'relative')}>
                      {lineNumbers && (
                        // Out of flow, so it can't shift the code text the
                        // textarea overlay has to line up with.
                        <span
                          className="absolute top-0 select-none text-right text-[var(--code-gutter,#a8a29e)]"
                          style={{ left: `calc(-1.25rem - ${gutterCh}ch)`, width: `${gutterCh}ch` }}
                        >
                          {i + 1}
                        </span>
                      )}
                      {line.map((token, j) => (
                        <span key={j} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  );
                })}
              </pre>
            )}
          </Highlight>
          <textarea
            ref={ref}
            value={value}
            readOnly={readOnly}
            onChange={(e) => onValueChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={cn(
              TEXT_METRICS,
              wrapClasses,
              'absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent px-3 py-2.5',
              'text-transparent caret-[var(--foreground,#1c1917)] outline-none',
              'selection:bg-[var(--code-selection,rgba(120,113,108,0.25))] selection:text-transparent',
              textareaClassName,
            )}
            style={{ paddingLeft: gutterPad }}
            {...rest}
          />
        </div>
      </div>
    );
  },
);
