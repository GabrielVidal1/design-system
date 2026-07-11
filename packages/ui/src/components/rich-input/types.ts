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
  /** Token typed after the prefix to insert this tag. Defaults to `id`. */
  slug?: string;
  /** One-line blurb shown in the mention menu. */
  description?: string;
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
