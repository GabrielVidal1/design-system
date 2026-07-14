import { useEffect, useRef, useState, type Key, type ReactNode } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Cpu,
  FileText,
  Inbox,
  Layers,
  Plus,
  Save,
  Settings2,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Changelog,
  type ChangelogEntry,
  NewVersionToast,
  useChangelog,
  Collection,
  type CollectionView,
  CopyButton,
  DataTable,
  type DataTableColumn,
  Dock,
  DockProvider,
  DropZone,
  EmptyState,
  FloatingPanel,
  FuzzyList,
  GlobalSearch,
  IframePreview,
  ImageViewerProvider,
  useImageViewer,
  Input,
  Modal,
  ModalProvider,
  Nav2DProvider,
  Nav2DItem,
  useNav2D,
  CharRoll,
  PhonePreview,
  Progress,
  ProgressiveBash,
  type BashEntry,
  type ProgressiveBashHandle,
  ProgressiveImage,
  ProgressiveList,
  ProgressiveTable,
  ProgressiveText,
  ProgressiveTimelineSlot,
  useProgressiveSlot,
  RelativeTime,
  ResizableLayout,
  type ResizableLayoutHandle,
  SearchInput,
  Skeleton,
  SkeletonText,
  Spinner,
  StatRow,
  StatTile,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeToggle,
  ToastProvider,
  ViewableImage,
  VirtualList,
  cn,
  fmtBytes,
  fmtCost,
  fmtDuration,
  fmtNum,
  relTime,
  useConfirm,
  useCopyToClipboard,
  useInfiniteScroll,
  useIsMobile,
  useLocalStorage,
  useLongPress,
  useModal,
  useTheme,
  useToast,
} from '@gabvdl/ui';

import {
  CnIcon,
  ButtonIcon,
  ChangelogIcon,
  CharRollIcon,
  CollectionIcon,
  CopyButtonIcon,
  DataTableIcon,
  DropZoneIcon,
  EmptyStateIcon,
  FloatingPanelIcon,
  FormatIcon,
  FuzzyListIcon,
  GlobalSearchIcon,
  HooksIcon,
  IframePreviewIcon,
  ImageViewerIcon,
  InputIcon,
  ModalIcon,
  Nav2DIcon,
  PhonePreviewIcon,
  ProgressIcon,
  ProgressiveBashIcon,
  ProgressiveImageIcon,
  ProgressiveListIcon,
  ProgressiveTableIcon,
  ProgressiveTextIcon,
  ProgressiveTimelineIcon,
  RelativeTimeIcon,
  ResizableLayoutIcon,
  RichInputIcon,
  SearchInputIcon,
  SkeletonIcon,
  SpinnerIcon,
  StatTileIcon,
  StatusBadgeIcon,
  ThemeToggleIcon,
  ToastIcon,
  ViewableImageIcon,
  VirtualListIcon,
  ElementPickerIcon,
  TabsIcon,
} from './icons';
import pkg from '@gabvdl/ui/package.json';
import { SandpackProvider, SandpackCodeEditor, type SandpackTheme } from '@codesandbox/sandpack-react';
import { RichInputPage } from './pages/RichInputPage';
import { ElementPickerPage } from './pages/ElementPickerPage';
import { StartPage } from './pages/StartPage';
import { ThemingPage } from './pages/ThemingPage';
import { ChangelogDocPage } from './pages/ChangelogPage';
import { DemosIndexPage } from './pages/demos/DemosIndexPage';
import { ChatDemoPage } from './pages/demos/ChatDemoPage';
import { SearchDemoPage } from './pages/demos/SearchDemoPage';
import { JobsDemoPage } from './pages/demos/JobsDemoPage';
import { fullUrl, nodes, specimenFulls, specimens, thumbUrl, type Node } from './data';
import { loadSearchIndex, type IndexEntry } from './search';

/** Always the published package's version — read from its package.json at build time. */
const VERSION = pkg.version;
const REPO = 'https://gitea.lab.gabvdl.xyz/gabrielvidal/design-system';

/* ─── Groups ──────────────────────────────────────────────────────────────── */
const GROUPS = [
  'Media',
  'Data display',
  'Navigation',
  'Inputs',
  'Animation',
  'Feedback',
  'Layout',
  'Hooks',
  'Utilities',
] as const;
type Group = (typeof GROUPS)[number];

const GROUP_OF: Record<string, Group> = {
  'image-viewer': 'Media',
  'viewable-image': 'Media',
  'progressive-image': 'Media',
  'fuzzy-list': 'Data display',
  'global-search': 'Navigation',
  'virtual-list': 'Data display',
  collection: 'Data display',
  'progressive-table': 'Data display',
  'data-table': 'Data display',
  'stat-tile': 'Data display',
  progress: 'Data display',
  'status-badge': 'Data display',
  'relative-time': 'Data display',
  'nav-2d': 'Navigation',
  tabs: 'Navigation',
  button: 'Inputs',
  input: 'Inputs',
  'rich-input': 'Inputs',
  'search-input': 'Inputs',
  'drop-zone': 'Inputs',
  'copy-button': 'Inputs',
  'element-picker': 'Inputs',
  'char-roll': 'Animation',
  'progressive-text': 'Animation',
  'progressive-list': 'Animation',
  'progressive-bash': 'Animation',
  'progressive-timeline': 'Animation',
  changelog: 'Feedback',
  toast: 'Feedback',
  spinner: 'Feedback',
  skeleton: 'Feedback',
  'empty-state': 'Feedback',
  'phone-preview': 'Layout',
  'iframe-preview': 'Layout',
  'floating-panel': 'Layout',
  'resizable-layout': 'Layout',
  modal: 'Layout',
  hooks: 'Hooks',
  cn: 'Utilities',
  theme: 'Utilities',
  format: 'Utilities',
};

const GROUP_BLURB: Record<Group, string> = {
  Media: 'Images — a full-screen viewer, click-to-open thumbnails, and lazy blur-up loading.',
  'Data display': 'Windowed, searchable and reveal-animated lists and tables for large datasets.',
  Navigation:
    'Getting around — tabbed panels, a Cmd-K palette over a generated index, and joystick-driven selection over a 2-D field.',
  Inputs: 'Form primitives, the batteries-included composer, and the file/search/copy controls around them.',
  Animation: 'Typewriter text and staggered reveals that share one timeline.',
  Feedback: 'What the app says back — toasts, spinners, skeletons, empty states, release notes.',
  Layout: 'Device frames, scaffolding, and the modal every project re-implements.',
  Hooks: 'The headless half: gestures, storage, media queries, clipboard, intersection.',
  Utilities: 'Class names, theming and the formatters shared across the lab.',
};

/* ─── Library source, imported raw for the "copy full source" IDE tab ──────── */
const RAW = import.meta.glob('../../../packages/ui/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SOURCE_FILE: Record<string, string> = {
  'image-viewer': 'image-viewer.tsx',
  'viewable-image': 'viewable-image.tsx',
  'progressive-image': 'progressive-image.tsx',
  'fuzzy-list': 'fuzzy-list.tsx',
  'global-search': 'global-search.tsx',
  'virtual-list': 'virtual-list.tsx',
  collection: 'collection.tsx',
  'progressive-text': 'progressive-text.tsx',
  'progressive-list': 'progressive-list.tsx',
  'progressive-table': 'progressive-table.tsx',
  'progressive-bash': 'progressive-bash.tsx',
  'progressive-timeline': 'progressive-timeline.tsx',
  changelog: 'changelog.tsx',
  'phone-preview': 'phone-preview.tsx',
  'iframe-preview': 'iframe-preview.tsx',
  'floating-panel': 'floating-panel.tsx',
  'resizable-layout': 'resizable-layout.tsx',
  'nav-2d': 'nav-2d.tsx',
  tabs: 'tabs.tsx',
  button: 'button.tsx',
  input: 'input.tsx',
  'rich-input': 'rich-input.tsx',
  cn: 'utils.ts',
  toast: 'toast.tsx',
  modal: 'modal.tsx',
  spinner: 'spinner.tsx',
  skeleton: 'skeleton.tsx',
  'empty-state': 'empty-state.tsx',
  'status-badge': 'status-badge.tsx',
  'data-table': 'data-table.tsx',
  'stat-tile': 'stat-tile.tsx',
  progress: 'progress.tsx',
  'copy-button': 'copy-button.tsx',
  'element-picker': 'element-picker.tsx',
  'drop-zone': 'drop-zone.tsx',
  'search-input': 'search-input.tsx',
  'relative-time': 'relative-time.tsx',
  theme: 'theme.tsx',
  format: 'format.ts',
  hooks: 'use-overlay.ts',
};

function fullSource(id: string): string | undefined {
  const file = SOURCE_FILE[id];
  if (!file) return undefined;
  const key = Object.keys(RAW).find((k) => k.endsWith('/' + file));
  return key ? RAW[key] : undefined;
}

interface Entry {
  id: string;
  name: string;
  sig: string;
  tag: string;
  Icon: () => ReactNode;
  /** A single live demo (rendered by the generic component page). */
  Demo?: () => ReactNode;
  code?: string;
  /** A component that owns its whole page (multi-demo). Overrides Demo/code. */
  Page?: () => ReactNode;
}

const REGISTRY: Entry[] = [
  {
    id: 'image-viewer',
    name: 'ImageViewer',
    sig: 'ImageViewerProvider · useImageViewer',
    tag: 'context',
    Icon: ImageViewerIcon,
    Demo: ImageViewerDemo,
    code: `const { open } = useImageViewer()
open(urls, 0) // full-screen: zoom · pan · swipe`,
  },
  {
    id: 'nav-2d',
    name: 'Nav2D',
    sig: 'Nav2DProvider · Nav2DItem · useNav2D',
    tag: 'context',
    Icon: Nav2DIcon,
    Demo: Nav2DDemo,
    code: `<Nav2DProvider>            {/* full-page capture blocker */}
  <Nav2DItem onActivate={fire}>
    <button>…</button>       {/* ← ringed when selected */}
  </Nav2DItem>
  {/* …more targets… */}
</Nav2DProvider>

// hold + drag = joystick → 2-D ray → preview → release commits
// single tap = select · double tap = activate`,
  },
  {
    id: 'viewable-image',
    name: 'ViewableImage',
    sig: '(images, index, full, thumb?, alt)',
    tag: 'media',
    Icon: ViewableImageIcon,
    Demo: ViewableImageDemo,
    code: `<ViewableImage
  images={urls} index={i}
  thumb={thumb} full={full} alt="…"
/>`,
  },
  {
    id: 'progressive-image',
    name: 'ProgressiveImage',
    sig: '(full, thumb?, alt)',
    tag: 'media',
    Icon: ProgressiveImageIcon,
    Demo: ProgressiveImageDemo,
    code: `<ProgressiveImage
  thumb={thumb} full={full} alt="…"
  className="aspect-square rounded-lg"
/>  // blur → full on scroll`,
  },
  {
    id: 'fuzzy-list',
    name: 'FuzzyList',
    sig: '<T>(items, keys, renderItem)',
    tag: 'data',
    Icon: FuzzyListIcon,
    Demo: FuzzyListDemo,
    code: `<FuzzyList
  items={nodes}
  keys={['name', 'host', 'desc']}
  getItemKey={(n) => n.name}
  debounce={400}                 // ms after the last keystroke; 0 = every keystroke
  smooth                         // glide rows as each keystroke re-ranks them
  renderItem={({ highlight }) => (
    <Row>
      <b>{highlight('name')}</b>
      <p>{highlight('desc', { snippet: true })}</p>
    </Row>
  )}
/>

// The query is quote-aware:
//   traefik            fuzzy
//   "traefik"          exact, case-insensitive substring
//   parser "utils.ts"  fuzzy 'parser' AND contains 'utils.ts'
// Exact and fuzzy hits are both highlighted. Typing stays instant —
// only the Fuse pass trails, by 'debounce' ms (default 400).`,
  },
  {
    id: 'global-search',
    name: 'GlobalSearch',
    sig: '<T>(items, keys, onSelect, searchKey?)',
    tag: 'palette',
    Icon: GlobalSearchIcon,
    Demo: GlobalSearchDemo,
    code: `<GlobalSearch
  searchKey="Ctrl+K"                 // "Mod+K" = ⌘ on Mac, Ctrl elsewhere · null = no shortcut
  items={loadSearchIndex}            // array, or a loader run on first open
  keys={['name', 'summary', 'props']}
  titleKey="name"
  descriptionKey="summary"
  badgeKey="kind"
  onSelect={(e) => navigate(e.route)}
/>

// Modal + FuzzyList (debounced, quote-aware) + VirtualList.
// The index above is generated at build time — a Vite plugin walks
// packages/ui/src with the TypeScript compiler API and writes
// public/search-index.json: one entry per component, hook, util AND prop.`,
  },
  {
    id: 'tabs',
    name: 'Tabs',
    sig: '(value?, defaultValue?, onValueChange?, variant?, activation?, swipe?)',
    tag: 'navigation',
    Icon: TabsIcon,
    Demo: TabsDemo,
    code: `<Tabs defaultValue="logs" variant="underline">
  <TabsList aria-label="Job">
    <TabsTrigger value="logs" icon={<ScrollText />}>Logs</TabsTrigger>
    <TabsTrigger value="config" badge={<Badge>3</Badge>}>Config</TabsTrigger>
    <TabsTrigger value="raw" disabled>Raw</TabsTrigger>
  </TabsList>

  <TabsContent value="logs">…</TabsContent>
  <TabsContent value="config" keepMounted>…</TabsContent>
</Tabs>

// variant  underline · pill · segmented   (the indicator slides between tabs)
// swipe    flick the panel left/right on touch — axis-locked, so it never
//          hijacks a vertical scroll or a horizontally scrollable child
// the strip scrolls instead of wrapping · ← → Home End · roving tabindex
// activation="manual" moves focus without selecting (panels that fetch)`,
  },
  {
    id: 'virtual-list',
    name: 'VirtualList',
    sig: '<T>(items, renderItem, columns?, smooth?, smoothDuration?, onEndReached?)',
    tag: 'data',
    Icon: VirtualListIcon,
    Demo: VirtualListDemo,
    code: `<VirtualList
  items={rows}                  // re-sorted as data changes
  className="h-96"              // bounded height
  estimateSize={56}             // heights are then measured
  smooth                        // glide rows to their new slot on reorder
  smoothDuration={520}          // …at your own pace (ms; default 520)
  smoothEasing="cubic-bezier(0.65, 0, 0.35, 1)"   // ease-in-out by default
  getItemKey={(row) => row.id}  // stable identity — required for smooth
  hasMore={hasMore}
  loading={loading}
  onEndReached={loadNextPage}   // infinite lazy load
  renderItem={(row) => <Row {...row} />}
/>

// A row travelling UP is stacked over the rows it overtakes (which are, by
// definition, sliding down to make room), so the swap reads as one card
// passing in front of another rather than vanishing behind it.

// …or a windowed CARD GRID — items are chunked into rows of N, so the
// virtualizer still measures one row at a time:
<VirtualList items={photos} columns={{ base: 2, md: 3, lg: 4 }} estimateSize={220} … />`,
  },
  {
    id: 'collection',
    name: 'Collection',
    sig: '<T>(items, getTitle, getImage?, searchKeys?)',
    tag: 'data',
    Icon: CollectionIcon,
    Demo: CollectionDemo,
    code: `<Collection
  items={photos}
  getTitle={(p) => p.name}
  getSubtitle={(p) => p.album}
  getImage={(p) => ({ thumb: p.thumb, full: p.url })}  // lazy blur-up
  searchKeys={['name', 'album']}   // ← adds the search box (via FuzzyList)
  persistKey="photos.view"         // ← remembers cards-vs-list across reloads
  columns={{ base: 2, md: 3, lg: 4 }}
  onSelect={open}
  listClassName="h-[600px]"        // windowed — needs a bounded height
/>

// generic slots: renderMeta · renderActions · renderOverlay
// full overrides:  renderCard · renderRow`,
  },
  {
    id: 'char-roll',
    name: 'CharRoll',
    sig: 'value · stagger · maxRotations — tally-counter roll',
    tag: 'animation',
    Icon: CharRollIcon,
    Demo: CharRollDemo,
    code: `// live counters roll instead of blinking to the new value
<CharRoll value={fmtCost(cost)} />

// odometer feel: end-to-start stagger + the rightmost
// changed digits spinning extra revolutions
<CharRoll value={fmtNum(tokens)} stagger={40} maxRotations={2} />

// arbitrary strings work too — changed chars flip once
<CharRoll value={job.status} align="start" />`,
  },
  {
    id: 'progressive-text',
    name: 'ProgressiveText',
    sig: 'text · speed · delay · deleteSpeed',
    tag: 'animation',
    Icon: ProgressiveTextIcon,
    Demo: ProgressiveTextDemo,
    code: `// types at a constant rate; on text change it
// backspaces to the common prefix, then rewrites
<ProgressiveText text={line} speed={40} caret />

// wrap the partial text (markdown, streaming…)
<ProgressiveText text={body} speed={55} as="div">
  {(visible) => <Markdown source={visible} />}
</ProgressiveText>`,
  },
  {
    id: 'progressive-list',
    name: 'ProgressiveList',
    sig: '<T>(items, speed, delay, getDelay?)',
    tag: 'animation',
    Icon: ProgressiveListIcon,
    Demo: ProgressiveListDemo,
    code: `// reveals items in order via a timeline context: each
// row waits for the PREVIOUS row's inner animation before
// it appears. Rows with a ProgressiveText report their
// duration; plain rows fall back to a constant \`speed\`.
<ProgressiveList items={rows} speed={3} delay={0.15}>
  {(row, i, { isNew }) => (
    <ProgressiveText text={row.text} instant={!isNew} />
  )}
</ProgressiveList>

// any custom element can join the timeline:
const { active, report, finish } = useProgressiveSlot()`,
  },
  {
    id: 'progressive-table',
    name: 'ProgressiveTable',
    sig: 'headers · rows · speed · initialReveal',
    tag: 'animation',
    Icon: ProgressiveTableIcon,
    Demo: ProgressiveTableDemo,
    code: `// reveals the header first, then body rows one at a
// time. Same timeline as ProgressiveList/Text, so it
// nests inside a feed and hands off when the last row
// lands. Cells are arbitrary nodes (markdown, code…).
<ProgressiveTable
  headers={['Feature', 'Before', 'After']}
  rows={rows}          // ReactNode[][]
  speed={6}            // rows / sec
  initialReveal={0}    // 0 = animate the whole table
/>`,
  },
  {
    id: 'progressive-bash',
    name: 'ProgressiveBash',
    sig: 'entries · timestamp gaps · catchUp · stickyPrompt · subparts',
    tag: 'animation',
    Icon: ProgressiveBashIcon,
    Demo: ProgressiveBashSection,
    code: `// an animated terminal: types each command char-by-char,
// then reveals its output line-by-line, colorized by a
// shell/pager tokenizer. Sparse timestamps are compressed
// into a lively, bounded, continuous playback.
const entries: BashEntry[] = [
  { id: '1', command: 'git status', output: '…', timestamp: t0 },
  { id: '2', command: 'npm run build', output: '=== Build ===\\n✓ done',
    timestamp: t0 + 4000 },
]
<ProgressiveBash entries={entries} className="h-80" />

// or stream imperatively via the handle
const ref = useRef<ProgressiveBashHandle>(null)
<ProgressiveBash apiRef={ref} />
ref.current?.push({ id: '3', command: 'ls', output: '…' })
ref.current?.skipToEnd()

// catchUp: entries already in the past mount fully-written
// (a reload never re-types a finished session)
<ProgressiveBash entries={entries} catchUp={Date.now()} />

// stickyPrompt: pin each command's prompt to the top while
// its output scrolls past
<ProgressiveBash entries={entries} stickyPrompt />

// [experimental] split a chained echo "Title..[value]" && cmd
// command into one separately-typed command block per step
<ProgressiveBash
  entries={[{ id: '1',
    command: 'echo "Build..[vite]" && vite build',
    output: 'Build..[vite]\\n✓ built in 1.8s' }]}
  experimentalSubparts
/>`,
  },
  {
    id: 'progressive-timeline',
    name: 'ProgressiveTimeline',
    sig: 'ProgressiveTimelineSlot · useProgressiveSlot',
    tag: 'animation',
    Icon: ProgressiveTimelineIcon,
    Demo: ProgressiveTimelineDemo,
    code: `// the timeline underneath ProgressiveList/Text/Bash, exposed:
// each slot reveals in turn, waiting for the previous slot's
// inner animation before it appears.
{steps.map((step, i) =>
  i <= head && (
    <ProgressiveTimelineSlot
      key={step.id}
      active={i === head}                    // the current head animates
      fallbackMs={600}                       // plain content hands off after this
      onComplete={() => setHead((h) => h + 1)}
    >
      <Row step={step} />   {/* a ProgressiveText inside reports its
                                typing duration automatically */}
    </ProgressiveTimelineSlot>
  ),
)}

// any custom element can join the timeline:
const { active, report, finish } = useProgressiveSlot()
useEffect(() => {
  if (!active) return
  const done = report(1200)  // "I'll animate for 1.2s"
  // …start the animation; call done() to hand off early
}, [active])`,
  },
  {
    id: 'changelog',
    name: 'Changelog',
    sig: 'entries? · trigger · reload toast · ChangelogPage · useChangelog',
    tag: 'feedback',
    Icon: ChangelogIcon,
    Demo: ChangelogDemo,
    code: `// npx gabvdl-changelog  → public/changelog.jsonl (bundled CLI,
// from conventional commits or a curated CHANGELOG.md)
<Changelog />              // trigger + modal + "new version" reload toast
<ChangelogPage />          // full release history for a /changelog route

// or build your own UI on the data layer:
const { entries, newVersion, dismissNewVersion } =
  useChangelog({ watch: true })`,
  },
  {
    id: 'phone-preview',
    name: 'PhonePreview',
    sig: '(children | src, island, statusBar)',
    tag: 'layout',
    Icon: PhonePreviewIcon,
    Demo: PhonePreviewDemo,
    code: `// frame any tree…
<PhonePreview statusBar>
  <App />
</PhonePreview>

// …or embed a live app, scaled to device width
<PhonePreview src="https://note.dev.gabvdl.xyz" />`,
  },
  {
    id: 'iframe-preview',
    name: 'IframePreview',
    sig: 'trigger · url field · actions · full-screen iframe',
    tag: 'layout',
    Icon: IframePreviewIcon,
    Demo: IframePreviewDemo,
    code: `// a trigger (button, card, thumbnail…) that opens the page
// full-screen: editable address bar, a reload that really
// re-fetches, phone/desktop tiers, your own controls.
<IframePreview
  url="https://note.dev.gabvdl.xyz"
  label="Open preview"
  cacheBust                       // fresh fetch, never the cache
  actions={<Button size="sm" variant="ghost">Deploy log</Button>}
/>

// or drive the overlay yourself — trigger lives elsewhere
<IframePreviewOverlay
  open={open}
  onClose={() => setOpen(false)}
  url={deployedUrl}
  onUrlChange={setDeployedUrl}
/>`,
  },
  {
    id: 'floating-panel',
    name: 'FloatingPanel',
    sig: 'DockProvider · FloatingPanel · Dock — drag · resize · tabs · close/reopen',
    tag: 'layout',
    Icon: FloatingPanelIcon,
    Demo: FloatingPanelDemo,
    code: `// draggable/resizable windows that snap into a Dock;
// panels sharing one dock become tabs. Drag a header
// onto the dock to snap in, drag a tab out to float.
// \`closable\` panels close like tabs — the dock grows a
// "+" that brings them back, so a closed panel is never
// unreachable and the parent keeps no isOpen flags.
<DockProvider>
  <FloatingPanel id="terminal" dockId="d1" title="Terminal" closable>
    <TerminalBody />
  </FloatingPanel>
  <FloatingPanel id="details" dockId="d1" title="Details" closable defaultClosed>
    <DetailsBody />
  </FloatingPanel>
  <Dock id="d1" className="h-64" />
</DockProvider>

// Collapse the region hosting a dock down to its "+" strip
// when every panel is closed — \`collapsedSize\` is in pixels.
const dock = useDock('d1');
<ResizableLayout
  bottom={{ content: <Dock id="d1" />, collapsedSize: 36 }}
  bottomOpen={!dock.isEmpty}
>
  {thread}
</ResizableLayout>`,
  },
  {
    id: 'resizable-layout',
    name: 'ResizableLayout',
    sig: 'left · right · top · bottom — resizable panels on desktop, panel-or-drawer on mobile',
    tag: 'layout',
    Icon: ResizableLayoutIcon,
    Demo: ResizableLayoutDemo,
    code: `// four-slot shell: drag to resize on desktop. On mobile each
// side picks its own behaviour with mobileMode — 'drawer' (an
// overlay with a backdrop, which takes focus) or 'panel' (in
// flow, splitting the screen, center stays usable).
const ref = useRef<ResizableLayoutHandle>(null)

<ResizableLayout
  ref={ref}
  autoSaveId="app:shell"
  // nav: a sheet you open, use, and dismiss
  left={{ content: <Nav />, defaultSize: 20, mobileMode: 'drawer', mobileWidth: '85%' }}
  right={{ content: <Info />, defaultSize: 24, mobileMode: 'drawer', mobileWidth: '85%' }}
  // composer: must stay reachable — never hide it behind a backdrop
  bottom={{ content: <Composer />, defaultSize: 30, mobileMode: 'panel', mobileHeight: 'auto' }}
  leftOpen={leftOpen} onLeftOpenChange={setLeftOpen}
  bottomOpen={bottomOpen} onBottomOpenChange={setBottomOpen}
>
  <Thread />
</ResizableLayout>

ref.current?.toggle('bottom')`,
  },
  {
    id: 'button',
    name: 'Button',
    sig: 'variant · size · icon · loading · tooltip',
    tag: 'shadcn',
    Icon: ButtonIcon,
    Demo: ButtonDemo,
    code: `<Button icon={<Save />}>Save</Button>
<Button size="lg" variant="outline">Large</Button>

// disables itself, swaps the icon for a spinner and
// goes aria-busy; the label is announced to a reader
<Button loading={saving} loadingText="Saving…" icon={<Save />}>
  Save
</Button>

// icon-only: the tooltip doubles as the accessible name
<Button size="icon-sm" icon={<Trash2 />} variant="destructive"
        tooltip="Delete run" tooltipSide="bottom" />

// type defaults to "button" — no accidental form submits
<Button type="submit" icon={<Check />}>Submit</Button>`,
  },
  {
    id: 'input',
    name: 'Input',
    sig: "React.ComponentProps<'input'>",
    tag: 'shadcn',
    Icon: InputIcon,
    Demo: InputDemo,
    code: `<Input placeholder="Search…" />

// persists across reloads (localStorage by default)
<Input cacheKey="draft" cacheLocation="local" />`,
  },
  {
    id: 'rich-input',
    name: 'RichInput',
    sig: 'draft · un-send · files · tags · #mention · history',
    tag: 'shadcn',
    Icon: RichInputIcon,
    Page: RichInputPage,
    code: `<RichInput
  cacheKey="chat"          // persisted draft + history
  undoWindowMs={3000}      // 3s un-send window
  tags={guidelineTags}     // toggle chips + #mention
  accept="image/*"         // multi-file upload
  onSubmit={(p) => send(p.prompt, p.files)}
/>`,
  },
  {
    id: 'element-picker',
    name: 'ElementPicker',
    sig: 'hover · click · press-and-hold — full HTML + parsed',
    tag: 'input',
    Icon: ElementPickerIcon,
    Page: ElementPickerPage,
    code: `<ElementPickerField
  root={pageEl}            // pick inside this only
  value={picked}
  onChange={setPicked}
  filter={(el) => el.matches('.card')}
/>

// each entry: the live node + a serializable parse
picked[0].element  // HTMLElement
picked[0].info     // { tag, kind, text, selector, hierarchy, styles, … }`,
  },
  {
    id: 'toast',
    name: 'Toast',
    sig: 'ToastProvider · useToast — types · actions · update',
    tag: 'context',
    Icon: ToastIcon,
    Demo: ToastDemo,
    code: `<ToastProvider position="bottom-right">
  <App />
</ToastProvider>

const toast = useToast()
toast.success('Deployed')
toast.error('Build failed', {
  action: { label: 'Logs', href: logsUrl },
})

// a pending toast, settled in place when the work lands
const id = toast.loading('Uploading…')
toast.update(id, 'Uploaded', { type: 'success' })`,
  },
  {
    id: 'modal',
    name: 'Modal',
    sig: 'Modal · ModalProvider · useModal · useConfirm',
    tag: 'overlay',
    Icon: ModalIcon,
    Demo: ModalDemo,
    code: `// controlled
<Modal open={open} onClose={close} title="Details" footer={<Button>Save</Button>}>
  <Body />
</Modal>

// …or imperative, from any handler
const modal = useModal()
modal.open({ title: 'Details', content: <Body /> })

// window.confirm, but yours — resolves false on Escape / scrim
const confirm = useConfirm()
if (await confirm({ title: 'Delete note?', destructive: true })) remove()

// portal · Escape · scrim-click · scroll-lock · focus trap
// + bottom-sheet on phones`,
  },
  {
    id: 'spinner',
    name: 'Spinner',
    sig: 'size · label · center',
    tag: 'feedback',
    Icon: SpinnerIcon,
    Demo: SpinnerDemo,
    code: `<Spinner />
<Spinner size="lg" label="Loading models…" center />`,
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    sig: 'Skeleton · SkeletonText · SkeletonGrid',
    tag: 'feedback',
    Icon: SkeletonIcon,
    Demo: SkeletonDemo,
    code: `<Skeleton className="size-12 rounded-full" />
<SkeletonText lines={3} />
<SkeletonGrid count={6} aspect="aspect-video" />`,
  },
  {
    id: 'empty-state',
    name: 'EmptyState',
    sig: 'icon · title · description · action',
    tag: 'feedback',
    Icon: EmptyStateIcon,
    Demo: EmptyStateDemo,
    code: `<EmptyState
  icon={<Inbox />}
  title="No jobs yet"
  description="Queue one and it shows up here."
  action={<Button size="sm">New job</Button>}
/>`,
  },
  {
    id: 'status-badge',
    name: 'StatusBadge',
    sig: 'Badge · StatusBadge — status → tone map',
    tag: 'data',
    Icon: StatusBadgeIcon,
    Demo: StatusBadgeDemo,
    code: `// the lab's job lifecycle, same colour in every service
<StatusBadge status={job.status} />

// extend the map for a domain of your own
<StatusBadge status="seeding" meta={{
  seeding: { label: 'Seeding', tone: 'violet', Icon: Sprout },
}} />

// or the bare pill
<Badge tone="amber" dot>beta</Badge>`,
  },
  {
    id: 'relative-time',
    name: 'RelativeTime',
    sig: 'date · every — ticking <time>',
    tag: 'data',
    Icon: RelativeTimeIcon,
    Demo: RelativeTimeDemo,
    code: `<RelativeTime date={job.createdAt} />
// "4m ago", re-rendered every 30s, absolute date on hover
// accepts ISO strings, Dates, epoch ms *or* epoch seconds`,
  },
  {
    id: 'progress',
    name: 'Progress',
    sig: 'value · max · tone — determinate bar',
    tag: 'data',
    Icon: ProgressIcon,
    Demo: ProgressDemo,
    code: `<Progress value={job.progress} label={job.name} showValue />

// tones match StatusBadge, so a running job's bar is sky
<Progress value={62} tone="emerald" size="md" />

// unknown duration — the endless sweep
<Progress indeterminate label="Waking the GPU box…" />`,
  },
  {
    id: 'stat-tile',
    name: 'StatTile',
    sig: 'StatRow · StatTile — label · value · delta',
    tag: 'data',
    Icon: StatTileIcon,
    Demo: StatTileDemo,
    code: `<StatRow columns={4}>
  <StatTile label="Jobs today" value={128} delta={12}
            hint="3 running" Icon={Layers} />
  <StatTile label="Errors" value={2} delta={-40}
            goodDirection="down" />
  <StatTile label="GPU time" value={fmtDuration(12_640_000)} />
  <StatTile label="Cost" value={fmtCost(1.28)} delta="steady" />
</StatRow>
// values tick over with the CharRoll tally animation`,
  },
  {
    id: 'data-table',
    name: 'DataTable',
    sig: '<T>(data, columns) — sort · select · cards',
    tag: 'data',
    Icon: DataTableIcon,
    Demo: DataTableDemo,
    code: `<DataTable
  data={jobs}
  columns={[
    { key: 'name', header: 'Name', sortable: true },
    { key: 'status', header: 'Status',
      cell: (j) => <StatusBadge status={j.status} /> },
    { key: 'duration', header: 'Took', sortable: true,
      align: 'right', cell: (j) => fmtDuration(j.duration) },
  ]}
  getRowKey={(j) => j.id}
  selectable
  onRowClick={openJob}
/>  // sticky header · aria-sort · cards below 640px`,
  },
  {
    id: 'search-input',
    name: 'SearchInput',
    sig: 'value · onValueChange · shortcut',
    tag: 'input',
    Icon: SearchInputIcon,
    Demo: SearchInputDemo,
    code: `<SearchInput
  value={q}
  onValueChange={setQ}
  shortcut              // ⌘K / "/" focuses, Escape clears
  placeholder="Search services…"
/>`,
  },
  {
    id: 'drop-zone',
    name: 'DropZone',
    sig: 'DropZone · useFileDrop — accept · maxSize · folders',
    tag: 'input',
    Icon: DropZoneIcon,
    Demo: DropZoneDemo,
    code: `<DropZone
  accept="image/*"
  maxFiles={8}
  maxSize={10 * 1024 * 1024}
  recursive                       // walk dropped folders
  onFiles={(files) => upload(files)}
  onReject={(bad) => toast.error(\`\${bad.length} file(s) rejected\`)}
  hint="PNG, JPG or WebP · up to 10 MB"
/>

// headless: drag state + the hidden input, on any element
const { dragging, rootProps, inputProps, open } = useFileDrop({ onFiles })`,
  },
  {
    id: 'copy-button',
    name: 'CopyButton',
    sig: 'value · label · share · useCopyToClipboard',
    tag: 'input',
    Icon: CopyButtonIcon,
    Demo: CopyButtonDemo,
    code: `<CopyButton value={url} label="Copy link" />

// …or drive it yourself
const { copy, copied } = useCopyToClipboard()
// falls back to execCommand on insecure origins (the LAN),
// and can offer the native share sheet first on touch`,
  },
  {
    id: 'theme',
    name: 'ThemeToggle',
    sig: 'useTheme · ThemeToggle · setTheme',
    tag: 'util',
    Icon: ThemeToggleIcon,
    Demo: ThemeDemo,
    code: `<ThemeToggle />                    // sun ⇄ moon
<ThemeToggle variant="segmented" />  // light · system · dark

// no provider needed — one module store, persisted,
// follows the OS when set to "system"
const { theme, isDark, setTheme, toggle } = useTheme()

// <ThemeProvider> only to change the storage key / default
<ThemeProvider storageKey="app-theme" defaultTheme="dark" />`,
  },
  {
    id: 'hooks',
    name: 'hooks',
    sig: 'gestures · storage · media · clipboard · overlay',
    tag: 'hooks',
    Icon: HooksIcon,
    Demo: HooksDemo,
    code: `const isMobile = useIsMobile()               // + useMediaQuery, useIsTouch,
                                            //   usePrefersDark, usePrefersReducedMotion
const [seen, setSeen] = useLocalStorage('seen', false)  // cross-tab synced, quota-safe

const press = useLongPress((pt) => openMenu(pt))        // touch hold + right-click
<div {...press} />

const sentinel = useInfiniteScroll({ hasMore, loading, onLoadMore })
<div ref={sentinel} />                      // loads the next page 600px early

useScrollLock(open)                         // ref-counted — nesting is safe
useEscape(close, open)
const ref = useOutsideClick(close)          // closes on pointerdown, not click`,
  },
  {
    id: 'format',
    name: 'format',
    sig: 'relTime · fmtDuration · fmtBytes · fmtNum · fmtCost',
    tag: 'util',
    Icon: FormatIcon,
    Demo: FormatDemo,
    code: `relTime('2026-07-12T09:00:00Z')  // "4m ago"  (ISO · Date · ms · seconds)
fmtDuration(128_400)             // "2m 08s"
fmtBytes(1_483_776)              // "1.4 MB"
fmtNum(12_402)                   // "12.4k"
fmtCost(0.00412)                 // "$0.0041" — small LLM costs keep their digits

downloadFile('board.csv', csv, 'text/csv')  // anchor + object URL + revoke`,
  },
  {
    id: 'cn',
    name: 'cn',
    sig: '(...ClassValue[]) => string',
    tag: 'util',
    Icon: CnIcon,
    Demo: CnDemo,
    code: `cn('px-2 py-1', isActive && 'px-4', 'text-sm')
// → clsx + tailwind-merge: last conflict wins`,
  },
];

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ModalProvider>
          <ImageViewerProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/c/:id" element={<ComponentPage />} />
              <Route
                path="/start"
                element={
                  <GuidePage title="Getting started">
                    <StartPage />
                  </GuidePage>
                }
              />
              <Route
                path="/theming"
                element={
                  <GuidePage title="Theming">
                    <ThemingPage />
                  </GuidePage>
                }
              />
              <Route
                path="/changelog"
                element={
                  <GuidePage title="Changelog">
                    <ChangelogDocPage />
                  </GuidePage>
                }
              />
              <Route
                path="/demos"
                element={
                  <GuidePage title="Demos">
                    <DemosIndexPage />
                  </GuidePage>
                }
              />
              <Route path="/demos/chat" element={<ChatDemoPage />} />
              <Route path="/demos/search" element={<SearchDemoPage />} />
              <Route path="/demos/jobs" element={<JobsDemoPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            {/* Dogfooded: poll our own changelog.jsonl and prompt a reload
                when a new version of the docs ships while the tab is open. */}
            <UpdateWatcher />
          </ImageViewerProvider>
        </ModalProvider>
      </ToastProvider>
    </HashRouter>
  );
}

/** Poll the deployed changelog and surface the library's reload toast. */
function UpdateWatcher() {
  const { newVersion, dismissNewVersion } = useChangelog({ watch: true });
  if (!newVersion) return null;
  return <NewVersionToast entry={newVersion} onDismiss={dismissNewVersion} />;
}

function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 pb-24">
        <Hero />
        <ImportLine />
        <div className="mt-14 space-y-16">
          {GROUPS.map((group) => {
            const items = REGISTRY.filter((e) => GROUP_OF[e.id] === group);
            if (items.length === 0) return null;
            return (
              <section key={group}>
                <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-3">
                  <div>
                    <h2 className="display text-lg text-foreground">{group}</h2>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">{GROUP_BLURB[group]}</p>
                  </div>
                  <span className="mono shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {String(items.length).padStart(2, '0')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {items.map((e) => (
                    <ComponentCard key={e.id} entry={e} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <Footer />
    </>
  );
}

/** Shell for the standalone guide pages (/start, /theming) — header, scroll, title, footer. */
function GuidePage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${title} — gabvdl/ui`;
    return () => {
      document.title = 'gabvdl/ui';
    };
  }, [title]);
  return (
    <>
      <Header title={title} />
      <main className="mx-auto max-w-3xl px-5 pb-24">{children}</main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <div className="pt-14 pb-4">
      <p className="eyebrow mb-3">React · TypeScript · Tailwind v4</p>
      <h1 className="display max-w-2xl text-4xl text-foreground sm:text-5xl">
        A personal component library, catalogued.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        {REGISTRY.length} tree-shakeable React components built on shadcn primitives — grouped by
        type, each with a live demo and full source you can copy straight into your project.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link to="/start">
          <Button className="mono text-xs uppercase tracking-[0.12em]">Get started</Button>
        </Link>
        <Link to="/theming">
          <Button variant="outline" className="mono text-xs uppercase tracking-[0.12em]">
            Theming
          </Button>
        </Link>
        <a href={REPO} target="_blank" rel="noreferrer">
          <Button variant="outline" className="mono text-xs uppercase tracking-[0.12em]">
            Source <ArrowUpRight className="size-4" />
          </Button>
        </a>
        <code className="mono rounded-md border border-border bg-[var(--surface)] px-3 py-2 text-[13px] text-foreground">
          npm i @gabvdl/ui
        </code>
      </div>
    </div>
  );
}

function ComponentPage() {
  const { id } = useParams();
  const entry = REGISTRY.find((e) => e.id === id);
  const name = entry?.name;

  useEffect(() => {
    if (!name) return;
    window.scrollTo(0, 0);
    document.title = `${name} — gabvdl/ui`;
    return () => {
      document.title = 'gabvdl/ui';
    };
  }, [name]);

  if (!entry) return <Navigate to="/" replace />;

  return (
    <>
      <Header title={entry.name} />
      <main className="pb-24">
        {entry.Page ? (
          <>
            <entry.Page />
            <div className="mx-auto max-w-3xl px-5">
              <PropsSection id={entry.id} />
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-3xl px-5">
            <div className="py-8">
              <p className="eyebrow mb-2">{GROUP_OF[entry.id] ?? entry.tag}</p>
              <h1 className="display text-3xl text-foreground">{entry.name}</h1>
              <p className="mono mt-2 text-[13px] text-muted-foreground">{entry.sig}</p>
            </div>
            <p className="eyebrow mb-2.5 text-muted-foreground">Live demo</p>
            <div className="rounded-xl border border-border bg-[var(--surface-2)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {entry.Demo?.()}
            </div>
            {entry.code && (
              <div className="mt-6">
                <CodeIDE name={entry.name} usage={entry.code} source={fullSource(entry.id)} />
              </div>
            )}
            <PropsSection id={entry.id} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

/* ─── Props tables — generated at build time from the library's TypeScript ─── */

/** One prop row, straight out of the search index: `VirtualList.overscan` → owner + prop. */
interface PropRow {
  owner: string;
  prop: string;
  /** `?: number` — leading `?` marks an optional prop. */
  type: string;
  summary: string;
  default?: string;
}

/** Full name as the palette knows it (`VirtualList.overscan`) — the jump target key. */
const propKey = (p: PropRow) => `${p.owner}.${p.prop}`;

/** TSDoc summaries carry `backtick` spans — render them as real inline code. */
const inlineCode = (s: string): ReactNode =>
  s.split(/`([^`]+)`/).map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="mono text-[0.9em] text-foreground/85">
        {part}
      </code>
    ) : (
      part
    ),
  );

/**
 * The per-type props tables under a component page's usage block. The data is
 * the same build-time `search-index.json` the Cmd-K palette searches — the Vite
 * plugin reads names, types, TSDoc summaries and defaults (destructuring
 * initializers or `@default` tags) off the library source, so nothing here is
 * hand-maintained. Desktop gets a table; on mobile each prop collapses to an
 * `h5` (name + default on one line) with the description below.
 *
 * When the palette selects a prop it navigates here with `?prop=Owner.name`,
 * and the matching row is scrolled into view and flashed.
 */
function PropsSection({ id }: { id: string }) {
  const [rows, setRows] = useState<PropRow[] | null>(null);
  const [params] = useSearchParams();
  const target = params.get('prop');

  useEffect(() => {
    let alive = true;
    loadSearchIndex()
      .then((entries) => {
        if (!alive) return;
        const optionalLast = (a: PropRow, b: PropRow) =>
          Number(a.type.startsWith('?')) - Number(b.type.startsWith('?')) ||
          a.prop.localeCompare(b.prop);
        setRows(
          entries
            .filter((e) => e.kind === 'prop' && e.id === id)
            .map((e) => {
              const [owner, ...rest] = e.name.split('.');
              return { owner, prop: rest.join('.'), type: e.type ?? '', summary: e.summary, default: e.default };
            })
            .sort((a, b) => a.owner.localeCompare(b.owner) || optionalLast(a, b)),
        );
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [id]);

  // Jump to the prop the palette selected — the row exists only once the index
  // has loaded, so this waits on `rows`. Both layouts carry the same data-prop;
  // scroll whichever one is currently displayed.
  useEffect(() => {
    if (!target || !rows?.length) return;
    const frame = requestAnimationFrame(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-prop="${CSS.escape(target)}"]`));
      const el = els.find((e) => e.offsetParent !== null) ?? els[0];
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      el.classList.add('prop-flash');
      setTimeout(() => el.classList.remove('prop-flash'), 2000);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, rows]);

  if (!rows?.length) return null;

  const owners = [...new Set(rows.map((r) => r.owner))];

  return (
    <section className="mt-10">
      <p className="eyebrow mb-2.5 text-muted-foreground">Props</p>
      <div className="space-y-8">
        {owners.map((owner) => {
          const props = rows.filter((r) => r.owner === owner);
          return (
            <div key={owner}>
              {owners.length > 1 && (
                <h4 className="mono mb-2 text-sm text-foreground">
                  {owner}
                  <span className="text-muted-foreground">Props</span>
                </h4>
              )}

              {/* Desktop: the table. */}
              <div className="hidden overflow-x-auto rounded-xl border border-border bg-[var(--surface)] sm:block">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      {['Prop', 'Default', 'Description'].map((h) => (
                        <th key={h} className="eyebrow px-4 py-2.5 font-normal text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {props.map((p) => (
                      <tr key={p.prop} data-prop={propKey(p)} className="border-b border-border last:border-b-0">
                        <td className="min-w-36 px-4 py-2.5 align-top">
                          <span className="mono text-foreground">{p.prop}</span>
                          {p.type.startsWith('?') && <span className="mono text-muted-foreground">?</span>}
                          <div className="mono mt-0.5 max-w-56 truncate text-[11px] text-muted-foreground" title={p.type}>
                            {p.type.replace(/^\??: /, '')}
                          </div>
                        </td>
                        <td className="mono max-w-40 px-4 py-2.5 align-top text-[12px] text-[color:var(--cyan-deep)]">
                          {p.default ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 align-top leading-snug text-muted-foreground">
                          {inlineCode(p.summary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: name + default on one line, description below — no table. */}
              <div className="divide-y divide-border rounded-xl border border-border bg-[var(--surface)] px-4 sm:hidden">
                {props.map((p) => (
                  <div key={p.prop} data-prop={propKey(p)} className="py-3">
                    <h5 className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="mono min-w-0 truncate text-foreground">
                        {p.prop}
                        {p.type.startsWith('?') && <span className="text-muted-foreground">?</span>}
                      </span>
                      {p.default && (
                        <span className="mono shrink-0 text-[12px] text-[color:var(--cyan-deep)]">= {p.default}</span>
                      )}
                    </h5>
                    <div className="mono mt-0.5 truncate text-[11px] text-muted-foreground">
                      {p.type.replace(/^\??: /, '')}
                    </div>
                    {p.summary && (
                      <p className="mt-1 leading-snug text-[13px] text-muted-foreground">{inlineCode(p.summary)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── The catalogue's own Cmd-K palette ────────────────────────────────────── */

/** Ids that have a page — everything else in the index still searches, but lands
 * back on the catalogue rather than a dead route. */
const HAS_PAGE = new Set(REGISTRY.map((e) => e.id));

const KIND_LABEL: Record<IndexEntry['kind'], string> = {
  component: 'component',
  hook: 'hook',
  util: 'util',
  prop: 'prop',
};

/**
 * The library searching itself: `GlobalSearch` over `search-index.json`, which
 * the Vite plugin regenerates from the TypeScript source on every build — so a
 * new component (and every prop it declares) is discoverable without anyone
 * touching a list.
 */
function DocsSearch({ trigger = 'icon' }: { trigger?: 'icon' | 'bar' }) {
  const navigate = useNavigate();
  return (
    <GlobalSearch<IndexEntry>
      items={loadSearchIndex}
      searchKey="Ctrl+K"
      trigger={trigger}
      triggerLabel="Search components…"
      placeholder="Search components, hooks, props…"
      keys={[
        { name: 'name', weight: 3 },
        { name: 'summary', weight: 1 },
        { name: 'props', weight: 0.8 },
        { name: 'exports', weight: 0.5 },
        { name: 'id', weight: 0.5 },
      ]}
      getItemKey={(e) => `${e.kind}:${e.name}`}
      emptyState="Nothing in the index matches."
      onSelect={(e) => {
        if (HAS_PAGE.has(e.id)) {
          // A prop lands on its row in the page's props table, not just the page.
          navigate(e.kind === 'prop' ? `/c/${e.id}?prop=${encodeURIComponent(e.name)}` : `/c/${e.id}`);
          return;
        }
        // No card of its own — land on the card documenting the same source
        // file if one exists, else the catalogue. Never a dead /c/ route.
        const file = e.file.split('/').pop() ?? '';
        const parent = REGISTRY.find((r) => SOURCE_FILE[r.id] === file);
        navigate(parent ? `/c/${parent.id}` : '/');
      }}
      renderItem={({ item, highlight, active }) => (
        <div
          className={cn(
            'flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors',
            active ? 'border-border bg-muted' : 'border-transparent',
          )}
        >
          <div className="min-w-0">
            <div className="mono truncate text-sm text-foreground">
              {highlight('name')}
              {item.type && <span className="ml-1.5 text-muted-foreground">{item.type}</span>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
              {item.summary ? highlight('summary', { snippet: true }) : item.file}
            </p>
          </div>
          <span className="mono shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--cyan-deep)]">
            {KIND_LABEL[item.kind]}
          </span>
        </div>
      )}
    />
  );
}

function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[color:var(--header-bg)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-3">
          {title ? (
            <Link
              to="/"
              className="mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> catalogue
            </Link>
          ) : (
            <Link to="/" className="flex items-baseline gap-2">
              <span className="mono text-sm text-foreground">gabvdl</span>
              <span className="mono text-sm text-[color:var(--cyan)]">/ui</span>
              <span className="mono text-[11px] text-muted-foreground">v{VERSION}</span>
            </Link>
          )}
          {title && <span className="mono text-sm text-foreground">{title}</span>}
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {!title && (
            <nav className="hidden items-center gap-4 sm:flex">
              <Link
                to="/start"
                className="mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Start
              </Link>
              <Link
                to="/theming"
                className="mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Theming
              </Link>
              <Link
                to="/demos"
                className="mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Demos
              </Link>
              <Link
                to="/changelog"
                className="mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Changelog
              </Link>
            </nav>
          )}
          {/* Dogfooded: the palette searches this library's own build-time index. */}
          <DocsSearch />
          {/* The library's own toggle, dogfooded — it themes this page. */}
          <ThemeToggle />
          <a href={REPO} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="mono text-xs uppercase tracking-[0.14em]">
              Source <ArrowUpRight />
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}

function ImportLine() {
  return (
    <div className="my-8 overflow-x-auto rounded-lg border border-border bg-[var(--surface)] px-4 py-3">
      <code className="mono whitespace-pre text-[0.8rem] leading-relaxed">
        <span className="text-[color:var(--cyan-deep)]">import</span>
        <span className="text-muted-foreground"> {'{ '}</span>
        <span className="text-foreground">
          ImageViewer, ViewableImage, ProgressiveImage, ProgressiveText, ProgressiveList,
          ProgressiveTable, FuzzyList, GlobalSearch, VirtualList, Nav2D, PhonePreview, Modal, useConfirm,
          ToastProvider, useToast, ThemeToggle, useTheme, Spinner, Skeleton, EmptyState,
          StatusBadge, RelativeTime, SearchInput, DropZone, CopyButton, Button, Input, RichInput,
          useLocalStorage, useMediaQuery, useLongPress, relTime, fmtBytes, cn
        </span>
        <span className="text-muted-foreground">{' }'} </span>
        <span className="text-[color:var(--cyan-deep)]">from</span>
        <span className="text-[color:var(--cyan)]"> '@gabvdl/ui'</span>
      </code>
    </div>
  );
}

function ComponentCard({ entry }: { entry: Entry }) {
  const { id, name, sig, tag, Icon } = entry;
  return (
    <Link to={`/c/${id}`} className="comp-card group block text-left" aria-label={`Open ${name}`}>
      <div className="comp-card__art">
        <Icon />
      </div>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="mono text-sm text-foreground">{name}</div>
          <div className="mono mt-1 truncate text-[11px] text-muted-foreground">{sig}</div>
        </div>
        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--cyan-deep)]">
          {tag}
        </span>
      </div>
    </Link>
  );
}

/* ─── Demos ────────────────────────────────────────────────────────────────── */
function Nav2DDemo() {
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        The stage below is under a capture blocker. <b className="text-foreground">Hold &amp; drag</b>{' '}
        anywhere to aim the joystick — a ray shoots from the selected tile; release to move the
        selection to the previewed tile. <b className="text-foreground">Single-tap</b> a tile to select
        it, <b className="text-foreground">double-tap</b> to activate it. Touch or mouse.
      </p>
      <Nav2DProvider bounds="container" defaultSelectedId="save" defaultEnabled>
        <Nav2DStage />
      </Nav2DProvider>
    </div>
  );
}

const swatches: { id: string; label: string; color: string }[] = [
  { id: 'cyan', label: 'Cyan', color: 'var(--cyan)' },
  { id: 'safe', label: 'Safelight', color: 'var(--safelight)' },
  { id: 'paper', label: 'Paper', color: 'var(--paper-dim)' },
];

function Nav2DStage() {
  const { selectedId, previewId } = useNav2D();
  const [log, setLog] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [starred, setStarred] = useState(false);
  const [accent, setAccent] = useState('var(--cyan)');
  const fire = (name: string) => setLog((l) => [name, ...l].slice(0, 5));

  const tileClass = (extra?: string) =>
    cn(
      'flex h-full min-h-[3.5rem] w-full select-none items-center justify-center rounded-[10px] border border-border bg-[var(--tint)] px-3 text-center text-sm text-foreground',
      extra,
    );

  return (
    <div>
      {/* The play area — a mix of buttons, cards and swatches at varied spots. */}
      <div
        className="grid grid-cols-3 gap-3 rounded-xl border border-dashed border-border bg-[var(--surface)] p-4"
        style={{ minHeight: 300 }}
      >
        <Nav2DItem id="save" radius={10} onActivate={() => fire('Save')}>
          <div className={tileClass('font-medium text-[color:var(--cyan)]')}>Save</div>
        </Nav2DItem>
        <Nav2DItem id="counter" radius={10} onActivate={() => setCount((c) => c + 1)}>
          <div className={tileClass('flex-col gap-0.5')}>
            <span className="mono text-lg tabular-nums text-foreground">{count}</span>
            <span className="mono text-[10px] text-muted-foreground">2×-tap ++</span>
          </div>
        </Nav2DItem>
        <Nav2DItem id="star" radius={10} onActivate={() => setStarred((s) => !s)}>
          <div className={tileClass(starred ? 'text-[color:var(--safelight)]' : '')}>
            {starred ? '★ Starred' : '☆ Star'}
          </div>
        </Nav2DItem>

        <Nav2DItem id="note" radius={10} onActivate={() => fire('Open note')}>
          <div className={cn(tileClass('col-span-1 flex-col items-start gap-1 text-left'))}>
            <span className="text-foreground">Note</span>
            <span className="mono text-[10px] leading-tight text-muted-foreground">a plain div target</span>
          </div>
        </Nav2DItem>
        <Nav2DItem id="accent" radius={10} onActivate={() => fire('Recolour')}>
          <div className={tileClass('gap-2')}>
            {swatches.map((s) => (
              <button
                key={s.id}
                onClick={() => setAccent(s.color)}
                aria-label={s.label}
                className="size-5 rounded-full ring-1 ring-border"
                style={{ background: s.color, outline: accent === s.color ? '2px solid var(--foreground)' : 'none', outlineOffset: 1 }}
              />
            ))}
          </div>
        </Nav2DItem>
        <Nav2DItem id="delete" radius={10} onActivate={() => fire('Delete')}>
          <div className={tileClass('text-[color:var(--destructive,#e5484d)]')}>Delete</div>
        </Nav2DItem>

        <Nav2DItem id="wide" radius={10} onActivate={() => fire('Submit')}>
          <div className={tileClass('col-span-2')} style={{ background: 'color-mix(in srgb, var(--cyan) 14%, transparent)' }}>
            Submit — a wide button
          </div>
        </Nav2DItem>
        <Nav2DItem id="chip" radius={999} onActivate={() => fire('Tag')}>
          <div className={cn(tileClass('rounded-full text-xs'), 'min-h-0 py-2')}>#tag</div>
        </Nav2DItem>
      </div>

      {/* Live readout — visible through the transparent blocker. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 mono text-[11px]">
        <span className="text-muted-foreground">
          selected <span className="text-[color:var(--cyan)]">{selectedId ?? '—'}</span>
        </span>
        <span className="text-muted-foreground">
          preview <span className="text-[color:var(--safelight)]">{previewId ?? '—'}</span>
        </span>
        <span className="text-muted-foreground">
          fired{' '}
          <span className="text-foreground" style={{ color: accent }}>
            {log[0] ?? '—'}
          </span>
          {log.length > 1 && <span className="text-muted-foreground/60"> · {log.slice(1).join(' · ')}</span>}
        </span>
      </div>
    </div>
  );
}

function ImageViewerDemo() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {specimens.slice(0, 8).map((s, i) => (
        <div key={s.id} className="group relative aspect-square overflow-hidden rounded-md border border-border">
          <ViewableImage
            images={specimenFulls}
            index={i}
            thumb={thumbUrl(s.id)}
            full={specimenFulls[i]}
            alt={s.alt}
            imgClassName="cyanotype group-hover:scale-[1.05]"
          />
        </div>
      ))}
    </div>
  );
}

function ViewableImageDemo() {
  const set = specimens.slice(0, 3);
  const urls = set.map((s) => fullUrl(s.id));
  return (
    <div className="grid grid-cols-3 gap-2">
      {set.map((s, i) => (
        <div key={s.id} className="group relative aspect-[3/4] overflow-hidden rounded-md border border-border">
          <ViewableImage
            images={urls}
            index={i}
            thumb={thumbUrl(s.id)}
            full={urls[i]}
            alt={s.alt}
            imgClassName="cyanotype group-hover:scale-[1.05]"
          />
        </div>
      ))}
    </div>
  );
}

function ProgressiveImageDemo() {
  const s = specimens[4];
  return (
    <div className="group mx-auto max-w-xs">
      <ProgressiveImage
        thumb={thumbUrl(s.id)}
        full={fullUrl(s.id)}
        alt={s.alt}
        className="aspect-[4/3] overflow-hidden rounded-lg border border-border"
        imgClassName="cyanotype"
      />
      <p className="mt-2 mono text-[11px] text-muted-foreground">Scroll-lazy · blur → full cross-fade</p>
    </div>
  );
}

function GlobalSearchDemo() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        This is the palette the header runs — press{' '}
        <kbd className="mono rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]">Ctrl</kbd>{' '}
        <kbd className="mono rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]">K</kbd> anywhere on
        this page, or use the bar below. It searches a{' '}
        <b className="text-foreground">static index generated at build time</b> from the library's TypeScript
        source, so every component, hook, utility <i>and prop</i> is in it. Try{' '}
        <code className="mono text-[color:var(--cyan-deep)]">debounce</code>,{' '}
        <code className="mono text-[color:var(--cyan-deep)]">"overscan"</code> (quoted = exact substring), or{' '}
        <code className="mono text-[color:var(--cyan-deep)]">zoom</code>.
      </p>
      <DocsSearch trigger="bar" />
      <p className="text-[13px] text-muted-foreground">
        Modal + FuzzyList + VirtualList, wired together: the results list is windowed, the search is debounced
        (400 ms) and quote-aware, and the index is fetched lazily on first open.
      </p>
    </div>
  );
}

/** The specimen plates, given the metadata a real collection would carry. */
const PLATE_KINDS = ['landscape', 'study', 'still life', 'terrain'] as const;
const plates = specimens.map((s, i) => ({
  id: s.id,
  label: s.label,
  // The alt text reads "Cyanotype specimen — alpine reservoir"; the part after
  // the dash is the actual subject, which is what's worth searching.
  subject: s.alt.split('—')[1]?.trim() ?? s.alt,
  kind: PLATE_KINDS[i % PLATE_KINDS.length],
  year: 1889 + (i % 7),
  thumb: thumbUrl(s.id),
  full: fullUrl(s.id),
}));

function CollectionDemo() {
  const [view, setView] = useState<CollectionView>('cards');
  const { open } = useImageViewer();
  const fulls = plates.map((p) => p.full);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        The same twelve plates, two ways — hit the{' '}
        <b className="text-foreground">toggle on the right of the search bar</b>. Both views are windowed by{' '}
        <code className="mono text-[color:var(--cyan-deep)]">VirtualList</code> (cards are chunked into rows, so a
        grid costs what a list costs), every picture blur-up loads through{' '}
        <code className="mono text-[color:var(--cyan-deep)]">ProgressiveImage</code> only as it nears the viewport,
        and the search box is <code className="mono text-[color:var(--cyan-deep)]">FuzzyList</code> — so typing{' '}
        <code className="mono text-[color:var(--cyan-deep)]">hound</code> filters and marks the match in whichever
        view you're in. Click a plate to open the viewer.
      </p>

      <Collection
        items={plates}
        view={view}
        onViewChange={setView}
        getTitle={(p) => p.subject}
        getSubtitle={(p) => `${p.label} · ${p.year}`}
        getImage={(p) => ({ thumb: p.thumb, full: p.full, alt: p.subject })}
        getItemKey={(p) => p.id}
        titleKey="subject"
        searchKeys={['subject', 'kind', 'label']}
        searchPlaceholder="Search the plates… (try “hound”, or “study”)"
        debounce={200}
        columns={{ base: 2, md: 3 }}
        aspect="4 / 3"
        onSelect={(p) => open(fulls, plates.indexOf(p))}
        renderOverlay={({ item }) => (
          <span className="absolute left-1.5 top-1.5 rounded bg-[var(--ink-950)]/70 px-1.5 py-0.5 mono text-[10px] text-[var(--paper)] backdrop-blur-sm">
            {item.kind}
          </span>
        )}
        renderMeta={({ item, view: v }) =>
          v === 'list' ? (
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.kind}</span>
          ) : null
        }
        listClassName="h-[420px]"
      />
    </div>
  );
}

function FuzzyListDemo() {
  const kindColor: Record<Node['kind'], string> = {
    service: 'var(--cyan)',
    project: 'var(--safelight)',
    box: 'var(--paper-dim)',
  };
  return (
    <FuzzyList
      items={nodes}
      keys={['name', 'host', 'desc', 'kind']}
      getItemKey={(n) => n.name}
      placeholder='Search the homelab… (try "lab" for an exact match)'
      autoFocus
      debounce={200}
      smooth
      className="h-[380px]"
      renderItem={({ highlight, active, item }) => (
        <div
          className={cn(
            'cursor-pointer rounded-lg border px-3 py-2 transition-colors',
            active ? 'border-[color:var(--cyan)]/50 bg-[var(--tint-strong)]' : 'border-transparent hover:bg-[var(--tint)]',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full" style={{ background: kindColor[item.kind] }} />
            <span className="mono text-[13px] text-foreground">{highlight('name')}</span>
            <span className="mono ml-auto text-[11px] text-muted-foreground">{highlight('host')}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">{highlight('desc', { snippet: true })}</p>
        </div>
      )}
    />
  );
}

function PhonePreviewDemo() {
  return (
    <div className="flex justify-center">
      <PhonePreview screenWidth={256} statusBar>
        <div className="px-4 pb-6">
          <h3 className="display mt-2 text-2xl text-foreground">Notes</h3>
          <div className="mt-3 space-y-2">
            {['Deploy ui.gabvdl.xyz', 'Cyanotype palette', 'FuzzyList API', 'Phone frame, no deps', 'Ship v0.1.0'].map(
              (t, i) => (
                <div key={t} className="rounded-lg border border-border bg-[var(--tint)] px-3 py-2">
                  <div className="text-sm text-foreground">{t}</div>
                  <div className="mono text-[10px] text-muted-foreground">{i === 0 ? 'just now' : `${i * 2}h ago`}</div>
                </div>
              ),
            )}
          </div>
        </div>
      </PhonePreview>
    </div>
  );
}

function IframePreviewDemo() {
  const [url, setUrl] = useState('https://ui.gabvdl.xyz');
  return (
    <div className="flex flex-col items-center gap-3">
      <IframePreview
        url={url}
        onUrlChange={setUrl}
        title="Live preview"
        label="Open preview"
        cacheBust
        actions={
          <>
            <Badge>deployed</Badge>
            <span className="mono truncate text-[11px] text-muted-foreground">{url}</span>
          </>
        }
      >
        {({ open }) => (
          <button
            type="button"
            onClick={open}
            className="group w-64 overflow-hidden rounded-xl border border-border bg-[var(--tint)] text-left transition-colors hover:border-[var(--cyan)]"
          >
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
              <span className="size-2 rounded-full bg-[var(--cyan)] opacity-70" />
              <span className="mono truncate text-[11px] text-muted-foreground">{url}</span>
            </div>
            <div className="px-3 py-6 text-center text-sm text-foreground">
              Click to preview full-screen
              <div className="mt-1 text-[11px] text-muted-foreground">
                editable URL · reload · phone / desktop
              </div>
            </div>
          </button>
        )}
      </IframePreview>
    </div>
  );
}

interface HeatRow {
  id: number;
  label: string;
  heat: number;
}

const HEAT_LABELS = [
  'deploy pipeline',
  'auth service',
  'image indexer',
  'traefik router',
  'sqlite store',
  'sse watcher',
  'token counter',
  'skill runner',
  'plan viewer',
  'conv archive',
  'memory sync',
  'search index',
];

const VLIST_SPEEDS = [
  { label: 'brisk', ms: 260 },
  { label: 'default', ms: 520 },
  { label: 'languid', ms: 1000 },
];

function VirtualListDemo() {
  const [smooth, setSmooth] = useState(true);
  const [speed, setSpeed] = useState(520);
  const [playing, setPlaying] = useState(true);
  const [rows, setRows] = useState<HeatRow[]>(() =>
    Array.from({ length: 48 }, (_, i) => ({
      id: i,
      label: `${HEAT_LABELS[i % HEAT_LABELS.length]} #${i}`,
      heat: Math.round(Math.random() * 100),
    })),
  );

  // Bump a handful of random rows' "activity", which re-sorts the list — the
  // exact reorder the `smooth` prop is meant to make legible.
  const bump = () =>
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      for (let k = 0; k < 5; k++) {
        const r = next[Math.floor(Math.random() * next.length)];
        r.heat = Math.min(100, r.heat + 12 + Math.floor(Math.random() * 40));
      }
      // gentle global decay so values keep circulating
      for (const r of next) r.heat = Math.max(0, r.heat - 3);
      return next;
    });

  // Leave enough air after the slowest glide that a reorder finishes before the
  // next one starts, so the auto-play reads as a sequence of moves rather than
  // as rows never settling.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(bump, speed + 700);
    return () => clearInterval(t);
  }, [playing, speed]);

  const sorted = [...rows].sort((a, b) => b.heat - a.heat);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSmooth((s) => !s)}
          className={cn(
            'mono rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
            smooth
              ? 'border-[color:var(--cyan-deep)] bg-[var(--tint-strong)] text-[color:var(--cyan-deep)]'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          smooth: {smooth ? 'on' : 'off'}
        </button>
        <button
          onClick={bump}
          className="mono rounded-md border border-border px-2.5 py-1.5 text-[11px] text-foreground transition-colors hover:bg-[var(--tint)]"
        >
          bump activity
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="mono rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {playing ? '❚❚ pause' : '▶ auto'}
        </button>
        <div className="mono flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="pl-1 pr-0.5">speed</span>
          {VLIST_SPEEDS.map((s) => (
            <button
              key={s.ms}
              onClick={() => setSpeed(s.ms)}
              disabled={!smooth}
              className={cn(
                'rounded-md border px-2 py-1.5 text-[11px] transition-colors disabled:opacity-40',
                speed === s.ms
                  ? 'border-[color:var(--cyan-deep)] bg-[var(--tint-strong)] text-[color:var(--cyan-deep)]'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label} · {s.ms}ms
            </button>
          ))}
        </div>
      </div>
      <VirtualList
        items={sorted}
        className="h-[360px] rounded-lg border border-border"
        estimateSize={48}
        smooth={smooth}
        smoothDuration={speed}
        getItemKey={(r) => r.id}
        renderItem={(r, i) => (
          <div className="px-2" style={{ paddingBottom: 6 }}>
            <div className="flex items-center gap-3 rounded-md border border-border bg-[var(--tint)] px-3 py-2">
              <span className="mono w-6 shrink-0 text-[11px] tabular-nums text-[color:var(--cyan-deep)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.label}</span>
              <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--tint-strong)]">
                <div
                  className="h-full rounded-full bg-[color:var(--cyan-deep)]"
                  style={{ width: `${r.heat}%` }}
                />
              </div>
              <span className="mono w-7 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {r.heat}
              </span>
            </div>
          </div>
        )}
      />
      <p className="mt-2 mono text-[11px] text-muted-foreground">
        48 rows auto-sort by activity · toggle <span className="text-foreground">smooth</span> to see
        rows glide vs. teleport · every row that moves animates, and one moving{' '}
        <span className="text-foreground">up</span> passes in front of the ones it displaces · scroll
        to see windowing
      </p>
    </div>
  );
}

function ChangelogDemo() {
  // Real data, dogfooded: the same /changelog.jsonl this site generates from
  // CHANGELOG.md at build time — paged into the modal to demo onLoadMore.
  const { entries: changelog } = useChangelog();
  const PAGE = 4;
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [update, setUpdate] = useState<ChangelogEntry | null>(null);
  const entries = changelog.slice(0, count);
  const hasMore = count < changelog.length;
  const loadMore = () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setTimeout(() => {
      setCount((c) => Math.min(c + PAGE, changelog.length));
      setLoading(false);
    }, 450);
  };
  const simulateUpdate = () =>
    setUpdate({
      version: '9.9.9',
      title: 'A shiny new version just shipped',
      changes: ['Simulated update — hit Reload to see the toast behaviour'],
    });
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        Trigger + modal + a "new version" reload toast. The entry list is a{' '}
        <span className="mono text-foreground">VirtualList</span> that pages in older releases as you
        scroll.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Changelog
          entries={entries}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
          newVersion={update}
          onDismissNewVersion={() => setUpdate(null)}
          trigger={({ open, hasUpdate }) => (
            <Button onClick={open}>
              Open changelog
              {hasUpdate && <span className="ml-1.5 size-1.5 rounded-full bg-primary-foreground" />}
            </Button>
          )}
        />
        <Button variant="outline" onClick={simulateUpdate} disabled={update !== null}>
          Simulate update
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Full release history on the{' '}
        <Link to="/changelog" className="text-primary underline-offset-2 hover:underline">
          /changelog page
        </Link>{' '}
        — same JSONL, rendered by <span className="mono">ChangelogPage</span>.
      </p>
    </div>
  );
}

function ButtonDemo() {
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    setTimeout(() => setSaving(false), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button size="sm" icon={<Plus />}>
          Small
        </Button>
        <Button size="md" icon={<Plus />}>
          Medium
        </Button>
        <Button size="lg" icon={<Plus />}>
          Large
        </Button>
        <Button variant="outline" icon={<ArrowUpRight />} iconPosition="right">
          Trailing icon
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon-sm" variant="outline" icon={<Copy />} tooltip="Copy — small" />
        <Button size="icon-md" variant="outline" icon={<Copy />} tooltip="Copy — medium" />
        <Button size="icon-lg" variant="outline" icon={<Copy />} tooltip="Copy — large" />
        <Button
          size="icon-md"
          variant="destructive"
          icon={<Trash2 />}
          tooltip="Delete run"
          tooltipSide="bottom"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<Save />} loading={saving} loadingText="Saving…" onClick={save}>
          Save
        </Button>
        <Button
          variant="outline"
          icon={<Check />}
          disabled
          tooltip="Nothing to publish yet"
          tooltipSide="right"
        >
          Publish
        </Button>
      </div>
    </div>
  );
}

function InputDemo() {
  return (
    <div className="max-w-sm space-y-3">
      <Input placeholder="Search the catalogue…" />
      <Input type="email" placeholder="you@example.com" />
      <div>
        <Input cacheKey="ds-input-demo" cacheLocation="local" placeholder="Type, then reload the page…" />
        <p className="mt-1.5 mono text-[11px] text-muted-foreground">
          cacheKey · persists to localStorage · survives reload
        </p>
      </div>
      <Input disabled placeholder="Disabled" />
    </div>
  );
}

const TABS_VARIANTS = ['underline', 'pill', 'segmented'] as const;

function TabsDemo() {
  const [variant, setVariant] = useState<(typeof TABS_VARIANTS)[number]>('underline');
  const isMobile = useIsMobile();

  return (
    <div className="space-y-5">
      {/* Tabs picking the variant of Tabs — the segmented variant, dogfooded. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono text-[11px] uppercase tracking-wider text-muted-foreground">variant</span>
        <Tabs
          value={variant}
          onValueChange={(v) => setVariant(v as (typeof TABS_VARIANTS)[number])}
          variant="segmented"
          swipe={false}
        >
          <TabsList aria-label="Indicator variant">
            {TABS_VARIANTS.map((v) => (
              <TabsTrigger key={v} value={v} className="mono text-xs">
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* A job-detail panel — the shape every service frontend in the lab rebuilds. */}
      <Tabs
        key={variant}
        defaultValue="logs"
        variant={variant}
        className="rounded-xl border border-border bg-card p-3"
      >
        <TabsList aria-label="Job detail">
          <TabsTrigger value="logs" icon={<Terminal />}>
            Logs
          </TabsTrigger>
          <TabsTrigger value="config" icon={<Settings2 />}>
            Config
          </TabsTrigger>
          <TabsTrigger value="files" icon={<FileText />} badge={<Badge tone="sky">3</Badge>}>
            Files
          </TabsTrigger>
          <TabsTrigger value="raw" disabled>
            Raw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <div className="mono space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <p>
              <span className="text-emerald-500">✓</span> pulled trellis2:latest
            </p>
            <p>
              <span className="text-emerald-500">✓</span> gfx1151 · 96 GB unified
            </p>
            <p>
              <Spinner className="inline size-3 align-[-2px]" /> diffusion 37s…
            </p>
          </div>
        </TabsContent>

        <TabsContent value="config">
          <div className="mono grid gap-1 text-xs">
            <p>
              <span className="text-muted-foreground">pipeline_type</span> = <span className="text-foreground">512</span>
            </p>
            <p>
              <span className="text-muted-foreground">decimation</span> = <span className="text-foreground">100_000</span>
            </p>
          </div>
        </TabsContent>

        {/* keepMounted: the panel keeps its state while you tab away. */}
        <TabsContent value="files" keepMounted>
          <div className="grid gap-2">
            {['mesh.glb', 'preview.webp', 'metadata.json'].map((f) => (
              <div key={f} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="mono text-xs">{f}</span>
                <StatusBadge status="done" />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="raw">unreachable — the trigger is disabled</TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        {isMobile
          ? 'Swipe the panel sideways to change tab — the strip scrolls, it never wraps.'
          : '← → move between tabs (Home / End jump to the ends). On a phone the panel is swipeable and the strip scrolls.'}
      </p>
    </div>
  );
}

function ProgressiveTextDemo() {
  const phrases = [
    'Types out at a constant rate…',
    'Types out one character at a time.',
    'On change it backspaces to the shared prefix, then rewrites the tail.',
  ];
  const [i, setI] = useState(0);
  return (
    <div className="space-y-4">
      <div className="min-h-[4rem] rounded-md border border-border bg-[var(--surface)] p-3 text-sm leading-relaxed">
        <ProgressiveText text={phrases[i]} speed={42} deleteSpeed={90} caret />
      </div>
      <Button size="sm" variant="outline" onClick={() => setI((v) => (v + 1) % phrases.length)}>
        Change the text
      </Button>
      <p className="mono text-[11px] text-muted-foreground">
        speed=42 c/s · deleteSpeed=90 c/s · diffs current → target
      </p>
    </div>
  );
}

function ProgressiveListDemo() {
  const seed = [
    'First line types out…',
    'then the next row waits for it,',
    'and only appears once the typing is done.',
  ];
  const [items, setItems] = useState<string[]>(seed);
  const [runId, setRunId] = useState(0); // bump to remount → replay the sequence
  return (
    <div className="space-y-4">
      <ProgressiveList key={runId} items={items} speed={2} delay={0.1} initialReveal={0} className="space-y-2" getKey={(_, i) => i}>
        {(label, i, { isNew }) => (
          <div
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              isNew ? 'border-[color:var(--cyan)]/40 bg-[var(--surface)]' : 'border-border bg-[var(--surface-2)]',
            )}
          >
            <span className="mono text-[color:var(--cyan-deep)]">{i + 1}. </span>
            <ProgressiveText text={label} speed={34} instant={!isNew} />
          </div>
        )}
      </ProgressiveList>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setItems((xs) => [...xs, `new row ${xs.length + 1} types in too`])}>
          Append a row
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRunId((n) => n + 1)}>
          Replay
        </Button>
      </div>
      <p className="mono text-[11px] text-muted-foreground">
        timeline context · each row waits for the previous row's ProgressiveText to finish
      </p>
    </div>
  );
}

function ProgressiveBashSection() {
  return (
    <div className="space-y-8">
      <ProgressiveBashDemo />
      <div className="space-y-3 border-t border-border pt-6">
        <div className="text-[12px] font-semibold text-foreground">
          Sub-parts <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">experimental</span>
        </div>
        <ProgressiveBashSubpartsDemo />
      </div>
    </div>
  );
}

function ProgressiveBashDemo() {
  // Timestamps a few seconds/minutes apart so the timestamp → gap compression
  // is exercised (a longer real pause reads as a slightly longer beat, but
  // playback never freezes).
  const t0 = 1_700_000_000_000;
  const entries: BashEntry[] = [
    {
      id: 'status',
      description: 'check the worktree before building',
      command: 'git status --short',
      output: ' M apps/docs/src/App.tsx\n M apps/docs/src/icons.tsx\n?? data/plans/',
      cwd: '~/design-system',
      timestamp: t0,
    },
    {
      id: 'build',
      command: 'npm run build --workspace @gabvdl/ui',
      output:
        '=== Build ===\nvite v6.0.0 building for production...\n✓ 42 modules transformed.\ndist/index.js   18.4 kB │ gzip: 6.1 kB\n✓ built in 1.83s',
      cwd: '~/design-system',
      timestamp: t0 + 6_000,
    },
    {
      id: 'test',
      description: 'a command that fails',
      command: 'npm test -- --run floating-panel',
      output:
        'FAIL  src/floating-panel.test.tsx\n  ✕ docks two panels as tabs (12 ms)\n    Error: expected 2 tabs, received 1\n\nTests: 1 failed, 7 passed',
      exitCode: 1,
      isError: true,
      cwd: '~/design-system',
      timestamp: t0 + 45_000,
    },
    {
      id: 'deploy',
      description: 'copy the built configs and cut over',
      command: 'rsync -az --delete apps/docs/dist/ raspy2:/srv/ui.gabvdl.xyz/',
      output: 'sent 214 files  ·  3.1 MB  ·  1.4 MB/s',
      cwd: '~/design-system',
      timestamp: t0 + 120_000,
    },
    {
      id: 'health',
      command: 'curl -s -o /dev/null -w "%{http_code}" https://ui.gabvdl.xyz',
      output: '200',
      cwd: '~/design-system',
      timestamp: t0 + 123_000,
    },
  ];
  const [runId, setRunId] = useState(0); // bump the key to remount → replay
  const [stickyPrompt, setStickyPrompt] = useState(false);
  const [resumeMid, setResumeMid] = useState(false); // catch-up demo toggle
  const ref = useRef<ProgressiveBashHandle>(null);
  const replay = () => setRunId((n) => n + 1);
  return (
    <div className="space-y-4">
      <div className="h-80 overflow-hidden rounded-md border border-border">
        <ProgressiveBash
          key={`${runId}-${stickyPrompt}-${resumeMid}`}
          apiRef={ref}
          entries={entries}
          stickyPrompt={stickyPrompt}
          // Catch-up: pretend "now" is 1 min into the session, so the first
          // three entries mount fully-written and only the last two type live.
          catchUp={resumeMid ? t0 + 60_000 : undefined}
          className="h-80"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={replay}>
          Replay
        </Button>
        <Button size="sm" variant="ghost" onClick={() => ref.current?.skipToEnd()}>
          Skip
        </Button>
        <Button
          size="sm"
          variant={stickyPrompt ? 'default' : 'ghost'}
          onClick={() => setStickyPrompt((v) => !v)}
        >
          Sticky prompt {stickyPrompt ? 'on' : 'off'}
        </Button>
        <Button
          size="sm"
          variant={resumeMid ? 'default' : 'ghost'}
          onClick={() => setResumeMid((v) => !v)}
        >
          Catch-up {resumeMid ? 'on' : 'off'}
        </Button>
      </div>
      <p className="mono text-[11px] text-muted-foreground">
        5 entries · real gaps span 2 min, compressed into a continuous replay · types commands, reveals output line-by-line ·
        {' '}<b>Sticky prompt</b>: pins each command to the top while its output scrolls ·{' '}
        <b>Catch-up</b>: mounts past entries fully-written (a reload never re-types a finished session)
      </p>
    </div>
  );
}

function ProgressiveBashSubpartsDemo() {
  // [EXPERIMENTAL] A single chained command whose `echo "Title..[value]"` steps
  // label each stage; `experimentalSubparts` splits it into one separately-typed
  // command block per step (each real command paired with its own output).
  const t0 = 1_700_000_000_000;
  const entries: BashEntry[] = [
    {
      id: 'deploy',
      description: 'one chained command, split into separate commands',
      command:
        'echo "Install..[npm ci]" && npm ci && echo "Typecheck..[tsc]" && tsc --noEmit && ' +
        'echo "Build..[vite]" && vite build && echo "Deploy..[rsync]" && rsync -az dist/ raspy2:/srv/',
      output:
        'Install..[npm ci]\nadded 214 packages in 3.2s\n' +
        'Typecheck..[tsc]\nNo type errors.\n' +
        'Build..[vite]\nvite v6.0.0 building for production...\n✓ 42 modules transformed.\ndist/index.js  18.4 kB │ gzip: 6.1 kB\n✓ built in 1.83s\n' +
        'Deploy..[rsync]\nsent 214 files  ·  3.1 MB  ·  1.4 MB/s\n✓ live at https://ui.gabvdl.xyz',
      cwd: '~/design-system',
      timestamp: t0,
    },
  ];
  const [runId, setRunId] = useState(0);
  const [on, setOn] = useState(true);
  return (
    <div className="space-y-4">
      <div className="h-72 overflow-hidden rounded-md border border-border">
        <ProgressiveBash
          key={`${runId}-${on}`}
          entries={entries}
          experimentalSubparts={on}
          stickyPrompt
          className="h-72"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setRunId((n) => n + 1)}>
          Replay
        </Button>
        <Button size="sm" variant={on ? 'default' : 'ghost'} onClick={() => setOn((v) => !v)}>
          Subparts {on ? 'on' : 'off'}
        </Button>
      </div>
      <p className="mono text-[11px] text-muted-foreground">
        [experimental] one <code>{'echo "Title..[value]" && …'}</code> chain · each step is split into its own typed
        command (paired with its output) · toggle off to see the single raw chain instead
      </p>
    </div>
  );
}

/**
 * A custom timeline participant: once its slot is active it fills a bar over
 * `ms` and reports that duration, so the next slot waits for it — the
 * `useProgressiveSlot` half of the API, exercised outside the library.
 */
function TimelineBar({ ms, label }: { ms: number; label: string }) {
  const { active, report } = useProgressiveSlot();
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!active || started) return;
    report(ms); // "I'll animate for this long" — the timeline waits
    const frame = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(frame);
  }, [active, started, ms, report]);
  return (
    <div className="rounded-md border border-[color:var(--cyan)]/40 bg-[var(--surface)] px-3 py-2">
      <div className="mono mb-1.5 text-[11px] text-muted-foreground">{label}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tint-strong)]">
        <div
          className="h-full rounded-full bg-[color:var(--cyan)]"
          style={{ width: started ? '100%' : '0%', transition: `width ${ms}ms linear` }}
        />
      </div>
    </div>
  );
}

type TimelineStep =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'bar'; ms: number; label: string }
  | { id: string; kind: 'plain'; text: string };

const TIMELINE_STEPS: TimelineStep[] = [
  { id: 'intro', kind: 'text', text: 'The head slot types this line out…' },
  { id: 'bar', kind: 'bar', ms: 1400, label: 'a custom participant — reports 1.4s via useProgressiveSlot' },
  { id: 'after', kind: 'text', text: '…and this one waited for the bar to fill.' },
  { id: 'plain', kind: 'plain', text: 'A plain row reports nothing — it hands off after fallbackMs.' },
];

function TimelineRun() {
  const [head, setHead] = useState(0);
  const advance = () => setHead((h) => h + 1);
  return (
    <div className="space-y-2">
      {TIMELINE_STEPS.map((step, i) =>
        i <= head ? (
          <ProgressiveTimelineSlot key={step.id} active={i === head} fallbackMs={600} onComplete={advance}>
            {step.kind === 'bar' ? (
              <TimelineBar ms={step.ms} label={step.label} />
            ) : (
              <div className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm">
                <span className="mono text-[color:var(--cyan-deep)]">{i + 1}. </span>
                {step.kind === 'text' ? <ProgressiveText text={step.text} speed={34} /> : step.text}
              </div>
            )}
          </ProgressiveTimelineSlot>
        ) : null,
      )}
      <p className={cn('mono text-[11px]', head >= TIMELINE_STEPS.length ? 'text-[color:var(--cyan)]' : 'text-muted-foreground')}>
        {head >= TIMELINE_STEPS.length ? '✓ timeline complete' : `head at slot ${head + 1} / ${TIMELINE_STEPS.length}`}
      </p>
    </div>
  );
}

function ProgressiveTimelineDemo() {
  const [runId, setRunId] = useState(0); // bump to remount → replay the sequence
  return (
    <div className="space-y-4">
      <TimelineRun key={runId} />
      <Button size="sm" variant="outline" onClick={() => setRunId((n) => n + 1)}>
        Replay
      </Button>
      <p className="mono text-[11px] text-muted-foreground">
        4 slots · a ProgressiveText reports its typing duration automatically · the bar joins via useProgressiveSlot ·
        the plain row falls back to fallbackMs=600
      </p>
    </div>
  );
}

function FloatingPanelDemo() {
  return (
    <div className="space-y-4">
      <DockProvider>
        <FloatingPanel
          id="fp-terminal"
          dockId="fp-dock"
          defaultDocked
          title="Terminal"
          closable
          defaultGeom={{ width: 340, height: 200 }}
        >
          <div className="p-3 mono text-[12px] text-foreground">
            <div className="text-[color:var(--cyan-deep)]">❯ make up</div>
            <div className="text-muted-foreground">bringing up dev + auth + logging…</div>
            <div className="text-[color:var(--cyan)]">✓ all services healthy</div>
          </div>
        </FloatingPanel>
        <FloatingPanel
          id="fp-details"
          dockId="fp-dock"
          defaultDocked
          title="Details"
          closable
          defaultGeom={{ width: 340, height: 200 }}
        >
          <div className="p-3 text-sm text-foreground">
            <p className="text-muted-foreground">
              Two panels share one dock, so they show up as tabs. Drag a tab out to float it as a
              window; drag the header back onto the dock to snap it in. Close a tab and the dock
              grows a <span className="mono text-foreground">+</span> to bring it back.
            </p>
          </div>
        </FloatingPanel>
        <FloatingPanel
          id="fp-notes"
          dockId="fp-dock"
          title="Notes"
          closable
          defaultClosed
          defaultGeom={{ width: 340, height: 200 }}
        >
          <div className="p-3 text-sm text-foreground">
            <p className="text-muted-foreground">
              This one started closed (<span className="mono text-foreground">defaultClosed</span>) —
              it only ever existed as an entry under the dock&rsquo;s +.
            </p>
          </div>
        </FloatingPanel>
        <Dock
          id="fp-dock"
          className="h-64 rounded-lg border border-dashed border-border"
        />
      </DockProvider>
      <p className="mono text-[11px] text-muted-foreground">
        drag a tab out to float · drag a header onto the dock to snap in · panels sharing a dock become tabs · close a tab and reopen it from the dock&rsquo;s + (one closed panel opens straight away, several give you a menu) · a floating panel portals to document.body (position:fixed), so it escapes this card — expected
      </p>
    </div>
  );
}

function ResizableLayoutDemo() {
  const layoutRef = useRef<ResizableLayoutHandle>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  // Force the mobile branch on, so the two mobile behaviours can be compared
  // without resizing the browser.
  const [mobile, setMobile] = useState(false);
  const [bottomMode, setBottomMode] = useState<'panel' | 'drawer'>('panel');

  const swatch = (label: string) => (
    <div className="flex h-full flex-col gap-2 p-3">
      <p className="mono text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="h-2 w-3/4 rounded-full bg-border" />
      <div className="h-2 w-1/2 rounded-full bg-border" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => layoutRef.current?.toggle('left')}>
          {leftOpen ? 'Collapse' : 'Expand'} left
        </Button>
        <Button size="sm" variant="outline" onClick={() => layoutRef.current?.toggle('right')}>
          {rightOpen ? 'Collapse' : 'Expand'} right
        </Button>
        <Button size="sm" variant="outline" onClick={() => layoutRef.current?.toggle('bottom')}>
          {bottomOpen ? 'Collapse' : 'Expand'} bottom
        </Button>
        <Button size="sm" variant={mobile ? 'default' : 'outline'} onClick={() => setMobile((m) => !m)}>
          {mobile ? 'Mobile' : 'Desktop'}
        </Button>
        {mobile && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBottomMode((m) => (m === 'panel' ? 'drawer' : 'panel'))}
          >
            bottom: {bottomMode}
          </Button>
        )}
      </div>
      <div className="h-80 overflow-hidden rounded-lg border border-border">
        <ResizableLayout
          ref={layoutRef}
          left={{ content: swatch('Nav'), defaultSize: 26, minSize: 18, maxSize: 40, mobileWidth: '70%' }}
          right={{ content: swatch('Info'), defaultSize: 26, minSize: 18, maxSize: 40, mobileWidth: '70%' }}
          bottom={{
            content: swatch('Composer'),
            defaultSize: 32,
            minSize: 18,
            maxSize: 55,
            mobileMode: bottomMode,
            mobileHeight: '50%',
            edgeSwipeToOpen: true,
          }}
          leftOpen={leftOpen}
          onLeftOpenChange={setLeftOpen}
          rightOpen={rightOpen}
          onRightOpenChange={setRightOpen}
          bottomOpen={bottomOpen}
          onBottomOpenChange={setBottomOpen}
          desktopBreakpoint={mobile ? 99999 : 0}
        >
          <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3">
            {swatch('Thread (scrollable center)')}
          </div>
        </ResizableLayout>
      </div>
      <p className="mono text-[11px] text-muted-foreground">
        desktop: drag a handle to resize · click a handle's chevron or the buttons above to collapse — mobile: each side
        is either a <b>panel</b> (splits the screen, center stays usable) or a <b>drawer</b> (slides over the center
        with a backdrop and takes focus). Flip the bottom side between the two above.
      </p>
    </div>
  );
}

function ProgressiveTableDemo() {
  // A comparison matrix — the shape Claude writes most (empty top-left header
  // cell, ✅/❌ + inline code in cells).
  const headers: ReactNode[] = ['', 'React Query', 'Zustand', 'Custom hook'];
  const rows: ReactNode[][] = [
    ['Instant paint', '✅ built-in', '✅ wired', '✅'],
    ['Background revalidate', '✅ free', '❌ hand-roll', '✅'],
    ['New dependency', <span className="mono">~50 kB</span>, 'none', 'none'],
    ['Rewrites call sites', <span className="mono">useQuery</span>, 'moderate', 'moderate'],
  ];
  const [runId, setRunId] = useState(0); // bump to remount → replay the reveal
  return (
    <div className="space-y-4">
      <ProgressiveTable
        key={runId}
        headers={headers}
        rows={rows}
        speed={4}
        delay={0.1}
        initialReveal={0}
        className="w-full border-collapse text-sm"
        headCellClassName="border border-[color:var(--cyan)]/30 bg-[var(--surface)] px-3 py-2 text-left font-medium text-[color:var(--cyan)]"
        cellClassName="border border-border px-3 py-2 align-top"
        renderCell={(cell: ReactNode, { header }: { header: boolean }) =>
          typeof cell === 'string' && !header ? (
            <ProgressiveText text={cell} speed={60} instant={false} />
          ) : (
            cell
          )
        }
      />
      <Button size="sm" variant="ghost" onClick={() => setRunId((n) => n + 1)}>
        Replay
      </Button>
      <p className="mono text-[11px] text-muted-foreground">
        header reveals first · rows stagger in at speed=4 rows/s · cells type via ProgressiveText
      </p>
    </div>
  );
}

function CnDemo() {
  const rows: [string, string][] = [
    [`cn('px-2', 'px-4')`, cn('px-2', 'px-4')],
    [`cn('text-sm', false && 'hidden', 'font-mono')`, cn('text-sm', false, 'font-mono')],
    [`cn('rounded', 'rounded-lg')`, cn('rounded', 'rounded-lg')],
  ];
  return (
    <div className="space-y-2 mono text-[12px]">
      {rows.map(([input, output]) => (
        <div key={input} className="flex flex-col gap-1 rounded-md border border-border bg-[var(--surface)] p-2 sm:flex-row sm:items-center sm:gap-3">
          <code className="text-muted-foreground">{input}</code>
          <span className="text-[color:var(--cyan-deep)]">→</span>
          <code className="text-[color:var(--cyan)]">'{output}'</code>
        </div>
      ))}
    </div>
  );
}

/* ─── Code IDE ─────────────────────────────────────────────────────────────── */
// A read-only embedded editor (Sandpack's CodeMirror) with two tabs — a usage
// snippet and the component's full source — plus copy buttons for each.
const IDE_THEME: SandpackTheme = {
  colors: {
    surface1: '#f8fafc',
    surface2: '#f8fafc',
    surface3: '#eef2f7',
    clickable: '#64748b',
    base: '#0f172a',
    disabled: '#94a3b8',
    hover: '#0f172a',
    accent: '#2563eb',
    error: '#dc2626',
    errorSurface: '#fef2f2',
  },
  syntax: {
    plain: '#0f172a',
    comment: { color: '#94a3b8', fontStyle: 'italic' },
    keyword: '#2563eb',
    tag: '#1d4ed8',
    punctuation: '#475569',
    definition: '#0f766e',
    property: '#7c3aed',
    static: '#c2410c',
    string: '#15803d',
  },
  font: {
    body: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    size: '13px',
    lineHeight: '1.6',
  },
};

function IdeCopyButton({
  label,
  text,
  primary,
}: {
  label: string;
  text: string;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      className={cn(
        'mono inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
        primary
          ? 'border-[color:var(--cyan)] bg-[var(--tint-strong)] text-[color:var(--cyan-deep)] hover:bg-[color:var(--cyan)] hover:text-white'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {copied ? <Check className="size-3.5 text-[color:var(--cyan)]" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function CodeIDE({ name, usage, source }: { name: string; usage: string; source?: string }) {
  const usageFile = '/Usage.tsx';
  const sourceFile = `/${name}.tsx`;
  const files: Record<string, { code: string; readOnly?: boolean; active?: boolean }> = {
    [usageFile]: { code: usage, active: true },
  };
  if (source) files[sourceFile] = { code: source, readOnly: true };
  const visibleFiles = Object.keys(files);

  return (
    <div className="ide overflow-hidden rounded-xl border border-border bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {source ? 'Usage · Source' : 'Usage'}
        </span>
        <div className="flex items-center gap-1.5">
          <IdeCopyButton label="Copy usage" text={usage} />
          {source && <IdeCopyButton label="Copy full source" text={source} primary />}
        </div>
      </div>
      <SandpackProvider
        theme={IDE_THEME}
        template="react-ts"
        files={files}
        options={{ visibleFiles, activeFile: usageFile }}
      >
        <SandpackCodeEditor readOnly showLineNumbers showTabs closableTabs={false} />
      </SandpackProvider>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-8 mono text-[11px] text-muted-foreground">
        <span>gabvdl/ui · v{VERSION} · tree-shakeable · TypeScript</span>
        <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
          Gitea <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </footer>
  );
}

/* ─── Wave-2 demos: the primitives lifted out of the homelab projects ──────── */

function DemoRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function ToastDemo() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const fakeUpload = () => {
    setBusy(true);
    const id = toast.loading('Uploading plate.tiff…');
    setTimeout(() => {
      toast.update(id, 'plate.tiff uploaded', { type: 'success' });
      setBusy(false);
    }, 1800);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        One provider, one callable <code className="mono text-foreground">toast()</code>. Errors live
        longer than the rest, a <code className="mono text-foreground">loading</code> toast stays
        pinned until you settle it, and the stack is capped so a burst can't bury the page.
      </p>
      <DemoRow>
        <Button size="sm" onClick={() => toast.success('Deployed to raspy2')}>
          Success
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            toast.error('Build failed — vite exited 1', {
              title: 'ai-agent',
              action: { label: 'View logs', onClick: () => toast.info('…opening Grafana') },
            })
          }
        >
          Error + action
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast.warning('Registry is unreachable')}>
          Warning
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={fakeUpload}>
          Pending → settled
        </Button>
        <Button size="sm" variant="ghost" onClick={() => toast.dismiss()}>
          Clear
        </Button>
      </DemoRow>
    </div>
  );
}

function ModalDemo() {
  const modal = useModal();
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Portalled, Escape- and scrim-closable, scroll-locked, focus-trapped — and a bottom sheet on a
        phone. Use it controlled, open it imperatively, or ask a yes/no question and{' '}
        <code className="mono text-foreground">await</code> the answer.
      </p>
      <DemoRow>
        <Button size="sm" onClick={() => setOpen(true)}>
          Controlled
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            modal.open({
              title: 'Job 4812',
              description: 'trellis2 · 512 · 1 image',
              content: (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Opened from a click handler — no per-dialog state in the page.</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="running" />
                    <Badge tone="violet">gfx1151</Badge>
                  </div>
                </div>
              ),
            })
          }
        >
          Imperative
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={async () => {
            const yes = await confirm({
              title: 'Delete plate XII?',
              description: 'This removes the specimen and its thumbnail. It cannot be undone.',
              confirmLabel: 'Delete',
              destructive: true,
            });
            yes ? toast.success('Deleted') : toast.info('Kept');
          }}
        >
          await confirm()
        </Button>
      </DemoRow>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Specimen details"
        description="Plate VII — harvest table"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                toast.success('Saved');
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ProgressiveImage
            thumb={thumbUrl(1062)}
            full={fullUrl(1062)}
            alt="Plate VII"
            className="aspect-[4/3] w-full rounded-lg"
          />
          <p className="text-sm text-muted-foreground">
            Try Escape, or a click on the scrim. Tab is trapped inside the panel, and the trigger
            gets its focus back on close.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div
          key={size}
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-[var(--surface)] py-6"
        >
          <Spinner size={size} />
          <span className="mono text-[11px] text-muted-foreground">size="{size}"</span>
        </div>
      ))}
      <div className="rounded-lg border border-border bg-[var(--surface)] sm:col-span-3">
        <Spinner center label="Loading specimens…" />
      </div>
    </div>
  );
}

function SkeletonDemo() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="space-y-4">
      <DemoRow>
        <Button size="sm" variant="outline" onClick={() => setLoading((l) => !l)}>
          {loading ? 'Show content' : 'Show skeleton'}
        </Button>
        <span className="mono text-[11px] text-muted-foreground">
          the placeholder should have the shape of what lands
        </span>
      </DemoRow>

      <div className="flex gap-4 rounded-lg border border-border bg-[var(--surface)] p-4">
        {loading ? (
          <>
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <SkeletonText lines={3} className="flex-1" />
          </>
        ) : (
          <>
            <img
              src={thumbUrl(1025)}
              alt=""
              className="size-12 shrink-0 rounded-full object-cover"
            />
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Plate V — study of a hound</p>
              <p className="mt-1 text-muted-foreground">
                Cyanotype on rag paper, exposed twelve minutes under a July sun. Catalogued with the
                rest of the mammals.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyStateDemo() {
  const toast = useToast();
  const [items, setItems] = useState<string[]>([]);

  return (
    <div className="rounded-lg border border-border bg-[var(--surface)]">
      {items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="No jobs in the queue"
          description="Nothing is generating right now. Queue a render and it shows up here."
          action={
            <Button
              size="sm"
              onClick={() => {
                setItems(['job 4812']);
                toast.success('Queued');
              }}
            >
              Queue a job
            </Button>
          }
        />
      ) : (
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <StatusBadge status="queued" />
            <span className="mono text-sm text-foreground">{items[0]}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setItems([])}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

const DEMO_STATUSES = ['queued', 'running', 'done', 'error', 'cancelled', 'archived'];

function StatusBadgeDemo() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2.5 text-muted-foreground">JOB_STATUS — the default map</p>
        <DemoRow>
          {DEMO_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </DemoRow>
      </div>
      <div>
        <p className="eyebrow mb-2.5 text-muted-foreground">Badge — the bare pill</p>
        <DemoRow>
          {(['neutral', 'sky', 'emerald', 'amber', 'rose', 'violet'] as const).map((tone) => (
            <Badge key={tone} tone={tone} dot>
              {tone}
            </Badge>
          ))}
        </DemoRow>
      </div>
      <p className="text-sm text-muted-foreground">
        An unknown status degrades to a neutral pill of the raw string —{' '}
        <StatusBadge status="seeding" /> — rather than crashing the row.
      </p>
    </div>
  );
}

function ProgressDemo() {
  const [pct, setPct] = useState(8);
  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => (p >= 100 ? 0 : Math.min(100, p + Math.random() * 16)));
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-md space-y-6">
      <Progress value={pct} label="texture-bake.glb" showValue />
      <Progress
        value={pct}
        max={100}
        tone={pct >= 100 ? 'emerald' : 'sky'}
        size="md"
        label="render-scene"
        showValue
        format={(v) => `${Math.round((v / 100) * 512)} / 512 frames`}
      />
      <Progress indeterminate tone="violet" label="Waking the GPU box…" />
      <p className="text-sm text-muted-foreground">
        Same <code className="mono text-xs">Tone</code> scale as{' '}
        <Link to="/c/status-badge" className="underline underline-offset-2">
          StatusBadge
        </Link>{' '}
        — a running job's bar and pill agree. No value = the indeterminate sweep.
      </p>
    </div>
  );
}

function StatTileDemo() {
  const [jobs, setJobs] = useState(128);
  const [gpuMs, setGpuMs] = useState(12_640_000);
  const [cost, setCost] = useState(1.28);
  useEffect(() => {
    const id = setInterval(() => {
      setJobs((j) => j + (Math.random() < 0.6 ? 1 : 0));
      setGpuMs((s) => s + Math.floor(Math.random() * 40_000));
      setCost((c) => c + Math.random() * 0.02);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-3">
      <StatRow columns={4}>
        <StatTile label="Jobs today" value={jobs} delta={12} hint="3 running" Icon={Layers} />
        <StatTile label="Errors" value={2} delta={-40} goodDirection="down" hint="vs last week" />
        <StatTile label="GPU time" value={fmtDuration(gpuMs)} Icon={Cpu} hint="EVOX2, single worker" />
        <StatTile label="Cost" value={fmtCost(cost)} delta="steady" hint="Gemini + local" />
      </StatRow>
      <p className="text-sm text-muted-foreground">
        Values tick over with the <Link to="/c/char-roll" className="underline underline-offset-2">CharRoll</Link>{' '}
        tally animation as the fake dashboard updates. Deltas colour by <code className="mono text-xs">goodDirection</code> —
        errors going down is emerald.
      </p>
    </div>
  );
}

interface DemoJob {
  id: string;
  name: string;
  status: string;
  created: number;
  duration: number;
}

const DEMO_JOBS: DemoJob[] = [
  { id: 'j1', name: 'render-scene', status: 'done', created: Date.now() - 32 * 60_000, duration: 412 },
  { id: 'j2', name: 'bake-textures', status: 'running', created: Date.now() - 4 * 60_000, duration: 118 },
  { id: 'j3', name: 'export-glb', status: 'queued', created: Date.now() - 90_000, duration: 0 },
  { id: 'j4', name: 'auto-rig', status: 'failed', created: Date.now() - 2 * 3_600_000, duration: 67 },
  { id: 'j5', name: 'downscale-previews', status: 'done', created: Date.now() - 5 * 3_600_000, duration: 23 },
];

function DataTableDemo() {
  const toast = useToast();
  const [selected, setSelected] = useState<ReadonlySet<Key>>(new Set());
  const columns: DataTableColumn<DemoJob>[] = [
    { key: 'name', header: 'Name', sortable: true, cell: (j) => <span className="mono text-xs">{j.name}</span> },
    { key: 'status', header: 'Status', cell: (j) => <StatusBadge status={j.status} /> },
    {
      key: 'created',
      header: 'Created',
      sortable: true,
      hideOnMobile: true,
      cell: (j) => <RelativeTime date={j.created} className="text-muted-foreground" />,
    },
    {
      key: 'duration',
      header: 'Took',
      sortable: true,
      align: 'right',
      cell: (j) => (j.duration ? <span className="mono text-xs">{fmtDuration(j.duration)}</span> : '—'),
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        data={DEMO_JOBS}
        columns={columns}
        getRowKey={(j) => j.id}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        defaultSort={{ key: 'created', dir: 'desc' }}
        onRowClick={(j) => toast.info(`Open ${j.name}`)}
      />
      <p className="text-sm text-muted-foreground">
        Click a header to cycle asc → desc → off; rows are keyboardable buttons; {selected.size} selected.
        Narrow the window below 640px (or open this on a phone) and the rows collapse into cards.
      </p>
    </div>
  );
}

function CharRollDemo() {
  const [tokens, setTokens] = useState(184_320);
  const [cost, setCost] = useState(1.28);
  const [step, setStep] = useState(0);
  const status = ['queued', 'running', 'uploading', 'done'][step % 4];

  useEffect(() => {
    const id = setInterval(() => {
      setTokens((t) => t + Math.floor(Math.random() * 9_000) + 400);
      setCost((c) => c + Math.random() * 0.06);
      setStep((s) => s + 1);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const rows: [string, React.ReactNode][] = [
    ['tokens · maxRotations 2', <CharRoll value={fmtNum(tokens)} stagger={40} maxRotations={2} />],
    ['cost · plain roll', <CharRoll value={fmtCost(cost)} />],
    ['raw count', <CharRoll value={tokens} maxRotations={1} />],
    ['string · align start', <CharRoll value={status} align="start" />],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, node]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-muted-foreground">{label}</td>
              <td className="mono px-4 py-2.5 text-right text-foreground">{node}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelativeTimeDemo() {
  const [base] = useState(() => Date.now());
  const rows: [string, number][] = [
    ['20 seconds ago', base - 20_000],
    ['4 minutes ago', base - 4 * 60_000],
    ['3 hours ago', base - 3 * 3_600_000],
    ['9 days ago', base - 9 * 86_400_000],
    ['in 2 hours', base + 2 * 3_600_000],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, t]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 text-muted-foreground">{label}</td>
              <td className="mono px-4 py-2.5 text-right text-foreground">
                <RelativeTime date={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchInputDemo() {
  const [q, setQ] = useState('');
  const hits = nodes.filter((n) =>
    `${n.name} ${n.host} ${n.desc}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <SearchInput
        value={q}
        onValueChange={setQ}
        shortcut
        placeholder="Search the lab…"
        className="max-w-md"
      />
      <p className="mono text-[11px] text-muted-foreground">
        ⌘K or / focuses · Escape clears · {hits.length} / {nodes.length} match
      </p>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-[var(--surface)]">
        {hits.length === 0 ? (
          <EmptyState compact icon={<Inbox />} title="Nothing matches" />
        ) : (
          hits.map((n) => (
            <div
              key={n.name}
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 last:border-0"
            >
              <span className="mono text-sm text-foreground">{n.name}</span>
              <Badge tone={n.kind === 'service' ? 'sky' : n.kind === 'project' ? 'violet' : 'amber'}>
                {n.kind}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DropZoneDemo() {
  const toast = useToast();
  const [files, setFiles] = useState<{ name: string; size: number; url: string }[]>([]);

  return (
    <div className="space-y-4">
      <DropZone
        accept="image/*"
        maxFiles={6}
        maxSize={10 * 1024 * 1024}
        recursive
        hint="images · up to 6 files · 10 MB each · folders welcome"
        onFiles={(picked) =>
          setFiles((prev) =>
            [
              ...prev,
              ...picked.map((f) => ({ name: f.name, size: f.size, url: URL.createObjectURL(f) })),
            ].slice(0, 6),
          )
        }
        onReject={(bad) =>
          toast.error(
            `${bad.length} file(s) rejected — ${[...new Set(bad.map((b) => b.reason))].join(', ')}`,
          )
        }
      />
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {files.map((f) => (
            <figure key={f.url} className="space-y-1">
              <img src={f.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <figcaption className="mono truncate text-[10px] text-muted-foreground">
                {fmtBytes(f.size)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButtonDemo() {
  const { copy, copied } = useCopyToClipboard({ timeout: 1200 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[var(--surface)] px-4 py-2.5">
        <code className="mono truncate text-[13px] text-foreground">npm i @gabvdl/ui</code>
        <CopyButton value="npm i @gabvdl/ui" label="Copy" />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[var(--surface)] px-4 py-2.5">
        <code className="mono truncate text-[13px] text-foreground">https://ui.gabvdl.xyz</code>
        <CopyButton value="https://ui.gabvdl.xyz" share label="Share" />
      </div>
      <div>
        <p className="eyebrow mb-2.5 text-muted-foreground">…or the hook, on your own control</p>
        <Button size="sm" variant="outline" onClick={() => copy('gabvdl/ui')}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'useCopyToClipboard()'}
        </Button>
      </div>
    </div>
  );
}

function ThemeDemo() {
  const { theme, resolved, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This page <em>is</em> the demo — the toggle in the header is the shipped component, and the
        whole site is themed from the same CSS custom properties.
      </p>
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-[var(--surface)] p-5">
        <div className="flex flex-col items-center gap-2">
          <ThemeToggle />
          <span className="mono text-[11px] text-muted-foreground">icon</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <ThemeToggle variant="segmented" />
          <span className="mono text-[11px] text-muted-foreground">segmented</span>
        </div>
        <div className="mono ml-auto text-[11px] text-muted-foreground">
          theme=<span className="text-foreground">{theme}</span> · resolved=
          <span className="text-foreground">{resolved}</span>
          <button
            type="button"
            onClick={() => setTheme('system')}
            className="ml-3 underline underline-offset-2 hover:text-foreground"
          >
            reset to system
          </button>
        </div>
      </div>
    </div>
  );
}

function HooksDemo() {
  const isMobile = useIsMobile();
  const [clicks, setClicks] = useLocalStorage('ui-docs-clicks', 0);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const press = useLongPress((pt) => setMenu(pt), { onClick: () => setMenu(null) });

  const [page, setPage] = useState(1);
  const rows = specimens.slice(0, page * 4);
  const hasMore = rows.length < specimens.length;
  const sentinel = useInfiniteScroll<HTMLDivElement>({
    hasMore,
    onLoadMore: () => setPage((p) => p + 1),
    rootMargin: '40px',
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-[var(--surface)] p-4">
        <p className="eyebrow mb-2 text-muted-foreground">useIsMobile</p>
        <p className="mono text-sm text-foreground">{String(isMobile)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Resize the window — one shared listener.</p>
      </div>

      <div className="rounded-lg border border-border bg-[var(--surface)] p-4">
        <p className="eyebrow mb-2 text-muted-foreground">useLocalStorage</p>
        <DemoRow>
          <Button size="sm" variant="outline" onClick={() => setClicks((c) => c + 1)}>
            clicked {clicks}×
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setClicks(0)}>
            reset
          </Button>
        </DemoRow>
        <p className="mt-2 text-xs text-muted-foreground">
          Survives a reload, and syncs across tabs.
        </p>
      </div>

      <div className="relative rounded-lg border border-border bg-[var(--surface)] p-4">
        <p className="eyebrow mb-2 text-muted-foreground">useLongPress</p>
        <div
          {...press}
          className="flex h-20 cursor-pointer select-none items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
        >
          hold me (or right-click)
        </div>
        {menu && (
          <div className="mono mt-2 text-[11px] text-[color:var(--cyan-deep)]">
            fired at {Math.round(menu.x)}, {Math.round(menu.y)} — anchor a menu there
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-[var(--surface)] p-4">
        <p className="eyebrow mb-2 text-muted-foreground">useInfiniteScroll</p>
        <div className="h-20 overflow-y-auto rounded-lg border border-border">
          {rows.map((s) => (
            <div key={s.id} className="mono border-b border-border px-3 py-1.5 text-xs last:border-0">
              {s.label}
            </div>
          ))}
          <div ref={sentinel} className="p-2 text-center">
            {hasMore ? <Spinner size="sm" /> : <span className="mono text-[10px] text-muted-foreground">end</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormatDemo() {
  const [now] = useState(() => Date.now());
  const rows: [string, string][] = [
    [`relTime(now - 4min)`, relTime(now - 4 * 60_000, now)],
    [`relTime('2026-07-03')`, relTime('2026-07-03T00:00:00Z', now)],
    [`fmtDuration(128400)`, fmtDuration(128_400)],
    [`fmtDuration(840)`, fmtDuration(840)],
    [`fmtBytes(1483776)`, fmtBytes(1_483_776)],
    [`fmtNum(12402)`, fmtNum(12_402)],
    [`fmtCost(0.00412)`, fmtCost(0.00412)],
    [`fmtCost(12.5)`, fmtCost(12.5)],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([call, out]) => (
            <tr key={call} className="border-b border-border last:border-0">
              <td className="mono px-4 py-2 text-[12px] text-muted-foreground">{call}</td>
              <td className="mono px-4 py-2 text-right text-[13px] tabular-nums text-foreground">{out}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
