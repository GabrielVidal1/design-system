import { useState, type ReactNode } from 'react';
import {
  ColorThemeProvider,
  PalettePicker,
  PaletteStripes,
  generatePalette,
  type Palette,
} from '@gabvdl/ui';

/* ── shared specimen-sheet bits (mirrors ThemingPage) ─────────────────────── */
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10 first:border-t-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="mono text-[11px] text-[color:var(--cyan-deep)]">
          {String(n).padStart(2, '0')}
        </span>
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

const FONTS = [
  { label: 'System', value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Georgia serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, "JetBrains Mono", monospace' },
];

export function PalettePickerPage() {
  const [palette, setPalette] = useState<Palette>(['#3b82f6', '#22d3ee', '#a855f7']);
  const [themed, setThemed] = useState<Palette>(generatePalette({ count: 4, seed: 7, harmony: 'analogous' }));
  const [font, setFont] = useState(FONTS[0].value);

  return (
    <div>
      <p className="mb-8 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
        Pick and build a colour palette from 3–6 swatches shown as vertical
        stripes. Each swatch is a native colour picker plus a hex field; ＋ adds a
        colour-theory-pleasing next colour and <em>Random</em> regenerates the
        whole thing from a harmony. On desktop the editor is a dropdown anchored
        above the field; on phones it's an overlay pinned to the bottom of the
        screen. <code className="mono">ColorThemeProvider</code> maps a palette
        onto CSS variables so any subtree reskins without touching component code.
      </p>

      <Section n={1} title="The picker">
        <div className="mb-5 max-w-sm">
          <PalettePicker value={palette} onChange={setPalette} />
        </div>
        <PaletteStripes palette={palette} className="mb-5 h-10 w-full max-w-sm" />
        <Code
          lang="tsx"
          code={`import { PalettePicker } from '@gabvdl/ui'
import '@gabvdl/ui/palette.css' // dropdown / sheet motion

const [palette, setPalette] = useState(['#3b82f6', '#22d3ee', '#a855f7'])

<PalettePicker
  value={palette}
  onChange={setPalette}
  min={3}          // fewest swatches (default 3)
  max={6}          // most swatches  (default 6)
  harmony="auto"   // shuffle harmony: analogous | complementary | triadic | …
/>`}
        />
      </Section>

      <Section n={2} title="Retheme a subtree — ColorThemeProvider">
        <div className="mb-5 max-w-sm">
          <PalettePicker value={themed} onChange={setThemed} min={2} max={6} />
        </div>
        <ColorThemeProvider
          palette={themed}
          font={font}
          className="max-w-sm rounded-xl border border-border p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Primary
            </span>
            <span className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground">
              Accent
            </span>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--palette-0)' }}>
            Live-rethemed card
          </h3>
          <p className="text-sm text-muted-foreground">
            Everything inside inherits <code className="mono">--primary</code>,{' '}
            <code className="mono">--accent</code>, <code className="mono">--ring</code> and the
            raw <code className="mono">--palette-N</code> swatches.
          </p>
          <div className="mt-3 flex gap-1.5">
            {themed.map((_, i) => (
              <span
                key={i}
                className="h-6 flex-1 rounded"
                style={{ backgroundColor: `var(--palette-${i})` }}
              />
            ))}
          </div>
        </ColorThemeProvider>
        <div className="mt-4 flex flex-wrap gap-2">
          {FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFont(f.value)}
              className={
                'rounded-md border px-3 py-1.5 text-sm transition-colors ' +
                (font === f.value
                  ? 'border-ring bg-muted'
                  : 'border-input hover:bg-muted')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-5">
          <Code
            lang="tsx"
            code={`import { ColorThemeProvider } from '@gabvdl/ui'

<ColorThemeProvider palette={palette} font={fontStack}>
  {/* bg-primary, text-accent-foreground, ring-ring all recolour;
      raw swatches available as var(--palette-0 … N) */}
</ColorThemeProvider>

// or paint the whole document:
<ColorThemeProvider palette={palette} global>…</ColorThemeProvider>`}
          />
        </div>
      </Section>

      <Section n={3} title="Colour-theory generation">
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          <code className="mono">generatePalette</code> builds a pleasing set of
          any size from a harmony — the hues are rotations in HSL space, the
          lightness walks a comfortable ramp. Deterministic per seed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['analogous', 'complementary', 'triadic', 'monochromatic'] as const).map((h) => (
            <div key={h}>
              <div className="mb-1 mono text-[11px] text-muted-foreground">{h}</div>
              <PaletteStripes
                palette={generatePalette({ count: 6, seed: 21, harmony: h })}
                className="h-9 w-full"
              />
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Code
            lang="ts"
            code={`import { generatePalette, randomColor } from '@gabvdl/ui'

generatePalette({ count: 5, harmony: 'triadic', seed: 42 })
//=> ['#…', '#…', '#…', '#…', '#…']  (deterministic)

randomColor(seed, near)  // one fresh colour next to \`near\``}
          />
        </div>
      </Section>
    </div>
  );
}
