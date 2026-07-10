import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Hand,
  Keyboard,
  Layers,
  Maximize2,
  MousePointerClick,
  Package,
  ScanSearch,
} from 'lucide-react';
import {
  Button,
  ImageViewerProvider,
  Input,
  ViewableImage,
} from '@gabvdl/ui';

import { specimenFulls, specimens, thumbUrl } from './data';

const VERSION = '0.1.0';
const REPO = 'https://gitea.lab.gabvdl.xyz/gabrielvidal/design-system';

export function App() {
  return (
    <ImageViewerProvider>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Catalogue />
        <Components />
        <Install />
        <Tokens />
      </main>
      <Footer />
    </ImageViewerProvider>
  );
}

/* ─── Navigation ───────────────────────────────────────────────────────────── */
function Nav() {
  const links = [
    ['Overview', '#overview'],
    ['Plates', '#plates'],
    ['Components', '#components'],
    ['Install', '#install'],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[rgba(7,30,46,0.72)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a href="#top" className="flex items-baseline gap-2">
          <span className="mono text-sm tracking-tight text-foreground">gabvdl</span>
          <span className="mono text-sm text-[color:var(--cyan)]">/ui</span>
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <a href={REPO} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="mono text-xs uppercase tracking-[0.14em]">
            Source <ArrowUpRight />
          </Button>
        </a>
      </div>
    </header>
  );
}

/* ─── Hero: the flagship, live ─────────────────────────────────────────────── */
function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 md:pt-24">
      <div id="overview" className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rise">
          <p className="eyebrow">Personal design system · Cat. № {VERSION}</p>
          <h1 className="display mt-6 text-[clamp(2.7rem,6.5vw,4.6rem)] text-foreground">
            A component library,
            <br />
            filed like a{' '}
            <span className="italic text-[color:var(--cyan)]">specimen&nbsp;sheet</span>.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            The React parts I reuse across the homelab, catalogued in one place. Tree-shakeable,
            typed, and built on shadcn primitives. The first plate on file: a full-screen image
            viewer with zoom, pan and swipe — lifted straight from the Sherlock project.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#install">
              <Button className="mono text-xs uppercase tracking-[0.14em]">
                <Package /> Get started
              </Button>
            </a>
            <a href="#plates">
              <Button variant="outline" className="mono text-xs uppercase tracking-[0.14em]">
                Open a plate
              </Button>
            </a>
          </div>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
            {[
              ['Format', 'ESM · tree-shakeable'],
              ['Types', 'TypeScript, bundled .d.ts'],
              ['Peer', 'React 18 / 19'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="mono text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--cyan-deep)]">
                  {k}
                </dt>
                <dd className="mt-1 text-sm text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <HeroPlate />
      </div>
    </section>
  );
}

function HeroPlate() {
  const [hero, ...rest] = specimens;
  return (
    <figure className="rise" style={{ animationDelay: '0.12s' }}>
      <div className="plate-frame overflow-hidden rounded-md p-2">
        <div className="group relative aspect-[4/3] overflow-hidden rounded-sm">
          <ViewableImage
            images={specimenFulls}
            index={0}
            thumb={thumbUrl(hero.id)}
            full={specimenFulls[0]}
            alt={hero.alt}
            imgClassName="cyanotype group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-[rgba(4,15,22,0.85)] to-transparent px-3 pb-2.5 pt-8">
            <span className="mono text-[0.62rem] uppercase tracking-[0.2em] text-paper/90 text-[color:var(--paper)]">
              {hero.label}
            </span>
            <span className="mono inline-flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--cyan)]">
              <ScanSearch className="size-3.5" /> Click to inspect
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {rest.slice(0, 4).map((s, i) => (
          <div key={s.id} className="group relative aspect-square overflow-hidden rounded-sm border border-border">
            <ViewableImage
              images={specimenFulls}
              index={i + 1}
              thumb={thumbUrl(s.id)}
              full={specimenFulls[i + 1]}
              alt={s.alt}
              imgClassName="cyanotype group-hover:scale-[1.06]"
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-3 mono text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground">
        Fig. 1 — <span className="text-foreground">&lt;ViewableImage&gt;</span> ×5 sharing one carousel
      </figcaption>
    </figure>
  );
}

/* ─── Features ─────────────────────────────────────────────────────────────── */
function Features() {
  const items = [
    { icon: Maximize2, title: 'Zoom & pan', body: 'Wheel, pinch, double-tap or ± keys — zoom about the cursor, then drag to pan.' },
    { icon: Hand, title: 'Swipe carousel', body: 'One group, one overlay. Swipe or arrow between plates; vertical drag dismisses.' },
    { icon: Layers, title: 'Progressive load', body: 'Blurred thumbnail first, full-res only when it nears the viewport. Galleries stay light.' },
    { icon: Keyboard, title: 'Keyboard & a11y', body: 'Arrows, Escape and focus-visible rings out of the box. Reduced-motion respected.' },
  ];
  return (
    <section className="border-y border-border bg-[rgba(4,15,22,0.35)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-background px-6 py-8 outline outline-1 outline-border">
            <Icon className="size-5 text-[color:var(--cyan)]" strokeWidth={1.6} />
            <h3 className="display mt-4 text-xl text-foreground">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── The catalogue (live demo grid) ───────────────────────────────────────── */
function Catalogue() {
  return (
    <section id="plates" className="mx-auto max-w-6xl px-5 py-20 md:py-28">
      <SectionHead index="01" title="The plates" kicker="Live demo">
        Every image below is a <span className="text-foreground">&lt;ViewableImage&gt;</span> wired to
        the same carousel. Filed in cyanotype; open one to develop it — then zoom, pan, swipe.
      </SectionHead>
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {specimens.map((s, i) => (
          <figure key={s.id} className="group">
            <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-border">
              <ViewableImage
                images={specimenFulls}
                index={i}
                thumb={thumbUrl(s.id)}
                full={specimenFulls[i]}
                alt={s.alt}
                imgClassName="cyanotype group-hover:scale-[1.05]"
              />
              <span className="plate-no pointer-events-none absolute left-2.5 top-1.5 text-lg">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <figcaption className="mt-2 flex items-center justify-between">
              <span className="mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                {s.label}
              </span>
              <MousePointerClick className="size-3.5 text-[color:var(--cyan-deep)] opacity-0 transition-opacity group-hover:opacity-100" />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ─── Component reference ──────────────────────────────────────────────────── */
function Components() {
  return (
    <section id="components" className="border-t border-border bg-[rgba(4,15,22,0.35)]">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <SectionHead index="02" title="Components" kicker="Reference">
          What ships in <span className="text-foreground">@gabvdl/ui</span> today. Import only what you
          use — the rest is tree-shaken away.
        </SectionHead>

        <div className="mt-12 space-y-3">
          <Plate
            n="i"
            name="ImageViewerProvider · useImageViewer"
            role="Context"
            blurb="Wrap the app once. The provider portals a single full-screen overlay to the body and exposes open(images, index) through the useImageViewer() hook."
            code={`import { ImageViewerProvider, useImageViewer } from '@gabvdl/ui'

function App() {
  return (
    <ImageViewerProvider>
      <Gallery />
    </ImageViewerProvider>
  )
}

function OpenButton({ urls }: { urls: string[] }) {
  const { open } = useImageViewer()
  return <button onClick={() => open(urls, 0)}>View</button>
}`}
          />
          <Plate
            n="ii"
            name="ViewableImage"
            role="Component"
            blurb="A clickable image that opens the viewer over its whole group at its own index. Renders a ProgressiveImage inside, so grids stay cheap."
            code={`<ViewableImage
  images={urls}      // the carousel set
  index={i}          // this image's position
  thumb={thumb}      // blurred placeholder
  full={full}        // loaded when in view
  alt="Plate I"
/>`}
          />
          <Plate
            n="iii"
            name="ProgressiveImage"
            role="Component"
            blurb="Blurred thumbnail that upgrades to full-res on scroll (IntersectionObserver), then cross-fades in. Use it standalone anywhere you list images."
            code={`<ProgressiveImage
  thumb={thumb}
  full={full}
  alt="…"
  className="aspect-square rounded-lg"
/>`}
          />
          <Plate
            n="iv"
            name="Button · Input"
            role="Primitives"
            blurb="The shadcn-style basics, styled from the shared tokens. Variants and sizes; everything else is a plain Tailwind className."
            code={`<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost" size="sm">Ghost</Button>
<Input placeholder="Search the catalogue…" />`}
            demo={
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost" size="sm">Ghost</Button>
                <Button variant="destructive" size="sm">Delete</Button>
                <Input placeholder="Search the catalogue…" className="max-w-[16rem]" />
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function Plate({
  n,
  name,
  role,
  blurb,
  code,
  demo,
}: {
  n: string;
  name: string;
  role: string;
  blurb: string;
  code: string;
  demo?: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 rounded-lg border border-border bg-background p-6 md:grid-cols-[0.8fr_1.2fr] md:p-8">
      <div>
        <div className="flex items-center gap-3">
          <span className="plate-no text-2xl">{n}.</span>
          <span className="mono text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--cyan-deep)]">
            {role}
          </span>
        </div>
        <h3 className="display mt-3 text-2xl text-foreground">{name}</h3>
        <p className="mt-3 text-sm text-muted-foreground">{blurb}</p>
        {demo && <div className="mt-6">{demo}</div>}
      </div>
      <CodeBlock code={code} />
    </div>
  );
}

/* ─── Install & usage ──────────────────────────────────────────────────────── */
function Install() {
  return (
    <section id="install" className="mx-auto max-w-6xl px-5 py-20 md:py-28">
      <SectionHead index="03" title="Install" kicker="Get started">
        Two imports and a provider. Bring your own Tailwind v4 — the tokens plug into it.
      </SectionHead>
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <Step n="1" label="Add the package" />
          <CodeBlock code={`npm install @gabvdl/ui`} />
          <Step n="2" label="Import the styles into your Tailwind entry" />
          <CodeBlock
            code={`/* app.css */
@import "tailwindcss";
@import "@gabvdl/ui/styles.css";`}
          />
        </div>
        <div>
          <Step n="3" label="Wrap the app and drop in a plate" />
          <CodeBlock
            code={`import { ImageViewerProvider, ViewableImage } from '@gabvdl/ui'

export function Gallery({ urls }: { urls: string[] }) {
  return (
    <ImageViewerProvider>
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <ViewableImage
            key={url}
            images={urls}
            index={i}
            full={url}
            alt={\`Plate \${i + 1}\`}
          />
        ))}
      </div>
    </ImageViewerProvider>
  )
}`}
          />
        </div>
      </div>
    </section>
  );
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3 first:mt-0">
      <span className="flex size-6 items-center justify-center rounded-full border border-[color:var(--cyan-deep)] mono text-xs text-[color:var(--cyan)]">
        {n}
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}

/* ─── Tokens ───────────────────────────────────────────────────────────────── */
function Tokens() {
  const swatches = [
    ['--background', 'var(--ink-900)'],
    ['--card', 'var(--ink-850)'],
    ['--muted', 'var(--ink-800)'],
    ['--primary', 'var(--cyan)'],
    ['--foreground', 'var(--paper)'],
    ['--safelight', 'var(--safelight)'],
  ];
  return (
    <section className="border-t border-border bg-[rgba(4,15,22,0.35)]">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <SectionHead index="04" title="Retheme it" kicker="Tokens">
          Components read every colour from CSS custom properties. This whole page is the shipped
          library — recoloured to a cyanotype by overriding tokens on <span className="text-foreground">:root</span>,
          with zero changes to component code.
        </SectionHead>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {swatches.map(([name, value]) => (
            <div key={name} className="rounded-md border border-border bg-background p-3">
              <div
                className="h-16 w-full rounded-sm border border-border"
                style={{ background: value }}
              />
              <p className="mt-3 mono text-[0.62rem] text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Shared bits ──────────────────────────────────────────────────────────── */
function SectionHead({
  index,
  title,
  kicker,
  children,
}: {
  index: string;
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-end md:gap-12">
      <div className="flex items-baseline gap-4">
        <span className="plate-no text-5xl md:text-6xl">{index}</span>
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2 className="display mt-2 text-3xl text-foreground md:text-4xl">{title}</h2>
        </div>
      </div>
      <p className="max-w-xl text-muted-foreground md:pb-1.5">{children}</p>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-[rgba(4,15,22,0.6)]">
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a href="#top" className="flex items-baseline gap-2">
            <span className="mono text-sm text-foreground">gabvdl</span>
            <span className="mono text-sm text-[color:var(--cyan)]">/ui</span>
            <span className="mono text-[0.62rem] text-muted-foreground">v{VERSION}</span>
          </a>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Built in the homelab. Cyanotype after Anna Atkins,{' '}
            <span className="mono">Photographs of British Algae</span>, 1843.
          </p>
        </div>
        <div className="flex flex-col gap-2 mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
            Source <ArrowUpRight className="size-3.5" />
          </a>
          <a href="https://www.gabvdl.xyz" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
            gabvdl.xyz <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
