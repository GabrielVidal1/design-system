// @gabvdl/ui — Gabriel Vidal's personal design system.
//
// Tree-shakeable: every component lives in its own module and the package is
// marked side-effect-free (except CSS), so a consumer's bundler keeps only what
// it imports. Styles ship separately — see `@gabvdl/ui/styles.css`.

export { cn } from './lib/utils';
export {
  downloadFile,
  fmtBytes,
  fmtCost,
  fmtDateTime,
  fmtDuration,
  fmtNum,
  relTime,
} from './lib/format';
export type { TimeInput } from './lib/format';

export {
  useCopyToClipboard,
  useDebouncedValue,
  useEscape,
  useInfiniteScroll,
  useIntersection,
  useIsMobile,
  useIsTouch,
  useLocalStorage,
  useLongPress,
  useMediaQuery,
  useOutsideClick,
  usePrefersDark,
  usePrefersReducedMotion,
  useScrollLock,
} from './hooks';
export type {
  LongPressPoint,
  UseCopyOptions,
  UseDebouncedValueOptions,
  UseInfiniteScrollOptions,
  UseLongPressOptions,
} from './hooks';

export { ToastProvider, Toaster, useToast } from './components/toast';
export type { Toast, ToastAction, ToastFn, ToastOptions, ToastPosition, ToastType } from './components/toast';
export { Modal, ModalProvider, useConfirm, useModal } from './components/modal';
export type { ConfirmSpec, ModalProps, ModalSize, ModalSpec } from './components/modal';
export { ThemeProvider, ThemeToggle, resolveTheme, setTheme, toggleTheme, useTheme } from './components/theme';
export type { ThemeMode, ThemeToggleProps, UseThemeResult } from './components/theme';
export { Spinner } from './components/spinner';
export type { SpinnerProps } from './components/spinner';
export { Skeleton, SkeletonGrid, SkeletonText } from './components/skeleton';
export type { SkeletonGridProps, SkeletonTextProps } from './components/skeleton';
export { EmptyState } from './components/empty-state';
export type { EmptyStateProps } from './components/empty-state';
export { Badge, JOB_STATUS, StatusBadge } from './components/status-badge';
export type { BadgeProps, StatusBadgeProps, StatusMeta, Tone } from './components/status-badge';
export { CopyButton } from './components/copy-button';
export type { CopyButtonProps } from './components/copy-button';
export { DropZone, useFileDrop } from './components/drop-zone';
export type { DropZoneProps, FileRejection, UseFileDropOptions } from './components/drop-zone';
export { SearchInput } from './components/search-input';
export type { SearchInputProps } from './components/search-input';
export {
  ElementPicker,
  ElementPickerField,
  ElementPickerOverlay,
  ElementPreview,
  useElementPicker,
  classify,
  formatHtml,
  hierarchy,
  parseElement,
  uniqueSelector,
  STYLE_GROUPS,
  STYLE_PROPS,
} from './components/element-picker';
export type {
  ElementPickerProps,
  ElementPickerOverlayProps,
  ElementPickerFieldProps,
  ElementPreviewProps,
  UseElementPickerOptions,
  UseElementPickerResult,
  ParseOptions,
  ElementField,
  ElementInfo,
  ElementKind,
  ElementPathStep,
  PickedElement,
} from './components/element-picker';
export { RelativeTime } from './components/relative-time';
export type { RelativeTimeProps } from './components/relative-time';

export { ImageViewerProvider, useImageViewer, ViewableImage, ProgressiveImage } from './components/image-viewer';
export { FuzzyList, highlightAll, highlightSnippet } from './components/fuzzy-list';
export type { FuzzyListProps, FuzzyRenderContext } from './components/fuzzy-list';
export { GlobalSearch, formatHotkey, parseHotkey, useHotkey } from './components/global-search';
export type { GlobalSearchProps, GlobalSearchSource, Hotkey } from './components/global-search';
export { VirtualList } from './components/virtual-list';
export type { VirtualListProps, VirtualListHandle, VirtualListColumns } from './components/virtual-list';
export { Collection } from './components/collection';
export type {
  CollectionProps,
  CollectionView,
  CollectionImage,
  CollectionItemContext,
} from './components/collection';
export {
  Changelog,
  ChangelogEntryView,
  ChangelogPage,
  NewVersionToast,
  compareSemver,
  fetchChangelog,
  isSemver,
  latestEntry,
  parseChangelog,
  useChangelog,
  watchChangelog,
} from './components/changelog';
export type {
  ChangelogEntry,
  ChangelogPageProps,
  ChangelogProps,
  ChangelogSections,
  UseChangelogOptions,
  UseChangelogResult,
  WatchOptions,
} from './components/changelog';
export { PhonePreview, IOSStatusBar } from './components/phone-preview';
export type { PhonePreviewProps } from './components/phone-preview';
export { IframePreview, IframePreviewOverlay } from './components/iframe-preview';
export type {
  IframePreviewProps,
  IframePreviewOverlayProps,
  IframePreviewDevice,
} from './components/iframe-preview';
export { Nav2DProvider, Nav2DItem, useNav2D } from './components/nav-2d';
export type { Nav2DProviderProps, Nav2DItemProps, Nav2DContextValue } from './components/nav-2d';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
export type {
  TabsActivation,
  TabsContentProps,
  TabsListProps,
  TabsProps,
  TabsTriggerProps,
  TabsVariant,
} from './components/tabs';
export { Button, Tooltip } from './components/button';
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  TooltipProps,
  TooltipSide,
} from './components/button';
export { Input } from './components/input';
export type { InputProps } from './components/input';
export { RichInput, defaultComposePrompt } from './components/rich-input';
export type {
  RichInputProps,
  RichFile,
  GuidelineTag,
  RichSendPayload,
  RichSendButtonProps,
  RichInputHandle,
  ComposeInput,
} from './components/rich-input';
export { CharRoll } from './components/char-roll';
export type { CharRollProps } from './components/char-roll';
export { ProgressiveText } from './components/progressive-text';
export type { ProgressiveTextProps, ProgressiveTextMeta } from './components/progressive-text';
export { ProgressiveList } from './components/progressive-list';
export type { ProgressiveListProps, ProgressiveListItemMeta } from './components/progressive-list';
export { ProgressiveTable } from './components/progressive-table';
export type { ProgressiveTableProps, ProgressiveTableCellContext } from './components/progressive-table';
export { useProgressiveSlot, ProgressiveTimelineSlot } from './components/progressive-timeline';
export type { ProgressiveSlotValue, ProgressiveTimelineSlotProps } from './components/progressive-timeline';
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
export { ResizableLayout } from './components/resizable-layout';
export type {
  ResizableLayoutProps,
  ResizableLayoutHandle,
  ResizableDrawerConfig,
  DrawerSide,
  MobileMode,
} from './components/resizable-layout';
export { FloatingPanel, Dock, DockProvider, useDockContext, useDock } from './components/floating-panel';
export type {
  FloatingPanelProps,
  FloatingPanelHandle,
  DockProps,
  DockContextValue,
  PanelPlacement,
  PanelMeta,
  FloatingGeom,
} from './components/floating-panel';
