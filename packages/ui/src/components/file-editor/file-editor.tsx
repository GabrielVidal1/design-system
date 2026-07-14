import * as React from 'react';
import { Copy, Download, Eye, FileText, MousePointer2, Pencil, RotateCcw, Save } from 'lucide-react';

import { cn } from '../../lib/utils';
import { downloadFile } from '../../lib/format';
import { Button } from '../button';
import { CodeArea } from './code-area';
import { detectLanguage, isHtmlLanguage, isMarkdownLanguage } from './language';
import { Markdown } from './markdown';
import { MenuBar, type FileEditorMenu } from './menu-bar';

export type FileEditorMode = 'edit' | 'preview';

export interface FileEditorProps {
  /** Controlled content. Pair with `onChange`. */
  value?: string;
  /** Initial content when uncontrolled. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /**
   * Submit/save the current content. Wired to the Save button, ⌘S/Ctrl+S,
   * File → Save — and, with `submitOnBlur`, to focus leaving the editor.
   */
  onSubmit?: (value: string) => void;
  /** Submit a dirty buffer when focus leaves the editor. Default `true`. */
  submitOnBlur?: boolean;
  /** Adds File → Revert (and re-marks the buffer clean). */
  onRevert?: () => void;
  /** Display name; falls back to the last segment of `path`. */
  name?: string;
  /** Shown under the name; also drives language detection. */
  path?: string;
  /** Prism language id override (`'bash'`, `'typescript'`, `'markdown'`, …). */
  language?: string;
  readOnly?: boolean;
  /**
   * Unsaved-changes flag. When the consumer owns draft state (a store), pass
   * it; otherwise the editor tracks it against the last submitted content.
   */
  dirty?: boolean;
  /** Show the Save button as busy. */
  submitting?: boolean;
  /** Extra dropdown menus appended after the built-in File and Tools. */
  menus?: FileEditorMenu[];
  /** Initial gutter state — toggleable via Tools. Default `true`. */
  lineNumbers?: boolean;
  /** Initial soft-wrap state — toggleable via Tools. Default `false`. */
  wordWrap?: boolean;
  /**
   * Preview tab: `'auto'` (default) renders markdown with `<Markdown>` and
   * html in a sandboxed iframe, `'none'` hides the tab; or force a kind.
   */
  preview?: 'auto' | 'markdown' | 'html' | 'none';
  /** Replace the built-in preview renderer entirely. */
  renderPreview?: (value: string) => React.ReactNode;
  /** Initial tab. Defaults to `'preview'` for markdown, `'edit'` otherwise. */
  defaultMode?: FileEditorMode;
  /** `sandbox` attribute for the html preview iframe. Default `""` (inert). */
  htmlPreviewSandbox?: string;
  /** Content before the menu bar (a sidebar toggle, a back button…). */
  headerStart?: React.ReactNode;
  /** Extra header content, right of the tabs (badges, actions…). */
  headerExtra?: React.ReactNode;
  /** Extra status-bar content, pushed to the right edge. */
  statusExtra?: React.ReactNode;
  /** Bottom status line (Ln/Col, counts, language). Default `true`. */
  statusBar?: boolean;
  placeholder?: string;
  className?: string;
  /** Class for the scrolling editor body. */
  bodyClassName?: string;
}

/**
 * FileEditor — a generic text-file viewer/editor.
 *
 * Menu-bar nav (File / Tools / your own), line numbers, prism syntax
 * highlighting (bash, ts, markdown, …), submit on blur / button / ⌘S, and a
 * Preview tab that renders markdown (via `<Markdown>`) or html (sandboxed
 * iframe). The forwarded ref is the underlying `<textarea>`.
 *
 * ```tsx
 * <FileEditor path="deploy.sh" value={text} onChange={setText} onSubmit={save} />
 * ```
 */
export const FileEditor = React.forwardRef<HTMLTextAreaElement, FileEditorProps>(
  function FileEditor(
    {
      value: controlled,
      defaultValue,
      onChange,
      onSubmit,
      submitOnBlur = true,
      onRevert,
      name,
      path,
      language,
      readOnly = false,
      dirty: dirtyProp,
      submitting = false,
      menus: extraMenus,
      lineNumbers: lineNumbersInitial = true,
      wordWrap: wordWrapInitial = false,
      preview = 'auto',
      renderPreview,
      defaultMode,
      htmlPreviewSandbox = '',
      headerStart,
      headerExtra,
      statusExtra,
      statusBar = true,
      placeholder,
      className,
      bodyClassName,
    },
    forwardedRef,
  ) {
    const [inner, setInner] = React.useState(defaultValue ?? '');
    const value = controlled !== undefined ? controlled : inner;

    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    };

    // Internal dirty tracking: against the last submitted (or initial) content.
    const [baseline, setBaseline] = React.useState(value);
    const dirty = dirtyProp ?? value !== baseline;

    const [lineNumbers, setLineNumbers] = React.useState(lineNumbersInitial);
    const [wordWrap, setWordWrap] = React.useState(wordWrapInitial);
    const [cursor, setCursor] = React.useState({ line: 1, col: 1 });

    const lang = language ?? detectLanguage(path ?? name);
    const previewKind: 'markdown' | 'html' | 'custom' | null = renderPreview
      ? 'custom'
      : preview === 'none'
        ? null
        : preview === 'auto'
          ? isMarkdownLanguage(lang)
            ? 'markdown'
            : isHtmlLanguage(lang)
              ? 'html'
              : null
          : preview;

    const [mode, setMode] = React.useState<FileEditorMode>(
      defaultMode ?? (previewKind && isMarkdownLanguage(lang) ? 'preview' : 'edit'),
    );
    // Re-resolve the default tab when the file identity changes.
    const fileKey = path ?? name ?? '';
    const prevKey = React.useRef(fileKey);
    React.useEffect(() => {
      if (prevKey.current === fileKey) return;
      prevKey.current = fileKey;
      setMode(defaultMode ?? (previewKind && isMarkdownLanguage(lang) ? 'preview' : 'edit'));
      setBaseline(value);
      setCursor({ line: 1, col: 1 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileKey]);

    const handleChange = (next: string) => {
      if (controlled === undefined) setInner(next);
      onChange?.(next);
    };

    const submit = React.useCallback(() => {
      if (!onSubmit || readOnly || !dirty) return;
      onSubmit(value);
      setBaseline(value);
    }, [onSubmit, readOnly, dirty, value]);

    const revert = () => {
      onRevert?.();
      // Controlled: the consumer swaps `value` back. Uncontrolled: restore
      // the last submitted content ourselves.
      if (controlled === undefined) setInner(baseline);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        submit();
      }
    };

    const handleBlur = (e: React.FocusEvent) => {
      if (!submitOnBlur) return;
      // Only when focus leaves the editor entirely — clicking the menubar or
      // the tabs must not count as leaving.
      if (rootRef.current?.contains(e.relatedTarget as Node)) return;
      submit();
    };

    const trackCursor = () => {
      const el = textareaRef.current;
      if (!el) return;
      const before = el.value.slice(0, el.selectionStart);
      const line = (before.match(/\n/g)?.length ?? 0) + 1;
      const col = before.length - (before.lastIndexOf('\n') + 1) + 1;
      setCursor({ line, col });
    };

    const displayName = name ?? (path ? path.split('/').pop()! : 'untitled');

    const fileMenu: FileEditorMenu = {
      label: 'File',
      items: [
        {
          label: 'Save',
          icon: <Save />,
          shortcut: '⌘S',
          disabled: !onSubmit || readOnly || !dirty || submitting,
          onSelect: submit,
        },
        ...(onRevert
          ? [{ label: 'Revert', icon: <RotateCcw />, disabled: !dirty, onSelect: revert } as const]
          : []),
        'separator' as const,
        {
          label: 'Copy contents',
          icon: <Copy />,
          onSelect: () => void navigator.clipboard?.writeText(value),
        },
        {
          label: 'Download',
          icon: <Download />,
          onSelect: () => downloadFile(displayName, value),
        },
      ],
    };

    const toolsMenu: FileEditorMenu = {
      label: 'Tools',
      items: [
        { label: 'Line numbers', checked: lineNumbers, onSelect: () => setLineNumbers((v) => !v) },
        { label: 'Word wrap', checked: wordWrap, onSelect: () => setWordWrap((v) => !v) },
        'separator',
        {
          label: 'Select all',
          icon: <MousePointer2 />,
          onSelect: () => {
            setMode('edit');
            requestAnimationFrame(() => {
              textareaRef.current?.focus();
              textareaRef.current?.select();
            });
          },
        },
        ...(path
          ? [
              {
                label: 'Copy path',
                icon: <Copy />,
                onSelect: () => void navigator.clipboard?.writeText(path),
              } as const,
            ]
          : []),
      ],
    };

    const lines = value === '' ? 1 : value.split('\n').length;

    return (
      <div
        ref={rootRef}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden bg-background', className)}
      >
        {/* nav */}
        <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
          {headerStart}
          <MenuBar menus={[fileMenu, toolsMenu, ...(extraMenus ?? [])]} />
          <FileText className="ml-1 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight">{displayName}</div>
            {path && <div className="truncate text-[11px] leading-tight text-muted-foreground">{path}</div>}
          </div>

          {headerExtra}

          {previewKind && (
            <div role="tablist" className="flex overflow-hidden rounded-md border border-border">
              {(
                [
                  ['preview', Eye, 'Preview'],
                  ['edit', Pencil, 'Edit'],
                ] as const
              ).map(([m, Icon, title]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  title={title}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-2 py-1 text-muted-foreground transition-colors hover:bg-muted',
                    mode === m && 'bg-muted text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          )}

          {onSubmit && (
            <Button
              size="sm"
              className="h-8"
              icon={<Save />}
              loading={submitting}
              loadingText="Saving…"
              disabled={!dirty || readOnly}
              onClick={submit}
            >
              Save
            </Button>
          )}
        </header>

        {/* body */}
        {mode === 'preview' && previewKind ? (
          <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>
            {previewKind === 'custom' ? (
              renderPreview!(value)
            ) : previewKind === 'markdown' ? (
              <Markdown source={value} frontmatter className="px-4 py-3" />
            ) : (
              <iframe
                title={`${displayName} preview`}
                srcDoc={value}
                sandbox={htmlPreviewSandbox}
                className="h-full w-full border-0 bg-white"
              />
            )}
          </div>
        ) : (
          <CodeArea
            ref={setRefs}
            value={value}
            onValueChange={handleChange}
            language={lang}
            lineNumbers={lineNumbers}
            wordWrap={wordWrap}
            readOnly={readOnly}
            placeholder={placeholder}
            onSelect={trackCursor}
            className={cn('min-h-0 flex-1', bodyClassName)}
          />
        )}

        {/* status line */}
        {statusBar && (
          <footer className="flex items-center gap-3 border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
            <span>
              Ln {cursor.line}, Col {cursor.col}
            </span>
            <span>{lines} lines</span>
            <span>{value.length} chars</span>
            {lang !== 'plain' && <span className="font-mono">{lang}</span>}
            {readOnly && <span className="italic">read-only</span>}
            <span className="ml-auto flex items-center gap-3">
              {statusExtra}
              {dirty && <span className="font-medium text-primary">● unsaved</span>}
            </span>
          </footer>
        )}
      </div>
    );
  },
);
