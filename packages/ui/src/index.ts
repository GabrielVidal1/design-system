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
  hexToHsl,
  hslToHex,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  hexToHsv,
  hsvToHex,
  isValidHex,
  normalizeHex,
  luminance,
  readableTextColor,
  generatePalette,
  randomColor,
} from './lib/color';
export type { HSL, HSV, Harmony, GenerateOptions } from './lib/color';

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
  useSwipeDismiss,
} from './hooks';
export type {
  LongPressPoint,
  UseCopyOptions,
  UseDebouncedValueOptions,
  UseInfiniteScrollOptions,
  UseLongPressOptions,
  UseSwipeDismissOptions,
} from './hooks';

export { ToastProvider, Toaster, useToast } from './components/toast';
export type { Toast, ToastAction, ToastFn, ToastOptions, ToastPosition, ToastType } from './components/toast';
export { Banner } from './components/banner';
export type { BannerAction, BannerProps, BannerType } from './components/banner';
export { Modal, ModalProvider, useConfirm, useModal } from './components/modal';
export type { ConfirmSpec, ModalProps, ModalSize, ModalSpec } from './components/modal';
export { Tooltip } from './components/tooltip';
export type { TooltipProps, TooltipSide } from './components/tooltip';
export { Popover } from './components/popover';
export type { PopoverProps, PopoverSide, PopoverAlign } from './components/popover';
export { PopConfirm } from './components/pop-confirm';
export type { PopConfirmProps } from './components/pop-confirm';
export { Menu, ContextMenu } from './components/menu';
export type { MenuProps, ContextMenuProps, MenuEntry, MenuItem, MenuSeparatorEntry } from './components/menu';
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
export { Progress } from './components/progress';
export type { ProgressProps, ProgressSize } from './components/progress';
export { StatRow, StatTile } from './components/stat-tile';
export type { StatRowProps, StatTileProps } from './components/stat-tile';
export { Sparkline } from './components/sparkline';
export type { SparklineProps } from './components/sparkline';
export { DataTable } from './components/data-table';
export type { DataTableColumn, DataTableProps, DataTableSort } from './components/data-table';
export { CopyButton } from './components/copy-button';
export type { CopyButtonProps } from './components/copy-button';
export { DropZone, useFileDrop } from './components/drop-zone';
export type { DropZoneProps, FileRejection, UseFileDropOptions } from './components/drop-zone';
export { SearchInput } from './components/search-input';
export type { SearchInputProps } from './components/search-input';
export { TagFilter } from './components/tag-filter';
export type { TagFilterItem, TagFilterProps } from './components/tag-filter';
export { IconPicker } from './components/icon-picker';
export type { IconPickerProps, IconSet, IconComponent } from './components/icon-picker';
export { PalettePicker, PaletteStripes, ColorThemeProvider, useColorTheme, paletteToVars } from './components/palette-picker';
export type {
  PalettePickerProps,
  Palette,
  ColorTheme,
  ColorThemeContextValue,
  ColorThemeProviderProps,
} from './components/palette-picker';
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
export type { ViewerMedia, ViewerMediaKind, ViewerOptions } from './components/image-viewer';
export { SplitView } from './components/split-view';
export type { SplitViewProps } from './components/split-view';
export { FuzzyList, highlightAll, highlightSnippet } from './components/fuzzy-list';
export type { FuzzyListProps, FuzzyRenderContext } from './components/fuzzy-list';
export { GlobalSearch, formatHotkey, parseHotkey, useHotkey } from './components/global-search';
export type { GlobalSearchProps, GlobalSearchSource, Hotkey } from './components/global-search';
export { VirtualList } from './components/virtual-list';
export type { VirtualListProps, VirtualListHandle, VirtualListColumns, GroupBy } from './components/virtual-list';
export { AnimatedList } from './components/animated-list';
export type { AnimatedListProps } from './components/animated-list';
export { HoldEditable } from './components/hold-editable';
export type {
  HoldEditableProps,
  HoldEditableItemState,
  HoldEditableStashPlacement,
  HoldEditableHoldTier,
} from './components/hold-editable';
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
export type { PhonePreviewProps, PhonePreviewHandle } from './components/phone-preview';
export {
  PhoneKeyboard,
  PhoneKeyboardProvider,
  PhoneTextField,
  usePhoneText,
  phoneKeyboardHeight,
  PHONE_KEYBOARD_DARK,
  PHONE_KEYBOARD_LIGHT,
  AZERTY,
  QWERTY,
  LAYOUTS as PHONE_KEYBOARD_LAYOUTS,
} from './components/phone-keyboard';
export type {
  PhoneKeyboardProps,
  PhoneKeyboardHandle,
  PhoneKeyboardTheme,
  PhoneKeyboardTypeOptions,
  PhoneKeyboardDeleteOptions,
  PhoneKeyboardReplaceOptions,
  PhoneKeyboardProviderProps,
  PhoneTextFieldProps,
  PhoneTextState,
  PhoneKey,
  PhoneKeyAction,
  PhoneKeyRow,
  PhoneKeyboardLayout,
  PhoneKeyboardLayoutName,
  PhoneKeyboardPage,
} from './components/phone-keyboard';
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
export { BottomNav } from './components/bottom-nav';
export type {
  BottomNavIcon,
  BottomNavLink,
  BottomNavLinkRender,
  BottomNavProps,
  BottomNavSource,
} from './components/bottom-nav';
export { Breadcrumbs } from './components/breadcrumbs';
export type { BreadcrumbItem, BreadcrumbsProps } from './components/breadcrumbs';
export { Pagination } from './components/pagination';
export type { PaginationProps } from './components/pagination';
export { Button } from './components/button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button';
export { Input } from './components/input';
export type { InputProps } from './components/input';
export { Textarea } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { Field } from './components/field';
export type { FieldProps } from './components/field';
export { Switch } from './components/switch';
export type { SwitchProps, SwitchSize } from './components/switch';
export { Checkbox } from './components/checkbox';
export type { CheckboxProps, CheckboxSize } from './components/checkbox';
export { RadioGroup, Radio } from './components/radio';
export type { RadioGroupProps, RadioProps, RadioSize } from './components/radio';
export { Slider } from './components/slider';
export type { SliderProps } from './components/slider';
export { Select } from './components/select';
export type { SelectOption, SelectProps } from './components/select';
export { RichInput, useSavedDrafts, findAutoTagMatches } from './components/rich-input';
export type {
  AutoTagConfig,
  AutoTagMatch,
  RichInputProps,
  RichFile,
  RichTag,
  MasterSwitchConfig,
  RichDraft,
  RichSendPayload,
  RichSendButtonProps,
  RichInputHandle,
  ComposeInput,
  SavedDrafts,
  RichToolbarItem,
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
export { smootherstep, normalizeCatchUp, makeCatchUpClock } from './lib/catch-up';
export type { CatchUpConfig, CatchUpEasing } from './lib/catch-up';
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
export { CodeArea, FileEditor, Markdown, MenuBar, codeTheme, detectLanguage } from './components/file-editor';
export type {
  CodeAreaProps,
  FileEditorMenu,
  FileEditorMenuEntry,
  FileEditorMenuItem,
  FileEditorMode,
  FileEditorProps,
  MarkdownProps,
} from './components/file-editor';
export { ResizableLayout } from './components/resizable-layout';
export type {
  ResizableLayoutProps,
  ResizableLayoutHandle,
  ResizableDrawerConfig,
  DrawerSide,
  MobileMode,
} from './components/resizable-layout';
export { ColorPicker } from './components/color-picker';
export type { ColorPickerProps } from './components/color-picker';
export { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from './components/toolbar';
export type { ToolbarProps, ToolbarButtonProps, ToolbarGroupProps } from './components/toolbar';
export { InspectorPanel, InspectorRow, InspectorSection } from './components/inspector-panel';
export type {
  InspectorPanelProps,
  InspectorRowProps,
  InspectorSectionProps,
} from './components/inspector-panel';
export { EditorStage } from './components/editor-stage';
export type {
  EditorStageProps,
  EditorStageHandle,
  StageViewport,
  StagePointerEvent,
} from './components/editor-stage';
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
