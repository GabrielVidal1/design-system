import { useState, type ReactNode } from 'react';
import { Crosshair, Hand, Pointer } from 'lucide-react';
import {
  Badge,
  Button,
  ElementPicker,
  ElementPickerField,
  ElementPreview,
  type PickedElement,
} from '@gabvdl/ui';

/* ── shared bits ─────────────────────────────────────────────────────────── */
function Section({
  n,
  title,
  children,
  code,
  aside,
}: {
  n: number;
  title: string;
  children: ReactNode;
  code?: string;
  aside?: ReactNode;
}) {
  return (
    <section className="border-t border-border py-10 first:border-t-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="mono text-[11px] text-[color:var(--cyan-deep)]">{String(n).padStart(2, '0')}</span>
        <h2 className="display text-xl text-foreground">{title}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="min-w-0">{children}</div>
        <div className="min-w-0 space-y-3">
          {aside}
          {code && <Code code={code} />}
        </div>
      </div>
    </section>
  );
}

function Code({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[var(--surface)]">
      <pre className="overflow-x-auto p-3.5 text-[0.72rem] leading-relaxed">
        <code className="mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-[var(--surface)] p-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/* ── the page you pick from ──────────────────────────────────────────────── */

/**
 * A little pretend product page. It is deliberately made of ordinary things —
 * a nav, a heading, a form, two cards — because the point of the picker is that
 * it works on markup it knows nothing about.
 */
function SamplePage() {
  return (
    <div className="space-y-5 p-5">
      <nav className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-sm font-semibold text-foreground">Acme</span>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <a href="#/c/element-picker" onClick={(e) => e.preventDefault()}>
            Pricing
          </a>
          <a href="#/c/element-picker" onClick={(e) => e.preventDefault()}>
            Docs
          </a>
        </div>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Ship it on Friday</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Everything your team needs to deploy, and nothing it doesn't. Free while you're small.
        </p>
        <button
          type="button"
          className="rounded-lg bg-[color:var(--cyan-deep)] px-4 py-2 text-sm font-medium text-white"
        >
          Start free
        </button>
      </header>

      <form className="grid gap-3 rounded-xl border border-border bg-[var(--surface)] p-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-foreground">Work email</span>
          <input
            type="email"
            name="email"
            placeholder="you@acme.com"
            defaultValue="ada@acme.com"
            className="h-9 w-full rounded-md border border-border bg-transparent px-2.5 text-sm outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-foreground">Team size</span>
          <select
            name="size"
            defaultValue="10-50"
            className="h-9 w-full rounded-md border border-border bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="1-9">1–9</option>
            <option value="10-50">10–50</option>
            <option value="50+">50+</option>
          </select>
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="updates" defaultChecked className="size-4" />
          <span className="text-xs text-muted-foreground">Send me product updates</span>
        </label>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { title: 'Preview deploys', body: 'Every branch gets a URL, torn down when it merges.' },
          { title: 'Zero-downtime', body: 'Health-gated cutover. The old one stays up until the new one answers.' },
        ].map((card) => (
          <article key={card.title} className="card space-y-1 rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
            <p className="text-xs text-muted-foreground">{card.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

const Frame = ({ children, root }: { children: ReactNode; root: (el: HTMLDivElement | null) => void }) => (
  <div className="overflow-hidden rounded-xl border border-border bg-background">
    <div className="flex items-center gap-1.5 border-b border-border bg-[var(--surface)] px-3 py-2">
      <span className="size-2 rounded-full bg-rose-400/70" />
      <span className="size-2 rounded-full bg-amber-400/70" />
      <span className="size-2 rounded-full bg-emerald-400/70" />
      <span className="mono ml-2 text-[10px] text-muted-foreground">acme.com</span>
    </div>
    <div ref={root}>{children}</div>
  </div>
);

/* ── 01 · the field ──────────────────────────────────────────────────────── */
function FieldDemo() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<PickedElement[]>([]);

  return (
    <Section
      n={1}
      title="Point at a page and take it apart"
      code={`const [picked, setPicked] = useState<PickedElement[]>([])

<ElementPickerField
  root={pageEl}          // only pick inside this
  value={picked}
  onChange={setPicked}
/>

// each entry: the live node + a serializable parse
picked[0].element  // HTMLElement
picked[0].info     // { tag, kind, text, selector,
                   //   hierarchy, styles, … }`}
      aside={
        <Note>
          <strong className="text-foreground">Hover</strong> draws the devtools box model — margin, border, padding,
          content — over whatever is under the cursor. <strong className="text-foreground">Click</strong> selects it;
          click it again to drop it. <kbd className="mono rounded border border-border px-1">↑</kbd> walks up to the
          parent without moving the mouse, and <kbd className="mono rounded border border-border px-1">Esc</kbd> gets
          you out.
        </Note>
      }
    >
      <div className="space-y-4">
        <Frame root={setRoot}>
          <SamplePage />
        </Frame>

        <ElementPickerField
          root={root}
          value={picked}
          onChange={setPicked}
          label="Selected elements"
          hint="Pick the bits of the page above you care about — text, an input, a whole card."
        />

        {picked.length > 0 && (
          <details className="rounded-xl border border-border bg-[var(--surface)] p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              The value ({picked.length} element{picked.length > 1 ? 's' : ''}) as JSON
            </summary>
            <pre className="mono mt-2 max-h-64 overflow-auto text-[0.68rem] leading-relaxed text-muted-foreground">
              {JSON.stringify(
                picked.map((p) => ({
                  tag: p.info.tag,
                  kind: p.info.kind,
                  selector: p.info.selector,
                  text: p.info.text.slice(0, 60),
                  depth: p.info.depth,
                })),
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </div>
    </Section>
  );
}

/* ── 02 · touch ──────────────────────────────────────────────────────────── */
function TouchSection() {
  return (
    <Section
      n={2}
      title="On a touchscreen, hover is a gesture"
      code={`<ElementPickerField
  holdDelay={350}      // hold before hover mode
  moveTolerance={12}   // px of drift = a scroll, not a hold
/>`}
      aside={
        <Note>
          A phone has no hover, so the picker borrows one. Nothing here is a separate mobile component — the same
          <code className="mono"> ElementPicker </code> handles both pointers.
        </Note>
      }
    >
      <ol className="space-y-3">
        {[
          {
            Icon: Hand,
            title: 'Press and hold',
            body: 'A short hold arms hover mode, with a tick of haptics so you feel it land. Before that, the page scrolls exactly as it normally does — the picker only takes the touch once you commit to holding.',
          },
          {
            Icon: Pointer,
            title: 'Drag to preview',
            body: 'Elements light up under your finger as it moves. Scrolling is suppressed for the length of the hold, so the page stays put while you hunt.',
          },
          {
            Icon: Crosshair,
            title: 'Lift to select',
            body: 'Whatever was highlighted when you let go is what you picked. A plain tap — no hold — picks straight away.',
          },
        ].map(({ Icon, title, body }, i) => (
          <li key={title} className="flex gap-3 rounded-xl border border-border bg-[var(--surface)] p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--cyan)]/15 text-[color:var(--cyan-deep)]">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                <span className="mono mr-1.5 text-[11px] text-muted-foreground">{i + 1}</span>
                {title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ── 03 · filter ─────────────────────────────────────────────────────────── */
function FilterDemo() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<PickedElement[]>([]);

  return (
    <Section
      n={3}
      title="Narrow what counts as pickable"
      code={`<ElementPickerField
  root={pageEl}
  filter={(el) => el.matches('.card')}
/>`}
      aside={
        <Note>
          When an element fails the filter the picker walks <em>up</em> to the nearest ancestor that passes — so
          pointing anywhere inside a card still picks the card, not the paragraph you happened to hit. Pass{' '}
          <code className="mono">max</code> to cap the selection, or <code className="mono">multiple={'{false}'}</code>{' '}
          for a single-value input.
        </Note>
      }
    >
      <div className="space-y-4">
        <Frame root={setRoot}>
          <SamplePage />
        </Frame>

        <ElementPickerField
          root={root}
          filter={(el) => el.matches('.card')}
          value={picked}
          onChange={setPicked}
          multiple={false}
          defaultView="preview"
          label="Pick one card"
          pickLabel="Pick a card"
          emptyLabel="Only the two cards can be picked"
          hint="Everything else in the page above is inert — point at a paragraph and it still selects its card."
        />
      </div>
    </Section>
  );
}

/* ── 04 · headless ───────────────────────────────────────────────────────── */
function HeadlessDemo() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [last, setLast] = useState<PickedElement | null>(null);

  return (
    <Section
      n={4}
      title="Or wire it yourself"
      code={`<ElementPicker root={pageEl} multiple={false} onPick={setLast}>
  {({ active, start, hovered }) => (
    <Button onClick={start}>
      {hovered ? hovered.tagName : 'Pick'}
    </Button>
  )}
</ElementPicker>

// no chrome at all:
const picker = useElementPicker({ root })`}
      aside={
        <Note>
          <code className="mono">ElementPicker</code> renders only the overlay and hands you the live picker through a
          render prop — the trigger, the readout and the shape of the result are yours.{' '}
          <code className="mono">useElementPicker</code> drops the overlay too.
        </Note>
      }
    >
      <div className="space-y-4">
        <Frame root={setRoot}>
          <SamplePage />
        </Frame>

        <ElementPicker root={root} multiple={false} onPick={setLast}>
          {({ active, start, stop, hovered }) => (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-[var(--surface)] p-3">
              <Button
                size="sm"
                variant={active ? 'default' : 'outline'}
                icon={<Crosshair />}
                onClick={active ? stop : start}
              >
                {active ? 'Picking…' : 'Pick one element'}
              </Button>

              <span className="mono text-xs text-muted-foreground">
                {active
                  ? hovered
                    ? `over <${hovered.tagName.toLowerCase()}>`
                    : 'point at the page…'
                  : 'idle'}
              </span>

              {last && (
                <div className="ml-auto flex items-center gap-2">
                  <Badge tone="sky">{last.info.kind}</Badge>
                  <ElementPreview element={last.element} height={40} className="w-28" />
                </div>
              )}
            </div>
          )}
        </ElementPicker>
      </div>
    </Section>
  );
}

/* ── 05 · the parse ──────────────────────────────────────────────────────── */
function ParseSection() {
  return (
    <Section
      n={5}
      title="What comes back"
      code={`import { parseElement } from '@gabvdl/ui'

const info = parseElement(el, { root: page })

info.kind        // 'input' | 'button' | 'heading' | …
info.text        // visible text, whitespace-collapsed
info.selector    // 'form > label:nth-of-type(2) > select'
info.hierarchy   // [{ tag, id, classes, nth }, …]
info.depth       // 3
info.styles      // only what was actually set
info.field       // { type, name, value, options } for inputs
info.outerHTML   // the full markup`}
      aside={
        <Note>
          Everything on <code className="mono">info</code> is plain data — no DOM nodes — so it survives{' '}
          <code className="mono">JSON.stringify</code>. That's the point: this is how you hand an LLM, a scraper or a
          bug report the exact bits of a page someone meant.
        </Note>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['Identity', 'tag, kind, id, classes, role, accessible label'],
          ['Hierarchy', 'unique selector, readable path, depth, index among siblings, child count'],
          ['Content', 'text only, innerHTML, and the formatted outerHTML'],
          ['Styles', 'the computed properties that were actually set — grouped layout / box / type / visual'],
          ['Attributes', 'every attribute, plus the dataset split out'],
          ['Fields', 'for inputs: type, name, live value, placeholder, checked, options'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border border-border bg-[var(--surface)] p-3.5">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ElementPickerPage() {
  return (
    <div>
      <FieldDemo />
      <TouchSection />
      <FilterDemo />
      <HeadlessDemo />
      <ParseSection />
    </div>
  );
}
