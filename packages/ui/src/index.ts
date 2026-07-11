// @gabvdl/ui — Gabriel Vidal's personal design system.
//
// Tree-shakeable: every component lives in its own module and the package is
// marked side-effect-free (except CSS), so a consumer's bundler keeps only what
// it imports. Styles ship separately — see `@gabvdl/ui/styles.css`.

export { cn } from './lib/utils';

export { ImageViewerProvider, useImageViewer, ViewableImage, ProgressiveImage } from './components/image-viewer';
export { FuzzyList, highlightAll, highlightSnippet } from './components/fuzzy-list';
export type { FuzzyListProps, FuzzyRenderContext } from './components/fuzzy-list';
export { VirtualList } from './components/virtual-list';
export type { VirtualListProps, VirtualListHandle } from './components/virtual-list';
export { Changelog } from './components/changelog';
export type { ChangelogEntry, ChangelogProps } from './components/changelog';
export { PhonePreview, IOSStatusBar } from './components/phone-preview';
export type { PhonePreviewProps } from './components/phone-preview';
export { Nav2DProvider, Nav2DItem, useNav2D } from './components/nav-2d';
export type { Nav2DProviderProps, Nav2DItemProps, Nav2DContextValue } from './components/nav-2d';
export { Button } from './components/button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button';
export { Input } from './components/input';
export type { InputProps } from './components/input';
export { RichInput, defaultComposePrompt } from './components/rich-input';
export type {
  RichInputProps,
  RichFile,
  GuidelineTag,
  RichSendPayload,
  RichInputHandle,
  ComposeInput,
} from './components/rich-input';
export { ProgressiveText } from './components/progressive-text';
export type { ProgressiveTextProps, ProgressiveTextMeta } from './components/progressive-text';
export { ProgressiveList } from './components/progressive-list';
export type { ProgressiveListProps, ProgressiveListItemMeta } from './components/progressive-list';
export { ProgressiveTable } from './components/progressive-table';
export type { ProgressiveTableProps, ProgressiveTableCellContext } from './components/progressive-table';
export { useProgressiveSlot, ProgressiveTimelineSlot } from './components/progressive-timeline';
export type { ProgressiveSlotValue } from './components/progressive-timeline';
export { ProgressiveBash } from './components/progressive-bash';
export type { ProgressiveBashProps, ProgressiveBashHandle, BashEntry, PlaybackTuning } from './components/progressive-bash';
export {
  computeGapMs as computeBashGapMs,
  DEFAULT_TUNING as DEFAULT_BASH_TUNING,
  tokenizeCommand,
  splitOutput,
  classifyLine,
  splitBySubparts,
} from './components/progressive-bash';
export type { CmdToken, CmdKind, OutputLine, OutputSpan, LineKind, SubCommand } from './components/progressive-bash';
export { FloatingPanel, Dock, DockProvider, useDockContext } from './components/floating-panel';
export type {
  FloatingPanelProps,
  FloatingPanelHandle,
  DockProps,
  DockContextValue,
  PanelPlacement,
  FloatingGeom,
} from './components/floating-panel';
