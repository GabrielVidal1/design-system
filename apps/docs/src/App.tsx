import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Copy, X } from 'lucide-react';
import {
  Button,
  FuzzyList,
  ImageViewerProvider,
  Input,
  PhonePreview,
  ProgressiveImage,
  ViewableImage,
  cn,
} from '@gabvdl/ui';

import {
  CnIcon,
  ButtonIcon,
  FuzzyListIcon,
  ImageViewerIcon,
  InputIcon,
  PhonePreviewIcon,
  ProgressiveImageIcon,
  ViewableImageIcon,
} from './icons';
import { fullUrl, nodes, specimenFulls, specimens, thumbUrl, type Node } from './data';

const VERSION = '0.1.0';
const REPO = 'https://gitea.lab.gabvdl.xyz/gabrielvidal/design-system';

interface Entry {
  id: string;
  name: string;
  sig: string;
  tag: string;
  Icon: () => ReactNode;
  Demo: () => ReactNode;
  code: string;
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
    code: `<Input placeholder="Search…" />`,
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
  const [open, setOpen] = useState<Entry | null>(null);
  return (
    <ImageViewerProvider>
      <Header count={REGISTRY.length} />
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <ImportLine />
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {REGISTRY.map((e) => (
            <ComponentCard key={e.id} entry={e} onOpen={() => setOpen(e)} />
          ))}
        </section>
      </main>
      <Footer />
      {open && <DemoModal entry={open} onClose={() => setOpen(null)} />}
    </ImageViewerProvider>
  );
}

function Header({ count }: { count: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[rgba(7,30,46,0.72)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-baseline gap-2">
          <span className="mono text-sm text-foreground">gabvdl</span>
          <span className="mono text-sm text-[color:var(--cyan)]">/ui</span>
          <span className="mono text-[11px] text-muted-foreground">v{VERSION}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {count} components
          </span>
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
    <div className="my-8 overflow-x-auto rounded-lg border border-border bg-[rgba(4,15,22,0.5)] px-4 py-3">
      <code className="mono whitespace-pre text-[0.8rem] leading-relaxed">
        <span className="text-[color:var(--cyan-deep)]">import</span>
        <span className="text-muted-foreground"> {'{ '}</span>
        <span className="text-foreground">
          ImageViewer, ViewableImage, ProgressiveImage, FuzzyList, PhonePreview, Button, Input, cn
        </span>
        <span className="text-muted-foreground">{' }'} </span>
        <span className="text-[color:var(--cyan-deep)]">from</span>
        <span className="text-[color:var(--cyan)]"> '@gabvdl/ui'</span>
      </code>
    </div>
  );
}

function ComponentCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const { name, sig, tag, Icon } = entry;
  return (
    <button className="comp-card group" onClick={onOpen} aria-label={`Open ${name} demo`}>
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
    </button>
  );
}

function DemoModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const { name, sig, Demo, code } = entry;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[rgba(4,15,22,0.7)] p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <span className="mono text-sm text-foreground">{name}</span>
            <span className="mono ml-2 text-[11px] text-muted-foreground">{sig}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="rounded-lg border border-border bg-[rgba(4,15,22,0.35)] p-4">
            <Demo />
          </div>
          <div className="mt-4">
            <CodeBlock code={code} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Demos ────────────────────────────────────────────────────────────────── */
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
            'mb-1 cursor-pointer rounded-lg border px-3 py-2 transition-colors',
            active ? 'border-[color:var(--cyan)]/50 bg-[rgba(94,198,232,0.08)]' : 'border-transparent hover:bg-[rgba(94,198,232,0.05)]',
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
                <div key={t} className="rounded-lg border border-border bg-[rgba(94,198,232,0.05)] px-3 py-2">
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
      <Input disabled placeholder="Disabled" />
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
        <div key={input} className="flex flex-col gap-1 rounded-md border border-border bg-[rgba(4,15,22,0.4)] p-2 sm:flex-row sm:items-center sm:gap-3">
          <code className="text-muted-foreground">{input}</code>
          <span className="text-[color:var(--cyan-deep)]">→</span>
          <code className="text-[color:var(--cyan)]">'{output}'</code>
        </div>
      ))}
    </div>
  );
}

/* ─── Bits ─────────────────────────────────────────────────────────────────── */
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-[rgba(4,15,22,0.6)]">
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className="absolute right-2.5 top-2.5 z-10 inline-flex size-8 items-center justify-center rounded-md border border-border bg-[rgba(10,39,57,0.7)] text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="size-4 text-[color:var(--cyan)]" /> : <Copy className="size-4" />}
      </button>
      <pre className="overflow-x-auto p-4 pr-12 text-[0.8rem] leading-relaxed">
        <code className="mono text-[color:var(--paper)]">{code}</code>
      </pre>
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
