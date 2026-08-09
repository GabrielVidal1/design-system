import type { ReactNode } from 'react';

/** A file that has been accepted (and usually uploaded) by the composer. */
export interface RichFile {
  /** Stable identity used for de-dupe and removal. */
  id: string;
  name: string;
  size: number;
  contentType: string;
  /** Optional preview/serve URL — images with a `url` render as a thumbnail. */
  url?: string;
  /** Arbitrary caller payload (e.g. a repo-relative path to weave into the prompt). */
  meta?: unknown;
}

/**
 * A guideline tag. In its default form it is a toggle chip that injects
 * {@link prompt} into the composed text when on (or {@link promptOff} when off).
 * With `kind: 'mention'` it is hidden from the chip row and only reachable by
 * typing the mention prefix (`#` by default) + its {@link slug}.
 */
export interface GuidelineTag {
  id: string;
  label: string;
  /** Alternate label shown while the toggle is off. */
  labelOff?: string;
  /** Text woven into the composed prompt while the tag is on. */
  prompt?: string;
  /** Text woven in while the tag is off (for either/or toggles). */
  promptOff?: string;
  /** Whether the toggle starts on. Default false. */
  defaultOn?: boolean;
  /** Leading icon for the chip / mention row. */
  icon?: ReactNode;
  /** `'toggle'` (a chip, default) or `'mention'` (search-only). */
  kind?: 'toggle' | 'mention';
  /**
   * Which cluster a toggle chip renders in:
   * - `'guideline'` (default) — a chip in the guideline row, governed by the
   *   guidelines master switch (see {@link RichInputProps.guidelinesToggle}).
   * - `'tag'` — a chip in the scrollable tag list (e.g. project/service
   *   locations); never affected by the guidelines switch.
   */
  group?: 'guideline' | 'tag';
  /**
   * Radio behaviour: tags sharing an `exclusive` key are mutually exclusive —
   * turning one on turns the others in that key off (e.g. a model picker).
   * Turning the active one off again leaves the key with no selection.
   */
  exclusive?: string;
  /** Token typed after the prefix to insert this tag. Defaults to `id`. */
  slug?: string;
  /** One-line blurb shown in the mention menu. */
  description?: string;
}

/**
 * A saved draft on the composer's drafts shelf (long-press the send button to
 * save one). Everything needed to restore the composer exactly: the text, the
 * ids of the tags that were selected (guidelines, projects, …), the attached
 * files, the guidelines master switch, and an opaque caller payload captured
 * via `draftExtra` (e.g. a model pick living outside the composer).
 */
export interface RichDraft {
  id: string;
  text: string;
  /** Ids of the tags active when the draft was saved. */
  tags: string[];
  files: RichFile[];
  /** Guidelines master switch state (when the composer shows one). */
  guidelinesOn?: boolean;
  /** Caller payload captured by `draftExtra` at save time. */
  extra?: unknown;
  /** Epoch ms. */
  savedAt: number;
}

/** What `onSubmit` receives (and what an un-send restores). */
export interface RichSendPayload {
  /** Raw textarea text. */
  text: string;
  /** Composed text: guidelines + tags + attachments woven into `text`. */
  prompt: string;
  /** Attached files at submit time. */
  files: RichFile[];
  /** Tags that were active (toggled on, or picked via mention). */
  tags: GuidelineTag[];
}

/** Inputs handed to a custom {@link RichInputProps.composePrompt}. */
export interface ComposeInput {
  text: string;
  /** Injected lines from the active guideline tags. */
  guidelines: string[];
  /** The active tags themselves. */
  tags: GuidelineTag[];
  files: RichFile[];
}

/**
 * An extra toolbar control, itemized so the reorderable toolbar
 * ({@link RichInputProps.toolbarReorder}) can move and stash it individually.
 * Ids must not collide with the built-in items (`attach`, `spacer`, `history`,
 * `send`, `drafts`).
 */
export interface RichToolbarItem {
  /** Stable id — the persisted toolbar order/stash are lists of these. */
  id: string;
  /** Label shown on the item's stash tag while it is benched. */
  label: string;
  node: ReactNode;
}

/** What a custom {@link RichInputProps.renderSendButton} is handed. */
export interface RichSendButtonProps {
  /** Whether there's anything to send and nothing is blocking it (upload in flight, `disabled`) — mirrors the built-in button's disabled state. */
  canSend: boolean;
  /** An async `onSubmit` is still in flight — the built-in button shows a spinner. */
  sending: boolean;
  /** Submit exactly as the built-in button would (starts the un-send window). */
  submit: () => void;
  /**
   * Save the composer's content as a {@link RichDraft} and clear it — what the
   * built-in button's long-press menu offers. No-op while there is nothing to
   * save (or when drafts are disabled).
   */
  saveDraft: () => void;
  /**
   * Reorderable-toolbar mode only ({@link RichInputProps.toolbarReorder}): the
   * composer owns the long-press gesture (the toolbar's first-stage hold) and
   * asks the button to render its menu open/closed through this pair — don't
   * run your own long-press when they are present. `onMenuOpenChange` reports
   * a close (outside tap, Escape, an action) and any self-initiated open
   * (e.g. right-click).
   */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

/** Imperative handle exposed through `ref`. */
export interface RichInputHandle {
  focus: () => void;
  blur: () => void;
  /** Clear the text, attachments and tag selection (and the cached draft). */
  clear: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  /** Replace the attachment list (e.g. to restore files after an external un-send). */
  setFiles: (files: RichFile[]) => void;
  /** Programmatically submit (starts the un-send window). */
  submit: () => void;
  /**
   * Cancel a submission still inside its un-send window and get the payload
   * back (or `null` if nothing is pending / it already fired).
   */
  cancelSend: () => RichSendPayload | null;
}
