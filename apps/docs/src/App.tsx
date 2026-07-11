import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Copy } from 'lucide-react';
import {
  Button,
  Changelog,
  type ChangelogEntry,
  Dock,
  DockProvider,
  FloatingPanel,
  FuzzyList,
  ImageViewerProvider,
  Input,
  Nav2DProvider,
  Nav2DItem,
  useNav2D,
  PhonePreview,
  ProgressiveBash,
  type BashEntry,
  type ProgressiveBashHandle,
  ProgressiveImage,
  ProgressiveList,
  ProgressiveTable,
  ProgressiveText,
  ViewableImage,
  VirtualList,
  cn,
} from '@gabvdl/ui';

import {
  CnIcon,
  ButtonIcon,
  ChangelogIcon,
  FloatingPanelIcon,
  FuzzyListIcon,
  ImageViewerIcon,
  InputIcon,
  Nav2DIcon,
  PhonePreviewIcon,
  ProgressiveBashIcon,
  ProgressiveImageIcon,
  ProgressiveListIcon,
  ProgressiveTableIcon,
  ProgressiveTextIcon,
  RichInputIcon,
  ViewableImageIcon,
  VirtualListIcon,
} from './icons';
import { SandpackProvider, SandpackCodeEditor, type SandpackTheme } from '@codesandbox/sandpack-react';
import { RichInputPage } from './pages/RichInputPage';
import { changelog, fullUrl, nodes, specimenFulls, specimens, thumbUrl, type Node } from './data';

const VERSION = '0.6.0';
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
  'Utilities',
] as const;
type Group = (typeof GROUPS)[number];

const GROUP_OF: Record<string, Group> = {
  'image-viewer': 'Media',
  'viewable-image': 'Media',
  'progressive-image': 'Media',
  'fuzzy-list': 'Data display',
  'virtual-list': 'Data display',
  'progressive-table': 'Data display',
  'nav-2d': 'Navigation',
  button: 'Inputs',
  input: 'Inputs',
  'rich-input': 'Inputs',
  'progressive-text': 'Animation',
  'progressive-list': 'Animation',
  'progressive-bash': 'Animation',
  changelog: 'Feedback',
  'phone-preview': 'Layout',
  'floating-panel': 'Layout',
  cn: 'Utilities',
};

const GROUP_BLURB: Record<Group, string> = {
  Media: 'Images — a full-screen viewer, click-to-open thumbnails, and lazy blur-up loading.',
  'Data display': 'Windowed, searchable and reveal-animated lists and tables for large datasets.',
  Navigation: 'Spatial, joystick-driven selection over a 2-D field of targets.',
  Inputs: 'Form primitives and the batteries-included composer.',
  Animation: 'Typewriter text and staggered reveals that share one timeline.',
  Feedback: 'Release notes, a changelog modal, and an update toast.',
  Layout: 'Device frames and scaffolding.',
  Utilities: 'The class-name helper every component is built on.',
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
  'virtual-list': 'virtual-list.tsx',
  'progressive-text': 'progressive-text.tsx',
  'progressive-list': 'progressive-list.tsx',
  'progressive-table': 'progressive-table.tsx',
  'progressive-bash': 'progressive-bash.tsx',
  changelog: 'changelog.tsx',
  'phone-preview': 'phone-preview.tsx',
  'floating-panel': 'floating-panel.tsx',
  'nav-2d': 'nav-2d.tsx',
  button: 'button.tsx',
  input: 'input.tsx',
  'rich-input': 'rich-input.tsx',
  cn: 'utils.ts',
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
  renderItem={({ highlight }) => (
    <Row>
      <b>{highlight('name')}</b>
      <p>{highlight('desc', { snippet: true })}</p>
    </Row>
  )}
/>`,
  },
  {
    id: 'virtual-list',
    name: 'VirtualList',
    sig: '<T>(items, renderItem, smooth?, onEndReached?)',
    tag: 'data',
    Icon: VirtualListIcon,
    Demo: VirtualListDemo,
    code: `<VirtualList
  items={rows}                  // re-sorted as data changes
  className="h-96"              // bounded height
  estimateSize={56}             // heights are then measured
  smooth                        // glide rows to their new slot on reorder
  getItemKey={(row) => row.id}  // stable identity — required for smooth
  hasMore={hasMore}
  loading={loading}
  onEndReached={loadNextPage}   // infinite lazy load
  renderItem={(row) => <Row {...row} />}
/>`,
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
    sig: 'entries · typeSpeed · outputSpeed · timestamp gaps',
    tag: 'animation',
    Icon: ProgressiveBashIcon,
    Demo: ProgressiveBashDemo,
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
ref.current?.skipToEnd()`,
  },
  {
    id: 'changelog',
    name: 'Changelog',
    sig: 'entries? · trigger · reload toast',
    tag: 'feedback',
    Icon: ChangelogIcon,
    Demo: ChangelogDemo,
    code: `// headless SDK, or pass entries directly
<Changelog
  entries={page}
  hasMore={hasMore}
  loading={loading}
  onLoadMore={loadOlder}       // list virtualized + paged
  newVersion={update}          // drive the reload toast yourself
  onDismissNewVersion={clear}
/>  // + a "new version" reload toast`,
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
    id: 'floating-panel',
    name: 'FloatingPanel',
    sig: 'DockProvider · FloatingPanel · Dock — drag · resize · tabs',
    tag: 'layout',
    Icon: FloatingPanelIcon,
    Demo: FloatingPanelDemo,
    code: `// draggable/resizable windows that snap into a Dock;
// panels sharing one dock become tabs. Drag a header
// onto the dock to snap in, drag a tab out to float.
<DockProvider>
  <FloatingPanel id="terminal" dockId="d1" defaultDocked title="Terminal">
    <TerminalBody />
  </FloatingPanel>
  <FloatingPanel id="details" dockId="d1" defaultDocked title="Details">
    <DetailsBody />
  </FloatingPanel>
  <Dock id="d1" className="h-64" />
</DockProvider>`,
  },
  {
    id: 'button',
    name: 'Button',
    sig: "variant · size",
    tag: 'shadcn',
    Icon: ButtonIcon,
    Demo: ButtonDemo,
    code: `<Button>Default</Button>
<Button variant="outline" size="sm">Outline</Button>
<Button variant="destructive">Delete</Button>`,
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
      <ImageViewerProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/c/:id" element={<ComponentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ImageViewerProvider>
    </HashRouter>
  );
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <a href={REPO} target="_blank" rel="noreferrer">
          <Button className="mono text-xs uppercase tracking-[0.12em]">
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
          <entry.Page />
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
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[rgba(255,255,255,0.82)] backdrop-blur-md">
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
        <div className="flex items-center gap-4">
          {!title && (
            <span className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {REGISTRY.length} components
            </span>
          )}
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
          ImageViewer, Nav2D, ViewableImage, ProgressiveImage, ProgressiveText, ProgressiveList,
          ProgressiveTable, FuzzyList, PhonePreview, Button, Input, RichInput, cn
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
      placeholder="Search the homelab…"
      autoFocus
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

function VirtualListDemo() {
  const [smooth, setSmooth] = useState(true);
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

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(bump, 1100);
    return () => clearInterval(t);
  }, [playing]);

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
      </div>
      <VirtualList
        items={sorted}
        className="h-[360px] rounded-lg border border-border"
        estimateSize={48}
        smooth={smooth}
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
        rows glide vs. teleport · scroll to see windowing
      </p>
    </div>
  );
}

function ChangelogDemo() {
  const PAGE = 8;
  const [count, setCount] = useState(8);
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
    </div>
  );
}

function ButtonDemo() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="icon" aria-label="Add">
          <Copy />
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
  const ref = useRef<ProgressiveBashHandle>(null);
  return (
    <div className="space-y-4">
      <div className="h-80 overflow-hidden rounded-md border border-border">
        <ProgressiveBash
          key={runId}
          apiRef={ref}
          entries={entries}
          className="h-80"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setRunId((n) => n + 1)}>
          Replay
        </Button>
        <Button size="sm" variant="ghost" onClick={() => ref.current?.skipToEnd()}>
          Skip
        </Button>
      </div>
      <p className="mono text-[11px] text-muted-foreground">
        5 entries · real gaps span 2 min, compressed into a continuous replay · types commands, reveals output line-by-line
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
          defaultGeom={{ width: 340, height: 200 }}
        >
          <div className="p-3 text-sm text-foreground">
            <p className="text-muted-foreground">
              Two panels share one dock, so they show up as tabs. Drag a tab out to float it as a
              window; drag the header back onto the dock to snap it in.
            </p>
          </div>
        </FloatingPanel>
        <Dock
          id="fp-dock"
          className="h-64 rounded-lg border border-dashed border-border"
        />
      </DockProvider>
      <p className="mono text-[11px] text-muted-foreground">
        drag a tab out to float · drag a header onto the dock to snap in · panels sharing a dock become tabs · a floating panel portals to document.body (position:fixed), so it escapes this card — expected
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
