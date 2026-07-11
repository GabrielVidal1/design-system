import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { History, Loader2, Paperclip, SendHorizontal } from 'lucide-react';

import { cn } from '../../lib/utils';
import { defaultComposePrompt } from './compose';
import { useDraft } from './use-draft';
import { useFileUpload } from './use-file-upload';
import { useGuidelines } from './use-guidelines';
import { useInputHistory } from './use-input-history';
import { useMention } from './use-mention';
import {
  AttachmentChips,
  HistorySheet,
  MentionMenu,
  ReverseSearchBar,
  TagChips,
  UnsendBanner,
} from './parts';
import type { ComposeInput, GuidelineTag, RichFile, RichInputHandle, RichSendPayload } from './types';

const LINE_HEIGHT = 22;

export interface RichInputProps {
  /** Initial text (ignored when a cached draft exists). */
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  minRows?: number;
  maxRows?: number;

  /** Fired once the un-send window elapses (or immediately when it is 0). */
  onSubmit?: (payload: RichSendPayload) => void | Promise<void>;
  /** ms to hold a submission so it can be un-sent. 0 disables. Default 3000. */
  undoWindowMs?: number;
  /** `'enter'` (default): Enter submits, Shift+Enter newline. `'mod+enter'`: ⌘/Ctrl+Enter submits. */
  submitKey?: 'enter' | 'mod+enter';

  /** Persist the draft under this key (localStorage). Also namespaces history. */
  cacheKey?: string;
  cacheLocation?: 'local' | 'session';

  /** Upload handler. Omit to keep files client-side (object URLs). */
  uploadFiles?: (files: File[]) => Promise<RichFile[]>;
  accept?: string;
  maxFiles?: number;
  fileFilter?: (file: File) => boolean | string;

  /** Guideline / mention tags. */
  tags?: GuidelineTag[];
  onTagsChange?: (active: GuidelineTag[]) => void;
  /** Show the guideline toggle chip row. Defaults to true when toggle tags exist. */
  guidelines?: boolean;
  /** Chips shown before a "+N more" button. */
  showMax?: number;
  /** Mention trigger symbol. Default `#`. */
  mentionPrefix?: string;

  /** Enable Up-arrow / Ctrl+R history + the mobile history sheet. Default true. */
  history?: boolean;

  /** Override how the final prompt string is composed. */
  composePrompt?: (input: ComposeInput) => string;

  /** Extra buttons rendered in the toolbar's left cluster. */
  toolbarExtra?: ReactNode;
}

export const RichInput = forwardRef<RichInputHandle, RichInputProps>(function RichInput(
  {
    defaultValue = '',
    placeholder = 'Type a message…',
    disabled = false,
    className,
    autoFocus = false,
    minRows = 2,
    maxRows = 12,
    onSubmit,
    undoWindowMs = 3000,
    submitKey = 'enter',
    cacheKey,
    cacheLocation = 'local',
    uploadFiles,
    accept,
    maxFiles,
    fileFilter,
    tags = [],
    onTagsChange,
    guidelines,
    showMax,
    mentionPrefix = '#',
    history: historyEnabled = true,
    composePrompt = defaultComposePrompt,
    toolbarExtra,
  },
  ref,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [value, setValueRaw, clearDraft] = useDraft(cacheKey, cacheLocation);
  const [seeded, setSeeded] = useState(false);
  const gl = useGuidelines(tags);
  const files = useFileUpload({ upload: uploadFiles, accept, maxFiles, filter: fileFilter });
  const hist = useInputHistory(historyEnabled ? (cacheKey ?? 'default') : null);

  const [coarse, setCoarse] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Reverse search (Ctrl+R).
  const [rsearch, setRsearch] = useState<{ query: string; match: string | null } | null>(null);

  // Un-send window.
  const [pending, setPending] = useState<RichSendPayload | null>(null);
  const [countdown, setCountdown] = useState(0);
  const queueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setValue = useCallback(
    (v: string) => {
      setValueRaw(v);
    },
    [setValueRaw],
  );

  // Seed the initial defaultValue once (only when there is no cached draft).
  useEffect(() => {
    if (seeded) return;
    setSeeded(true);
    if (defaultValue && !value) setValueRaw(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => onTagsChange?.(gl.active), [gl.active, onTagsChange]);

  const mention = useMention({
    tags,
    value,
    setValue,
    taRef,
    prefix: mentionPrefix,
    onPick: (tag) => gl.setOn(tag.id, true),
  });

  // Auto-grow the textarea between min/max rows.
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxRows * LINE_HEIGHT)}px`;
  }, [value, maxRows]);

  const clearTimers = useCallback(() => {
    if (queueTimer.current) clearTimeout(queueTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    queueTimer.current = null;
    tickTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const resetInput = useCallback(() => {
    clearDraft();
    files.reset();
    gl.clear();
    setExpanded(false);
    hist.resetCursor();
  }, [clearDraft, files, gl, hist]);

  const showGuidelines = guidelines ?? gl.toggles.length > 0;

  const buildPayload = useCallback((): RichSendPayload | null => {
    const base = value.trim();
    if ((!base && files.files.length === 0) || files.uploading) return null;
    const prompt = composePrompt({ text: base, guidelines: gl.lines, tags: gl.active, files: files.files });
    return { text: base, prompt, files: files.files, tags: gl.active };
  }, [value, files.files, files.uploading, composePrompt, gl.lines, gl.active]);

  const fire = useCallback(
    (payload: RichSendPayload) => {
      void onSubmit?.(payload);
    },
    [onSubmit],
  );

  const submit = useCallback(() => {
    const payload = buildPayload();
    if (!payload) return;
    hist.push(payload.text);
    resetInput();

    if (undoWindowMs <= 0) {
      fire(payload);
      return;
    }
    clearTimers();
    setPending(payload);
    setCountdown(Math.ceil(undoWindowMs / 1000));
    tickTimer.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    queueTimer.current = setTimeout(() => {
      clearTimers();
      setPending(null);
      fire(payload);
    }, undoWindowMs);
  }, [buildPayload, hist, resetInput, undoWindowMs, clearTimers, fire]);

  const cancelSend = useCallback((): RichSendPayload | null => {
    if (!queueTimer.current || !pending) return null;
    clearTimers();
    const restored = pending;
    setPending(null);
    setValue(restored.text);
    files.setFiles(restored.files);
    for (const t of restored.tags) gl.setOn(t.id, true);
    requestAnimationFrame(() => taRef.current?.focus());
    return restored;
  }, [pending, clearTimers, setValue, files, gl]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => taRef.current?.focus(),
      blur: () => taRef.current?.blur(),
      clear: () => resetInput(),
      getValue: () => value,
      setValue: (v: string) => setValue(v),
      setFiles: (f) => files.setFiles(f),
      submit,
      cancelSend,
    }),
    [resetInput, value, setValue, files, submit, cancelSend],
  );

  /* ── history navigation ──────────────────────────────────────────────── */
  const recallPrev = useCallback(() => {
    const el = taRef.current;
    const got = hist.prev(value);
    if (got == null) return false;
    setValue(got);
    requestAnimationFrame(() => el?.setSelectionRange(got.length, got.length));
    return true;
  }, [hist, value, setValue]);

  const recallNext = useCallback(() => {
    const got = hist.next();
    if (got == null) return false;
    setValue(got);
    const el = taRef.current;
    requestAnimationFrame(() => el?.setSelectionRange(got.length, got.length));
    return true;
  }, [hist, setValue]);

  /* ── reverse search ──────────────────────────────────────────────────── */
  const openReverse = useCallback(() => {
    hist.resetSearch();
    setRsearch({ query: '', match: null });
  }, [hist]);

  const reverseType = useCallback(
    (query: string) => setRsearch({ query, match: hist.reverseSearch(query) }),
    [hist],
  );
  const reverseNext = useCallback(
    () => setRsearch((s) => (s ? { ...s, match: hist.reverseSearch(s.query, true) } : s)),
    [hist],
  );
  const reverseAccept = useCallback(() => {
    const m = rsearch?.match;
    setRsearch(null);
    if (m != null) {
      setValue(m);
      requestAnimationFrame(() => {
        const el = taRef.current;
        el?.focus();
        el?.setSelectionRange(m.length, m.length);
      });
    }
  }, [rsearch, setValue]);

  /* ── keyboard ────────────────────────────────────────────────────────── */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mention.onKeyDown(e)) return;

      if (e.ctrlKey && e.key.toLowerCase() === 'r' && historyEnabled) {
        e.preventDefault();
        openReverse();
        return;
      }

      const el = e.currentTarget;
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const atEnd = el.selectionStart === value.length && el.selectionEnd === value.length;

      if (e.key === 'ArrowUp' && historyEnabled && atStart) {
        if (recallPrev()) {
          e.preventDefault();
          return;
        }
      }
      if (e.key === 'ArrowDown' && historyEnabled && hist.browsing && atEnd) {
        if (recallNext()) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Enter') {
        const mod = e.metaKey || e.ctrlKey;
        const wantsSubmit = submitKey === 'mod+enter' ? mod : !e.shiftKey && (coarse ? mod : true);
        // On touch devices, plain Enter always inserts a newline (submit via button).
        if (coarse && submitKey !== 'mod+enter' && !mod) return;
        if (wantsSubmit) {
          e.preventDefault();
          submit();
        }
      }
    },
    [mention, historyEnabled, openReverse, value.length, recallPrev, recallNext, hist.browsing, submitKey, coarse, submit],
  );

  const busy = disabled || files.uploading;
  const canSend = (value.trim().length > 0 || files.files.length > 0) && !busy;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {pending ? (
        <UnsendBanner countdown={countdown} onUndo={cancelSend} />
      ) : (
        <div
          className={cn(
            'rounded-2xl border border-input bg-card p-2 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
            disabled && 'opacity-60',
          )}
        >
          {rsearch ? (
            <ReverseSearchBar
              query={rsearch.query}
              match={rsearch.match}
              onQueryChange={reverseType}
              onNext={reverseNext}
              onAccept={reverseAccept}
              onClose={() => setRsearch(null)}
            />
          ) : mention.open ? (
            <MentionMenu
              matches={mention.matches}
              active={mention.active}
              prefix={mentionPrefix}
              onHover={mention.setActive}
              onPick={mention.pick}
            />
          ) : null}

          <AttachmentChips files={files.files} onRemove={files.remove} />

          <textarea
            ref={taRef}
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            placeholder={placeholder}
            rows={minRows}
            onChange={(e) => {
              setValue(e.target.value);
              hist.resetCursor();
              mention.syncCaret();
            }}
            onSelect={mention.syncCaret}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              if (uploadFiles && e.clipboardData.files.length > 0) {
                e.preventDefault();
                void files.add(e.clipboardData.files);
              }
            }}
            style={{ maxHeight: maxRows * LINE_HEIGHT }}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm leading-[22px] text-foreground outline-none placeholder:text-muted-foreground"
          />

          {showGuidelines && gl.toggles.length > 0 && (
            <div className="px-1 pt-1.5">
              <TagChips
                tags={gl.toggles}
                selected={gl.selected}
                onToggle={gl.toggle}
                showMax={showMax}
                expanded={expanded}
                onExpand={() => setExpanded(true)}
              />
            </div>
          )}

          {files.error && <p className="px-2 pt-1 text-xs text-destructive">{files.error}</p>}

          <div className="mt-1.5 flex items-center gap-1.5 px-1">
            {uploadFiles !== undefined || accept !== undefined || maxFiles !== undefined ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={accept}
                  className="hidden"
                  onChange={(e) => void files.add(e.target.files)}
                  onClick={(e) => {
                    (e.currentTarget as HTMLInputElement).value = '';
                  }}
                />
                <IconButton
                  label="Attach files"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {files.uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Paperclip className="size-4" />
                  )}
                </IconButton>
              </>
            ) : null}

            {toolbarExtra}

            <div className="ml-auto flex items-center gap-1.5">
              {historyEnabled && hist.entries.length > 0 && (
                <IconButton label="History" onClick={() => setSheetOpen(true)}>
                  <History className="size-4" />
                </IconButton>
              )}
              <button
                type="button"
                aria-label="Send"
                disabled={!canSend}
                onClick={submit}
                className={cn(
                  'inline-flex size-8 items-center justify-center rounded-lg transition-colors',
                  canSend
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <SendHorizontal className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <HistorySheet
          entries={hist.entries}
          onClose={() => setSheetOpen(false)}
          onPick={(v) => {
            setValue(v);
            setSheetOpen(false);
            requestAnimationFrame(() => {
              const el = taRef.current;
              el?.focus();
              el?.setSelectionRange(v.length, v.length);
            });
          }}
        />
      )}
    </div>
  );
});

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-input hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}
