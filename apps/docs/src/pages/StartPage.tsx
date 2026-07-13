import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button, CopyButton, ViewableImage } from '@gabvdl/ui';
import { fullUrl, specimens, thumbUrl } from '../data';

/* ── shared bits (same specimen-sheet grammar as the component pages) ─────── */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10 first:border-t-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="mono text-[11px] text-[color:var(--cyan-deep)]">{String(n).padStart(2, '0')}</span>
        <h2 className="display text-xl text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Code({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[var(--surface)]">
      {lang && (
        <div className="border-b border-border px-3.5 py-1.5 mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-3.5 text-[0.78rem] leading-relaxed">
        <code className="mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

/* ── the six style entry points, straight off packages/ui exports ─────────── */
const STYLE_ENTRIES: [string, string][] = [
  ['@gabvdl/ui/styles.css', 'everything — tokens + every component stylesheet'],
  ['@gabvdl/ui/theme.css', 'design tokens only (see the Theming page)'],
  ['@gabvdl/ui/image-viewer.css', 'the full-screen viewer overlay only'],
  ['@gabvdl/ui/virtual-list.css', 'VirtualList row transitions only'],
  ['@gabvdl/ui/overlay.css', 'Modal + Toast motion only'],
  ['@gabvdl/ui/tooltip.css', 'Button tooltips only'],
];

const GALLERY_CODE = `import { ImageViewerProvider, ViewableImage } from '@gabvdl/ui'

export function Gallery({ urls }: { urls: string[] }) {
  return (
    <ImageViewerProvider>
      {urls.map((url, i) => (
        <ViewableImage key={url} images={urls} index={i} full={url} alt={\`Plate \${i + 1}\`} />
      ))}
    </ImageViewerProvider>
  )
}`;

const DEMO_SET = specimens.slice(0, 4);
const DEMO_PLATES = DEMO_SET.map((s) => fullUrl(s.id));

export function StartPage() {
  return (
    <div>
      <div className="py-10">
        <p className="eyebrow mb-3">Getting started</p>
        <h1 className="display max-w-2xl text-3xl text-foreground sm:text-4xl">
          Install once, import what you need.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          <span className="mono text-foreground">@gabvdl/ui</span> is tree-shakeable ESM with bundled
          types, built on shadcn primitives over Tailwind v4. Two imports and a CSS line get you the
          whole catalogue.
        </p>
      </div>

      <Section n={1} title="Install">
        <div className="flex max-w-md items-center justify-between gap-3 rounded-lg border border-border bg-[var(--surface)] px-4 py-2.5">
          <code className="mono truncate text-[13px] text-foreground">npm install @gabvdl/ui</code>
          <CopyButton value="npm install @gabvdl/ui" label="Copy" />
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          Peer dependencies: <code className="mono text-foreground">react</code> and{' '}
          <code className="mono text-foreground">react-dom</code> ≥ 18. The package is{' '}
          <b className="text-foreground">ESM-only</b> — no CommonJS build ships. It is an early alpha:
          any 0.x bump may break you, so pin an exact version.
        </p>
      </Section>

      <Section n={2} title="Wire the styles">
        <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Add the library stylesheet to your Tailwind v4 entry — it carries the design tokens and every
          component's CSS:
        </p>
        <Code
          lang="src/index.css"
          code={`@import "tailwindcss";\n@import "@gabvdl/ui/styles.css";`}
        />
        <p className="mt-5 mb-2.5 eyebrow text-muted-foreground">Or pick a narrower entry point</p>
        <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface)]">
          {STYLE_ENTRIES.map(([entry, what]) => (
            <div
              key={entry}
              className="flex flex-col gap-0.5 border-b border-border px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
            >
              <code className="mono text-[13px] text-foreground">{entry}</code>
              <span className="text-[12px] text-muted-foreground">{what}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} title="First component">
        <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          The flagship: a full-screen image viewer with zoom, pan and swipe. Wrap a tree in the
          provider, and any <span className="mono text-foreground">ViewableImage</span> opens the
          viewer over its group — click a plate below.
        </p>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <Code lang="Gallery.tsx" code={GALLERY_CODE} />
          {/* The app root already provides the viewer — these plates open in it. */}
          <div className="grid grid-cols-2 content-start gap-2">
            {DEMO_SET.map((s, i) => (
              <div key={s.id} className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border">
                <ViewableImage
                  images={DEMO_PLATES}
                  index={i}
                  thumb={thumbUrl(s.id)}
                  full={DEMO_PLATES[i]}
                  alt={s.alt}
                  imgClassName="cyanotype group-hover:scale-[1.05]"
                />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section n={4} title="Where next">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/">
            <Button className="mono text-xs uppercase tracking-[0.12em]">Browse the catalogue</Button>
          </Link>
          <Link to="/theming">
            <Button variant="outline" className="mono text-xs uppercase tracking-[0.12em]">
              Theming <ArrowUpRight className="size-4" />
            </Button>
          </Link>
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          Every component card has a live demo, a usage snippet, the full source to copy, and a props
          table generated from the library's TypeScript. Every colour reads from CSS custom properties
          — the Theming page lists all the tokens and proves the retheme live.
        </p>
      </Section>
    </div>
  );
}
