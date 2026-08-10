import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { History, Loader2, Paperclip, Upload } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useFileDrop } from '../drop-zone/use-file-drop';
import { DraftsMenu, SendDraftButton } from './draft-parts';
import { useDraft } from './use-draft';
import { useFileUpload } from './use-file-upload';
import { useTags } from './use-tags';
import { useInputHistory } from './use-input-history';
import { useMention } from './use-mention';
import { useAutoTag, type AutoTagConfig } from './use-auto-tag';
import { AutoTagOverlay } from './auto-tag-overlay';
import { useSavedDrafts } from './use-saved-drafts';
import { ReorderableToolbar, type ToolbarEntry } from './toolbar-reorder';
import {
  AttachmentChips,
  HistorySheet,
  MasterSwitch,
  MentionMenu,
  ReverseSearchBar,
  SubmitErrorBanner,
  TagChips,
  TagScrollList,
  UnsendBanner,
} from './parts';
import type {
  ComposeInput,
  MasterSwitchConfig,
  RichTag,
  RichDraft,
  RichFile,
  RichInputHandle,
  RichSendButtonProps,
  RichSendPayload,
  RichToolbarItem,
} from './types';

const LINE_HEIGHT = 22;
const DEFAULT_MASTER_SWITCH: MasterSwitchConfig = { label: 'Tags' };

export interface RichInputProps {
  /** Initial text (ignored when a cached draft exists). */
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  minRows?: number;
  maxRows?: number;
  /**
   * Stretch to fill the parent's height (the parent must give it one — e.g. a
   * flex column with `min-h-0 flex-1`, or a resizable panel body). The textarea
   * takes all the space the chips/toolbar rows leave, instead of auto-growing
   * between `minRows`/`maxRows`. Default false.
   */
  fill?: boolean;

  /**
   * Fired once the un-send window elapses (or immediately when it is 0). May
   * return a promise: while it is pending the composer counts as busy (send
   * disabled, `sending` exposed to {@link renderSendButton}); a rejection
   * restores the text / attachments / tag selection and surfaces the error as
   * a dismissible notification above the composer (tap ✕ or swipe it away).
   */
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
  /**
   * Attach files dropped anywhere on the composer. On by default whenever file
   * support is (i.e. one of `uploadFiles` / `accept` / `maxFiles` is set); the
   * drops go through the same `accept` / `maxFiles` / `fileFilter` checks as the
   * paperclip. Dragged text still drops into the textarea as usual.
   */
  fileDrop?: boolean;
  /** Expand dropped folders into their files (Chromium/WebKit). Default true. */
  dropDirectories?: boolean;

  /**
   * The selectable tags — chips, the scrollable list, and mention-only entries.
   * The array may change between renders (tags loading in, a caller revealing
   * a tag's children): vanished ids leave the selection, new `defaultOn` ones
   * join it.
   */
  tags?: RichTag[];
  /**
   * Notified whenever the selection changes. This is the *raw* selection —
   * chips muted by the master switch are still in it, because muting them must
   * not look like the user un-picked them (a caller deriving its tag list from
   * the selection would otherwise tear its own tags down). The master switch is
   * reported separately by {@link onMasterSwitchChange}, and applied to what
   * `composePrompt` and the send payload see.
   */
  onTagsChange?: (selected: RichTag[]) => void;
  /**
   * Render the built-in master switch: a leading chip that mutes the whole
   * `group: 'chip'` row. While it is off those chips are hidden and count as
   * unselected — they stay out of `onTagsChange`, `composePrompt` and the send
   * payload; `group: 'list'` chips are unaffected. Pass `true` for the default
   * wording ("Tags on/off") or a {@link MasterSwitchConfig} to word it.
   * Default false.
   */
  masterSwitch?: boolean | MasterSwitchConfig;
  /** Initial state of the master switch. Default true. */
  defaultMasterOn?: boolean;
  /** Notified when the master switch flips. */
  onMasterSwitchChange?: (on: boolean) => void;
  /** Height (in chip rows) of the scrollable `group: 'list'` tag list. Default 3. */
  tagListRows?: number;
  /**
   * Hide the master switch and tag chip rows while the composer is idle —
   * empty (no text, no attachments) and not focused. They appear on focus and
   * stay while a draft exists. Default false.
   */
  collapseWhenIdle?: boolean;
  /** Chips shown before a "+N more" button. */
  showMax?: number;
  /** Mention trigger symbol. Default `#`. */
  mentionPrefix?: string;

  /**
   * **Auto-tag**: once the typing pauses, scan the text for the words and
   * phrases tags declare in {@link RichTag.triggers} and offer each hit in
   * place — the word circled by a travelling dashed ring in the tag's
   * {@link RichTag.color}, with a ✓/✕ pair beside it. ✓ selects the tag (the
   * word then keeps a coloured mark for as long as it stays selected); ✕
   * dismisses it and that word won't offer that tag again this session.
   *
   * Off by default, and inert until some tag actually declares triggers. Pass
   * `true` for the defaults or an {@link AutoTagConfig} to tune the pause,
   * the cap, and the minimum text length.
   */
  autoTag?: boolean | AutoTagConfig;

  /** Enable Up-arrow / Ctrl+R history + the mobile history sheet. Default true. */
  history?: boolean;

  /**
   * Enable the saved-drafts shelf: long-pressing (or right-clicking) the send
   * button offers **Save as draft** — the text, selected tags, attachments and
   * `draftExtra` payload are stored (localStorage, namespaced by `cacheKey`)
   * and the composer clears. While drafts exist, a drafts button appears next
   * to the send button opening a fuzzy-search dropdown; picking one restores
   * it (swapping: anything currently typed is saved as a draft first, so
   * nothing is lost) and removes it from the shelf. Default true.
   */
  drafts?: boolean;
  /**
   * Capture caller state living outside the composer (a model pick, a target
   * select, …) into each saved draft. Called at save time; the value must be
   * JSON-serialisable.
   */
  draftExtra?: () => unknown;
  /** Re-apply a restored draft's {@link draftExtra} payload. */
  onDraftRestore?: (extra: unknown) => void;

  /** Show the tag list's leading search chip (inline filter). Default true. */
  tagSearch?: boolean;

  /**
   * Build the string handed to `onSubmit` as {@link RichSendPayload.prompt}
   * from the typed text, the active tags and the attachments. This is where a
   * caller weaves its own meaning into the prompt — the composer itself never
   * appends anything. Defaults to the trimmed text.
   */
  composePrompt?: (input: ComposeInput) => string;

  /** Extra buttons rendered in the toolbar's left cluster. */
  toolbarExtra?: ReactNode;

  /**
   * Make the bottom toolbar user-arrangeable: hold any control (~1.4s) to
   * enter edit mode and drag to reorder — including across the draggable
   * spacer that splits the left/right clusters — and bench controls you don't
   * use into the stash popover. Holding the **send button** passes through a
   * first stage (~0.5s) that opens its draft menu; keep holding to reach edit
   * mode. The arrangement persists in localStorage: pass a string to name the
   * storage key (share it across composers that should stay arranged alike),
   * or `true` to fall back to `cacheKey`.
   */
  toolbarReorder?: boolean | string;
  /**
   * Extra toolbar controls as *items*, so a reorderable toolbar can move and
   * stash each one individually. Preferred over {@link toolbarExtra} when
   * {@link toolbarReorder} is on (a plain `toolbarExtra` then moves as one
   * block).
   */
  toolbarExtraItems?: RichToolbarItem[];

  /**
   * Replace the built-in send button. Receives `{ canSend, submit }` — call
   * `submit` for a plain send (e.g. from `onClick`) and layer on whatever else
   * the caller needs (a long-press menu, a split button, …). The built-in
   * button's disabled/enabled styling and `submit` wiring are otherwise
   * unreachable from outside, so this is the escape hatch for anything beyond
   * a single click.
   */
  renderSendButton?: (props: RichSendButtonProps) => ReactNode;
}

/**
 * @summary The full composer: draft persistence (text + tag selection), a
 * saved-drafts shelf (long-press send to stash, fuzzy-search dropdown to
 * restore), un-send window, file attachments, toggle tags with inline search,
 * `#mention` autocomplete, prompt history, and an optional hold-to-rearrange
 * toolbar (reorder the controls, bench spares in a stash). Use for any
 * chat/agent input.
 *
 * It stays agnostic about what the tags *mean*: it tracks which are selected
 * and hands them to `onSubmit`/`composePrompt`, leaving the prompt's shape to
 * the caller.
 */
export const RichInput = forwardRef<RichInputHandle, RichInputProps>(function RichInput(
  {
    defaultValue = '',
    placeholder = 'Type a message…',
    disabled = false,
    className,
    autoFocus = false,
    minRows = 2,
    maxRows = 12,
    fill = false,
    onSubmit,
    undoWindowMs = 3000,
    submitKey = 'enter',
    cacheKey,
    cacheLocation = 'local',
    uploadFiles,
    accept,
    maxFiles,
    fileFilter,
    fileDrop,
    dropDirectories = true,
    tags = [],
    onTagsChange,
    masterSwitch = false,
    defaultMasterOn = true,
    onMasterSwitchChange,
    tagListRows = 3,
    collapseWhenIdle = false,
    showMax,
    mentionPrefix = '#',
    autoTag = false,
    history: historyEnabled = true,
    drafts: draftsEnabled = true,
    draftExtra,
    onDraftRestore,
    tagSearch = true,
    composePrompt,
    toolbarExtra,
    toolbarReorder = false,
    toolbarExtraItems,
    renderSendButton,
  },
  ref,
) {
  const masterConfig = typeof masterSwitch === 'object' ? masterSwitch : DEFAULT_MASTER_SWITCH;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const draft = useDraft(cacheKey, cacheLocation);
  const { text: value, setText: setValueRaw } = draft;
  const [seeded, setSeeded] = useState(false);
  const sel = useTags(tags);
  const files = useFileUpload({ upload: uploadFiles, accept, maxFiles, filter: fileFilter });
  const hist = useInputHistory(historyEnabled ? (cacheKey ?? 'default') : null);
  const savedDrafts = useSavedDrafts(cacheKey);

  const filesEnabled = uploadFiles !== undefined || accept !== undefined || maxFiles !== undefined;

  // Async submit: while an onSubmit promise is in flight the composer is busy;
  // a rejection restores the payload and surfaces `submitError`.
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const busy = disabled || files.uploading || sending;

  // A drop is just another way to pick files: useFileDrop only hands us the
  // dragged files (expanding folders), `files.add` still runs the accept /
  // maxFiles / fileFilter checks and surfaces the same errors as the paperclip.
  const drop = useFileDrop({
    onFiles: (list) => void files.add(list),
    disabled: !(fileDrop ?? filesEnabled) || busy,
    recursive: dropDirectories,
  });

  const [coarse, setCoarse] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Focus-within tracking, only consulted by `collapseWhenIdle`.
  const [focused, setFocused] = useState(false);

  // Reorderable-toolbar mode: the send button's draft menu opens on the
  // toolbar's first-stage hold, so the composer owns its open state.
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const reorderKey =
    toolbarReorder === true ? (cacheKey ?? 'default') : toolbarReorder || null;

  // Master switch (only surfaced when `masterSwitch` is set). A cached draft's
  // saved state wins over the default.
  const [masterOn, setMasterOn] = useState(draft.meta?.masterOn ?? defaultMasterOn);
  const chipsActive = !masterSwitch || masterOn;

  /* ── tag-selection persistence (part of the cached draft) ────────────────
   * `pendingTags` is the selection a cached/restored draft still wants applied
   * — tag lists often load async, so unknown ids wait for their tags to show
   * up. `tagsDirty` gates writing: only a selection the user (or a restore)
   * actually touched is persisted, never the mount-time defaults. */
  const pendingTags = useRef<string[] | null>(draft.meta ? [...draft.meta.tags] : null);
  const tagsDirty = useRef(draft.meta != null);
  const skipPersist = useRef(true);
  const touchTags = useCallback(() => {
    tagsDirty.current = true;
  }, []);

  // (Re-)apply the wanted selection whenever the tag set changes. Registered
  // after useTags, so its own default-on seeding runs first and this replace
  // wins the commit.
  const idKey = tags.map((t) => t.id).join(',');
  useEffect(() => {
    if (pendingTags.current) sel.replace(pendingTags.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Persist the live selection into the draft record. The first (mount) run is
  // skipped — it still sees the pre-restore defaults.
  const activeKey = sel.active.map((t) => t.id).join(',');
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    if (!tagsDirty.current) return;
    const known = new Set(tags.map((t) => t.id));
    const unknown = (pendingTags.current ?? []).filter((id) => !known.has(id));
    const ids = [...sel.active.map((t) => t.id), ...unknown];
    // Once every wanted id is known the applied selection is the truth.
    pendingTags.current = unknown.length > 0 ? ids : null;
    draft.setMeta({ tags: ids, ...(masterSwitch ? { masterOn } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, masterOn]);

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

  // What gets *sent*. The raw `sel.active` stays the selection of record — it is
  // what persists and what `onTagsChange` reports, so muting the chips never
  // reads as un-picking them — and the master switch is applied only here.
  const activeTags = useMemo(
    () => (chipsActive ? sel.active : sel.active.filter((t) => t.group === 'list')),
    [chipsActive, sel.active],
  );

  // Fire on a real change of *selection*, not on identity churn. A caller that
  // derives its `tags` array from this callback (a hierarchy revealing children)
  // hands us a fresh array on every render, which would otherwise re-fire the
  // notification, re-derive the array, and spin forever.
  const notifiedTags = useRef<string | null>(null);
  useEffect(() => {
    const key = sel.active.map((t) => t.id).join(',');
    if (notifiedTags.current === key) return;
    notifiedTags.current = key;
    onTagsChange?.(sel.active);
  }, [sel.active, onTagsChange]);

  useEffect(() => onMasterSwitchChange?.(masterOn), [masterOn, onMasterSwitchChange]);

  const mention = useMention({
    tags,
    value,
    setValue,
    taRef,
    prefix: mentionPrefix,
    onPick: (tag) => {
      touchTags();
      sel.setOn(tag.id, true);
    },
  });

  // Auto-grow the textarea between min/max rows. In `fill` mode the flex layout
  // owns the height instead.
  const measureHeight = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    if (fill) {
      el.style.height = '';
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxRows * LINE_HEIGHT)}px`;
  }, [maxRows, fill]);

  useLayoutEffect(measureHeight, [value, measureHeight]);

  // Re-measure when the composer's width changes: line wrapping — of the value
  // and of the placeholder, which Chrome counts into scrollHeight — depends on
  // it. Without this, mounting inside a panel that starts at zero width (a
  // ResizableLayout still settling) locks the empty textarea at maxRows.
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (width === lastWidth) return; // our own height writes must not loop
      lastWidth = width;
      measureHeight();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureHeight]);

  const clearTimers = useCallback(() => {
    if (queueTimer.current) clearTimeout(queueTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    queueTimer.current = null;
    tickTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Auto-tag. Accepting is an ordinary selection — it persists with the draft
  // like any chip the user clicked, which is what lets an accepted word keep
  // its mark after a reload.
  const acceptAutoTag = useCallback(
    (tag: RichTag) => {
      touchTags();
      sel.setOn(tag.id, true);
    },
    [touchTags, sel],
  );
  const auto = useAutoTag({
    enabled: autoTag !== false,
    tags,
    value,
    selected: sel.selected,
    config: typeof autoTag === 'object' ? autoTag : {},
    mentionPrefix,
    onAccept: acceptAutoTag,
  });

  const resetInput = useCallback(() => {
    draft.clear();
    files.reset();
    // A refusal is scoped to the message it was refused in.
    auto.reset();
    // Back to the default selection — and stop persisting until touched again,
    // so the post-clear default state doesn't get written as a draft.
    tagsDirty.current = false;
    pendingTags.current = null;
    sel.clear();
    setExpanded(false);
    hist.resetCursor();
  }, [draft, files, sel, hist, auto]);

  // Every user-driven toggle marks the selection dirty so it persists with the draft.
  const toggleTag = useCallback(
    (id: string) => {
      touchTags();
      sel.toggle(id);
    },
    [touchTags, sel],
  );


  // Wrapping chip row (default group) vs. the scrollable list (`group: 'list'`).
  const chipToggles = sel.toggles.filter((t) => (t.group ?? 'chip') !== 'list');
  const listToggles = sel.toggles.filter((t) => t.group === 'list');
  // Idle ⇒ both chip rows collapse away; typing, attaching or focusing brings
  // them back. Selected chips don't count as content — default-on tags would
  // otherwise pin the rows open forever.
  const idle =
    collapseWhenIdle && !focused && value.trim().length === 0 && files.files.length === 0;

  const buildPayload = useCallback((): RichSendPayload | null => {
    const base = value.trim();
    if ((!base && files.files.length === 0) || files.uploading) return null;
    const prompt = composePrompt
      ? composePrompt({ text: base, tags: activeTags, files: files.files })
      : base;
    return { text: base, prompt, files: files.files, tags: activeTags };
  }, [value, files.files, files.uploading, composePrompt, activeTags]);

  // Put a payload back into the composer — an un-send, or a failed async submit.
  const restorePayload = useCallback(
    (p: RichSendPayload) => {
      setValue(p.text);
      files.setFiles(p.files);
      touchTags();
      for (const t of p.tags) sel.setOn(t.id, true);
    },
    [setValue, files, sel, touchTags],
  );

  const fire = useCallback(
    (payload: RichSendPayload) => {
      if (!onSubmit) return;
      setSubmitError(null);
      const fail = (e: unknown) => {
        setSubmitError(e instanceof Error ? e.message : String(e));
        restorePayload(payload);
      };
      let result: void | Promise<void>;
      try {
        result = onSubmit(payload);
      } catch (e) {
        fail(e);
        return;
      }
      if (result && typeof result.then === 'function') {
        setSending(true);
        result.then(
          () => setSending(false),
          (e) => {
            setSending(false);
            fail(e);
          },
        );
      }
    },
    [onSubmit, restorePayload],
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
    restorePayload(restored);
    requestAnimationFrame(() => taRef.current?.focus());
    return restored;
  }, [pending, clearTimers, restorePayload]);

  /* ── saved drafts ────────────────────────────────────────────────────────
   * The selection stored with a draft is the applied one plus any ids still
   * waiting for their (async-loading) tags — same union the live record keeps.
   */
  const draftTagIds = useCallback((): string[] => {
    const known = new Set(tags.map((t) => t.id));
    const unknown = (pendingTags.current ?? []).filter((id) => !known.has(id));
    return [...sel.active.map((t) => t.id), ...unknown];
  }, [tags, sel.active]);

  const stashDraft = useCallback((): RichDraft | null => {
    if (!value.trim() && files.files.length === 0) return null;
    return savedDrafts.save({
      text: value,
      tags: draftTagIds(),
      files: files.files,
      ...(masterSwitch ? { masterOn } : {}),
      ...(draftExtra ? { extra: draftExtra() } : {}),
    });
  }, [value, files.files, savedDrafts, draftTagIds, masterSwitch, masterOn, draftExtra]);

  const saveDraft = useCallback(() => {
    if (!draftsEnabled || !stashDraft()) return;
    resetInput();
  }, [draftsEnabled, stashDraft, resetInput]);

  const restoreDraft = useCallback(
    (d: RichDraft) => {
      // Swap semantics: whatever is currently typed becomes a draft itself, so
      // picking a draft never loses work.
      stashDraft();
      savedDrafts.remove(d.id);
      setValueRaw(d.text);
      files.setFiles(d.files);
      tagsDirty.current = true;
      pendingTags.current = [...d.tags];
      sel.replace(d.tags);
      if (masterSwitch && d.masterOn != null) setMasterOn(d.masterOn);
      onDraftRestore?.(d.extra);
      hist.resetCursor();
      requestAnimationFrame(() => taRef.current?.focus());
    },
    [stashDraft, savedDrafts, setValueRaw, files, sel, masterSwitch, onDraftRestore, hist],
  );

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

  const canSend = (value.trim().length > 0 || files.files.length > 0) && !busy;

  return (
    <div className={cn('flex flex-col gap-2', fill && 'h-full min-h-0', className)}>
      {submitError && (
        <SubmitErrorBanner message={submitError} onDismiss={() => setSubmitError(null)} />
      )}
      {pending ? (
        <UnsendBanner countdown={countdown} onUndo={cancelSend} />
      ) : (
        <div
          {...drop.rootProps}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            // Focus-within: ignore blurs that land elsewhere inside the composer
            // (textarea → chip → toolbar), only a real exit collapses the rows.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
          }}
          className={cn(
            'relative rounded-2xl border border-input bg-card p-2 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
            fill && 'flex min-h-0 flex-1 flex-col',
            // Dim the contents, not the card: whole-element opacity would make
            // the surface translucent and let whatever is behind bleed through.
            disabled && '[&>*]:opacity-60',
            drop.dragging && 'border-primary ring-2 ring-primary/40',
          )}
        >
          {drop.dragging && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-card/80 text-xs font-medium text-primary">
              <Upload className="size-4" />
              Drop files to attach
            </div>
          )}

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

          {/* The textarea and its auto-tag layers share one positioning box:
              a mirror behind it (marks + measurement) and the ring layer on
              top. Present whether or not auto-tag is on, so the box the
              textarea sizes itself in never differs between the two modes. */}
          <div className={cn('relative', fill && 'flex min-h-0 flex-1 flex-col')}>
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
            style={fill ? undefined : { maxHeight: maxRows * LINE_HEIGHT }}
            className={cn(
              // `relative` keeps the glyphs above the mirror's tints.
              'relative w-full resize-none bg-transparent px-2 py-1 text-sm leading-[22px] text-foreground outline-none placeholder:text-muted-foreground',
              fill && 'min-h-0 flex-1',
            )}
          />
            {autoTag !== false && (
              <AutoTagOverlay
                taRef={taRef}
                value={value}
                marks={auto.marks}
                suggestions={auto.suggestions}
                onAccept={auto.accept}
                onRefuse={auto.refuse}
              />
            )}
          </div>

          {!idle && (masterSwitch !== false || chipToggles.length > 0) && (
            <div className="px-1 pt-1.5">
              <TagChips
                tags={chipsActive ? chipToggles : []}
                selected={sel.selected}
                onToggle={toggleTag}
                showMax={showMax}
                expanded={expanded}
                onExpand={() => setExpanded(true)}
                leading={
                  masterSwitch !== false ? (
                    <MasterSwitch
                      on={masterOn}
                      config={masterConfig}
                      onToggle={() => {
                        touchTags();
                        setMasterOn((v) => !v);
                      }}
                    />
                  ) : undefined
                }
              />
            </div>
          )}

          {!idle && listToggles.length > 0 && (
            <div className="px-1 pt-1.5">
              <TagScrollList
                tags={listToggles}
                selected={sel.selected}
                onToggle={toggleTag}
                rows={tagListRows}
                searchable={tagSearch}
              />
            </div>
          )}

          {files.error && <p className="px-2 pt-1 text-xs text-destructive">{files.error}</p>}

          {filesEnabled && (
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
          )}

          {(() => {
            const attachNode = filesEnabled ? (
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
            ) : null;
            const historyNode =
              historyEnabled && hist.entries.length > 0 ? (
                <IconButton label="History" onClick={() => setSheetOpen(true)}>
                  <History className="size-4" />
                </IconButton>
              ) : null;
            const sendNode = renderSendButton ? (
              renderSendButton({
                canSend,
                sending,
                submit,
                saveDraft,
                ...(reorderKey
                  ? { menuOpen: sendMenuOpen, onMenuOpenChange: setSendMenuOpen }
                  : {}),
              })
            ) : (
              <SendDraftButton
                canSend={canSend}
                sending={sending}
                submit={submit}
                onSaveDraft={draftsEnabled ? saveDraft : undefined}
                {...(reorderKey ? { open: sendMenuOpen, onOpenChange: setSendMenuOpen } : {})}
              />
            );
            const draftsNode = draftsEnabled ? (
              <DraftsMenu
                drafts={savedDrafts.drafts}
                onPick={restoreDraft}
                onDelete={savedDrafts.remove}
              />
            ) : null;

            if (!reorderKey)
              return (
                <div className="mt-1.5 flex items-center gap-1.5 px-1">
                  {attachNode}
                  {toolbarExtra}
                  <div className="ml-auto flex items-center gap-1.5">
                    {historyNode}
                    {sendNode}
                    {draftsNode}
                  </div>
                </div>
              );

            // Reorderable toolbar: every control is a HoldEditable entry, the
            // classic left/right split lives on as the draggable spacer, and
            // the send button's first-stage hold opens its draft menu.
            const extraEntries: ToolbarEntry[] = toolbarExtraItems
              ? toolbarExtraItems.map((it) => ({
                  id: it.id,
                  label: it.label,
                  stashable: true,
                  node: it.node,
                }))
              : toolbarExtra != null
                ? [{ id: 'extra', label: 'Extras', stashable: true, node: toolbarExtra }]
                : [];
            const entries: ToolbarEntry[] = [
              ...(attachNode
                ? [{ id: 'attach', label: 'Attach', stashable: true, node: attachNode }]
                : []),
              ...extraEntries,
              { id: 'spacer', label: 'Spacer', stashable: true, flex: true, node: null },
              ...(historyNode
                ? [{ id: 'history', label: 'History', stashable: true, node: historyNode }]
                : []),
              { id: 'send', label: 'Send', stashable: false, node: sendNode },
              ...(draftsNode && savedDrafts.drafts.length > 0
                ? [{ id: 'drafts', label: 'Drafts', stashable: true, node: draftsNode }]
                : []),
            ];
            const sendHasMenu = renderSendButton !== undefined || draftsEnabled;
            return (
              <ReorderableToolbar
                storageKey={reorderKey}
                entries={entries}
                onEditStart={() => setSendMenuOpen(false)}
                onItemHold={(e) => {
                  if (e.id !== 'send' || !canSend || !sendHasMenu) return false;
                  setSendMenuOpen(true);
                }}
              />
            );
          })()}
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
