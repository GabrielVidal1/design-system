import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Badge, Button, Input, StatusBadge, cn } from '@gabvdl/ui';

/**
 * Mirrors `ThemeToken` in the plugin (apps/docs/plugins/theme-tokens.ts), which
 * reads packages/ui/src/styles/theme.css at build time and writes
 * public/theme-tokens.json — so this table can never drift from the shipped CSS.
 */
interface ThemeToken {
  name: string;
  light?: string;
  dark?: string;
}

let cache: Promise<ThemeToken[]> | null = null;

/** Fetch the generated token list once, lazily. */
function loadThemeTokens(): Promise<ThemeToken[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}theme-tokens.json`).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<ThemeToken[]>;
  });
  return cache;
}

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

/* ── token table ──────────────────────────────────────────────────────────── */
const isColor = (value: string) => /^(#|rgb|hsl|oklch|color\()/i.test(value);

function TokenValue({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {isColor(value) && (
        <span className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-border" style={{ background: value }} />
      )}
      <span className="mono text-[12px]">{value}</span>
    </span>
  );
}

function TokenTable() {
  const [tokens, setTokens] = useState<ThemeToken[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadThemeTokens()
      .then((t) => alive && setTokens(t))
      .catch(() => alive && setTokens([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!tokens) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-[var(--surface)]">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {['Token', 'Light', 'Dark'].map((h) => (
              <th key={h} className="eyebrow px-4 py-2.5 font-normal text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.name} className="border-b border-border last:border-b-0">
              <td className="mono min-w-40 px-4 py-2 text-foreground">{t.name}</td>
              <td className="px-4 py-2 text-foreground">
                <TokenValue value={t.light} />
              </td>
              <td className="px-4 py-2 text-foreground">
                <TokenValue value={t.dark} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── the live retheme ─────────────────────────────────────────────────────── */
interface Preset {
  id: string;
  label: string;
  /** Custom-property overrides applied to the demo's ancestor — nothing else. */
  vars: Record<string, string>;
}

const PRESETS: Preset[] = [
  { id: 'library', label: 'Library default', vars: {} },
  {
    id: 'moss',
    label: 'Moss',
    vars: {
      '--background': '#f6f8f2',
      '--foreground': '#1a2e1a',
      '--card': '#fdfefb',
      '--card-foreground': '#1a2e1a',
      '--primary': '#2f6b2f',
      '--primary-foreground': '#f6fbf2',
      '--secondary': '#e4ecdc',
      '--secondary-foreground': '#1a2e1a',
      '--muted': '#e4ecdc',
      '--muted-foreground': '#5a6f56',
      '--accent': '#dcead2',
      '--accent-foreground': '#234d23',
      '--border': '#cfdcc4',
      '--input': '#cfdcc4',
      '--ring': '#4f8f4f',
      '--radius': '0.25rem',
    },
  },
  {
    id: 'safelight',
    label: 'Safelight',
    vars: {
      '--background': '#1c130b',
      '--foreground': '#f5e5d0',
      '--card': '#271b10',
      '--card-foreground': '#f5e5d0',
      '--primary': '#f0a63c',
      '--primary-foreground': '#211405',
      '--secondary': '#332414',
      '--secondary-foreground': '#f5e5d0',
      '--muted': '#332414',
      '--muted-foreground': '#c29a6b',
      '--accent': '#3c2a16',
      '--accent-foreground': '#f8ce93',
      '--border': '#41301c',
      '--input': '#41301c',
      '--ring': '#f0a63c',
      '--radius': '0.625rem',
    },
  },
  {
    id: 'berry',
    label: 'Berry',
    vars: {
      '--background': '#fdf6fb',
      '--foreground': '#3d1130',
      '--card': '#ffffff',
      '--card-foreground': '#3d1130',
      '--primary': '#a41e7e',
      '--primary-foreground': '#fdf3fa',
      '--secondary': '#f6e4f0',
      '--secondary-foreground': '#3d1130',
      '--muted': '#f6e4f0',
      '--muted-foreground': '#8d5f7f',
      '--accent': '#fae0f1',
      '--accent-foreground': '#7c1560',
      '--border': '#ecd0e2',
      '--input': '#ecd0e2',
      '--ring': '#c9459f',
      '--radius': '1.25rem',
    },
  },
];

function RethemeDemo() {
  const [preset, setPreset] = useState(PRESETS[0]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p)}
            className={cn(
              'mono rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
              preset.id === p.id
                ? 'border-[color:var(--cyan-deep)] bg-[var(--tint-strong)] text-[color:var(--cyan-deep)]'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* The overrides land on THIS div only — the components inside are the
          exact same shipped code the rest of the site runs. */}
      <div
        style={preset.vars as CSSProperties}
        className="space-y-4 rounded-xl border border-border bg-background p-5 text-foreground transition-colors"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Badge tone="sky" dot>
            badge
          </Badge>
          <StatusBadge status="running" />
        </div>
        <Input placeholder="An input, same tokens…" className="max-w-sm" />
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <Inbox className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">A card, recoloured from the outside</p>
            <p className="mt-1 text-muted-foreground">
              No component here received a prop or a class — the ancestor's custom properties changed,
              nothing else.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── the page ─────────────────────────────────────────────────────────────── */
export function ThemingPage() {
  return (
    <div>
      <div className="py-10">
        <p className="eyebrow mb-3">Theming</p>
        <h1 className="display max-w-2xl text-3xl text-foreground sm:text-4xl">
          Every colour reads from a custom property.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          The library never hard-codes a colour: components style themselves from the tokens in{' '}
          <code className="mono text-foreground">@gabvdl/ui/theme.css</code>. Override any of them —
          on <code className="mono text-foreground">:root</code>, a{' '}
          <code className="mono text-foreground">.dark</code> ancestor, or any scoped element — and
          everything inside recolours without touching component code. This very site is the shipped
          library re-inked from those tokens.
        </p>
      </div>

      <Section n={1} title="The tokens">
        <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Extracted from the shipped stylesheet at build time — light values live on{' '}
          <code className="mono text-foreground">:root</code>, dark ones under{' '}
          <code className="mono text-foreground">.dark</code>. A Tailwind v4{' '}
          <code className="mono text-foreground">@theme inline</code> block maps each one into
          utilities (<code className="mono text-foreground">bg-primary</code>,{' '}
          <code className="mono text-foreground">border-border</code>, …).
        </p>
        <TokenTable />
      </Section>

      <Section n={2} title="Retheme, live">
        <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Pick a register. The presets below set a handful of custom properties on the demo's wrapper{' '}
          <code className="mono text-foreground">div</code> — the shipped components inside pick them
          up instantly.
        </p>
        <RethemeDemo />
      </Section>

      <Section n={3} title="In your app">
        <div className="grid gap-5 lg:grid-cols-2">
          <Code
            lang="global — the whole app"
            code={`/* after @import "@gabvdl/ui/styles.css" */\n:root {\n  --primary: #2f6b2f;\n  --ring: #4f8f4f;\n  --radius: 0.25rem;\n}`}
          />
          <Code
            lang="scoped — one subtree"
            code={`<div style={{\n  '--primary': '#a41e7e',\n  '--radius': '1.25rem',\n}}>\n  <Button>Berry themed</Button>\n</div>`}
          />
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          Dark mode is the same mechanism: add the <code className="mono text-foreground">.dark</code>{' '}
          class to any ancestor (the library's own{' '}
          <code className="mono text-foreground">ThemeToggle</code> does exactly that on{' '}
          <code className="mono text-foreground">&lt;html&gt;</code>) and the{' '}
          <code className="mono text-foreground">.dark</code> block of values takes over.
        </p>
      </Section>
    </div>
  );
}
