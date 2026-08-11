/*
 * One custom animated SVG per component — the homepage cards' whole personality.
 * Exactly three tones: --cyan (the actor), --cyan-deep (structure) and
 * --ink-950 (ink, scrims). Every motion runs on one shared symmetric
 * ease-in-out curve (--ease-io); the parametric primitives in index.css
 * (`.a-drift`, `.a-breathe`, `.a-fade`, `.a-reveal`, `.a-grow`, …) are tuned
 * per icon through inline CSS custom properties, so `prefers-reduced-motion`
 * stills everything via the `.anim-svg` guard.
 */
const VB = '0 0 220 130';
const CY = 'var(--cyan)'; // tone 1 — the actor
const DIM = 'var(--cyan-deep)'; // tone 2 — structure
const INK = 'var(--ink-950)'; // tone 3 — ink & scrims
const PAPER = 'var(--surface-2)'; // card background, for occlusion only

/** Inline custom-property bag, typed for React's style prop. */
const v = (o: Record<string, string>) => o as React.CSSProperties;

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={VB} className="anim-svg h-full w-full" fill="none" role="img" aria-hidden>
      {children}
    </svg>
  );
}

/** IconPicker — a grid of glyph cells scrolls horizontally as a selection ring
 * hops from cell to cell. */
export function IconPickerIcon() {
  const cols = 6;
  const rows = 3;
  const s = 22; // cell side
  const g = 6; // gap
  const x0 = 44;
  const y0 = 30;
  const cell = (c: number, r: number) => (
    <rect
      key={`${c}-${r}`}
      x={x0 + c * (s + g)}
      y={y0 + r * (s + g)}
      width={s}
      height={s}
      rx="5"
      stroke={DIM}
      strokeWidth="2"
    />
  );
  const glyph = (c: number, r: number) => {
    const cx = x0 + c * (s + g) + s / 2;
    const cy = y0 + r * (s + g) + s / 2;
    return <circle key={`d${c}-${r}`} cx={cx} cy={cy} r="4" fill={DIM} opacity="0.4" />;
  };
  return (
    <Svg>
      {Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => cell(c, r)))}
      {Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => glyph(c, r)))}
      {/* the selection ring hopping right across the top row */}
      <g className="a-drift" style={v({ '--dx': `${2 * (s + g)}px`, '--dur': '4.4s' })}>
        <rect
          x={x0}
          y={y0}
          width={s}
          height={s}
          rx="5"
          fill={CY}
          fillOpacity="0.16"
          stroke={CY}
          strokeWidth="2.5"
        />
        <circle cx={x0 + s / 2} cy={y0 + s / 2} r="4.5" fill={CY} />
      </g>
      <circle className="a-blink" cx="176" cy="20" r="3.5" fill={CY} />
    </Svg>
  );
}

/** PalettePicker — vertical colour stripes, each breathing in turn as a
 * highlight sweeps across, like the swatch strip lighting up while you edit. */
export function PalettePickerIcon() {
  const n = 5;
  const w = 22;
  const g = 6;
  const h = 74;
  const x0 = 110 - (n * w + (n - 1) * g) / 2;
  const y0 = 28;
  const opacities = [0.28, 0.46, 0.66, 0.86, 1];
  return (
    <Svg>
      <rect
        x={x0 - 5}
        y={y0 - 5}
        width={n * w + (n - 1) * g + 10}
        height={h + 10}
        rx="10"
        stroke={DIM}
        strokeWidth="2"
      />
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          className="a-fade"
          style={v({ '--dur': '3.6s', '--delay': `${i * 0.3}s` })}
          x={x0 + i * (w + g)}
          y={y0}
          width={w}
          height={h}
          rx="4"
          fill={CY}
          fillOpacity={opacities[i]}
        />
      ))}
      {/* the edit caret hopping between stripes */}
      <g className="a-drift" style={v({ '--dx': `${2 * (w + g)}px`, '--dur': '4.2s' })}>
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          rx="4"
          fill="none"
          stroke={INK}
          strokeWidth="2.5"
        />
      </g>
    </Svg>
  );
}

/** ImageViewer — a loupe glides along the ridge line, magnifying it. */
export function ImageViewerIcon() {
  return (
    <Svg>
      <rect x="42" y="26" width="136" height="78" rx="7" stroke={DIM} strokeWidth="2" />
      <circle cx="146" cy="44" r="6" fill={CY} opacity="0.45" />
      <path d="M42 88 L82 60 L106 78 L134 52 L178 88" stroke={DIM} strokeWidth="2" strokeLinejoin="round" />
      <g className="a-drift" style={v({ '--dx': '52px', '--dy': '-10px', '--dur': '5.2s' })}>
        <circle cx="84" cy="70" r="19" fill={PAPER} fillOpacity="0.8" stroke={CY} strokeWidth="2.5" />
        <path d="M72 76 L84 63 L95 72" stroke={CY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="98" y1="84" x2="112" y2="97" stroke={CY} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

/** ViewableImage — a contact sheet where one frame swells open. */
export function ViewableImageIcon() {
  const tile = (x: number, y: number) => (
    <rect x={x} y={y} width="42" height="34" rx="5" stroke={DIM} strokeWidth="2" />
  );
  return (
    <Svg>
      {tile(56, 26)}
      {tile(106, 26)}
      {tile(56, 70)}
      <g className="a-breathe" style={v({ '--s': '1.16', '--dur': '3.4s' })}>
        <rect x="106" y="70" width="42" height="34" rx="5" fill={CY} fillOpacity="0.12" stroke={CY} strokeWidth="2.5" />
        <circle cx="118" cy="80" r="3.5" fill={CY} opacity="0.55" />
        <path d="M112 98 l9 -9 l6 5 l9 -10" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="a-drift" style={v({ '--dx': '4px', '--dy': '-4px', '--dur': '3.4s' })}>
        <path d="M160 32 h8 v8" stroke={CY} strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="a-drift" style={v({ '--dx': '4px', '--dy': '4px', '--dur': '3.4s' })}>
        <path d="M160 98 h8 v-8" stroke={CY} strokeWidth="2" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

/** ProgressiveImage — mosaic tiles dissolve to uncover the sharp plate. */
export function ProgressiveImageIcon() {
  const tile = (x: number, y: number, fill: string, o: string, delay: string) => (
    <rect
      className="a-fade"
      style={v({ '--o0': o, '--o1': '0', '--dur': '4.4s', animationDelay: delay })}
      x={x}
      y={y}
      width="50"
      height="39"
      fill={fill}
    />
  );
  return (
    <Svg>
      <rect x="60" y="26" width="100" height="78" rx="6" stroke={DIM} strokeWidth="2" />
      <path d="M60 90 L92 64 L114 82 L140 56 L160 76" stroke={CY} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="132" cy="44" r="6" fill={CY} opacity="0.5" />
      {tile(60, 26, CY, '0.38', '0s')}
      {tile(110, 26, INK, '0.3', '0.35s')}
      {tile(60, 65, INK, '0.3', '0.7s')}
      {tile(110, 65, CY, '0.32', '1.05s')}
    </Svg>
  );
}

/** FuzzyList — the match highlight glides between result rows. */
export function FuzzyListIcon() {
  const row = (y: number) => (
    <>
      <rect x="70" y={y} width="90" height="6" rx="3" fill={DIM} opacity="0.5" />
      <rect x="70" y={y + 12} width="58" height="5" rx="2.5" fill={DIM} opacity="0.28" />
    </>
  );
  return (
    <Svg>
      <circle cx="48" cy="30" r="9" stroke={CY} strokeWidth="2.5" />
      <line x1="55" y1="37" x2="63" y2="45" stroke={CY} strokeWidth="3" strokeLinecap="round" />
      <line className="a-blink" x1="70" y1="24" x2="70" y2="38" stroke={CY} strokeWidth="2" />
      <rect
        className="a-drift"
        style={v({ '--dy': '30px', '--dur': '3.6s' })}
        x="66"
        y="52"
        width="98"
        height="24"
        rx="5"
        fill={CY}
        fillOpacity="0.13"
        stroke={CY}
        strokeWidth="1.5"
      />
      <g transform="translate(0 6)">{row(52)}</g>
      <g transform="translate(0 6)">{row(82)}</g>
    </Svg>
  );
}

/** TagFilter — the active pill hands the highlight down the chip row, and the
 * list below thins out as the filter narrows. */
export function TagFilterIcon() {
  const chip = (x: number, w: number) => (
    <rect x={x} y="30" width={w} height="16" rx="8" stroke={DIM} strokeWidth="2" />
  );
  return (
    <Svg>
      {chip(44, 34)}
      {chip(84, 44)}
      {chip(134, 38)}
      <rect
        className="a-drift"
        style={v({ '--dx': '48px', '--dur': '4.2s' })}
        x="42"
        y="28"
        width="38"
        height="20"
        rx="10"
        fill={CY}
        fillOpacity="0.16"
        stroke={CY}
        strokeWidth="2.5"
      />
      {[0, 1, 2].map((i) => (
        <g key={i} className="a-fade" style={v({ '--o0': '1', '--o1': i === 1 ? '0.15' : '1', '--dur': '4.2s' })}>
          <rect x="48" y={60 + i * 16} width={104 - i * 18} height="7" rx="3.5" fill={DIM} opacity={0.5 - i * 0.08} />
        </g>
      ))}
      <circle className="a-blink" cx="164" cy="63" r="3.5" fill={CY} />
    </Svg>
  );
}

/** PhonePreview — a device whose screen scrolls in a slow breath, its copy typing in. */
export function PhonePreviewIcon() {
  const line = (y: number, w: number, h: number, fill: string, o: string, delay: string) => (
    <rect
      className="a-grow"
      style={v({ '--g0': '0.15', '--dur': '5s', animationDelay: delay })}
      x="96"
      y={y}
      width={w}
      height={h}
      rx={h / 2}
      fill={fill}
      opacity={o}
    />
  );
  return (
    <Svg>
      <rect x="86" y="18" width="48" height="94" rx="12" stroke={DIM} strokeWidth="2" />
      <rect x="100" y="24" width="20" height="5" rx="2.5" fill={CY} />
      <clipPath id="pp-scr">
        <rect x="90" y="33" width="40" height="75" rx="4" />
      </clipPath>
      <g clipPath="url(#pp-scr)">
        <rect x="90" y="33" width="40" height="75" fill={CY} fillOpacity="0.06" />
        <g className="a-drift" style={v({ '--dy': '-28px', '--dur': '5s' })}>
          {line(40, 28, 6, CY, '0.6', '0s')}
          {line(52, 20, 4, DIM, '0.5', '0.25s')}
          {line(64, 28, 6, CY, '0.6', '0.5s')}
          {line(76, 24, 4, DIM, '0.5', '0.75s')}
          {line(88, 28, 6, CY, '0.6', '1s')}
          {line(100, 18, 4, DIM, '0.5', '1.25s')}
          {line(112, 26, 6, CY, '0.6', '1.5s')}
        </g>
      </g>
    </Svg>
  );
}

/** PhoneKeyboard — keys light up in sequence while the caret line grows, then
 * the delete key holds and eats it back. */
export function PhoneKeyboardIcon() {
  const cols = 8;
  const s = 15; // key side
  const g = 3;
  const x0 = 110 - (cols * (s + g) - g) / 2;
  const y0 = 62;
  const keys: React.ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      keys.push(
        <rect
          key={i}
          className="a-fade"
          style={v({ '--o0': '0.14', '--o1': '0.75', '--dur': '4s', animationDelay: `${(i % 11) * 0.22}s` })}
          x={x0 + c * (s + g) + (r === 1 ? s / 2 : 0)}
          y={y0 + r * (s + g)}
          width={s}
          height={s}
          rx="3"
          fill={r === 2 && c === cols - 1 ? CY : DIM}
        />,
      );
    }
  }
  return (
    <Svg>
      {/* the field being typed into */}
      <rect x={x0} y="26" width={cols * (s + g) - g} height="24" rx="7" stroke={DIM} strokeWidth="2" />
      <rect
        className="a-grow"
        style={v({ '--g0': '0.05', '--dur': '4s' })}
        x={x0 + 8}
        y="35"
        width="78"
        height="6"
        rx="3"
        fill={CY}
        opacity="0.75"
      />
      <rect
        className="a-blink"
        x={x0 + 90}
        y="32"
        width="2.5"
        height="12"
        rx="1.25"
        fill={CY}
      />
      {keys}
    </Svg>
  );
}

/** Button — a press: the control swells as a ring rolls outward. */
export function ButtonIcon() {
  return (
    <Svg>
      <circle className="a-ping" style={v({ '--dur': '3s' })} cx="110" cy="65" r="26" stroke={CY} strokeWidth="2" />
      <g className="a-breathe" style={v({ '--s': '1.06', '--dur': '3s' })}>
        <rect x="62" y="48" width="96" height="34" rx="10" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="2.5" />
        <rect x="86" y="62" width="48" height="6" rx="3" fill={CY} opacity="0.8" />
      </g>
      <g className="a-drift" style={v({ '--dx': '-6px', '--dy': '-6px', '--dur': '3s' })}>
        <path d="M126 82 l0 24 l6.5 -6.5 l5.5 11 l4.5 -2.5 l-5.5 -11 l9 0 Z" fill={PAPER} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}

/** Breadcrumbs — the trail steps forward, the current crumb pulses in as the highlight drifts to the end. */
export function BreadcrumbsIcon() {
  return (
    <Svg>
      <g className="a-fade" style={v({ '--o0': '0.4', '--o1': '1', '--dur': '4s' })}>
        <rect x="42" y="58" width="30" height="10" rx="5" fill={DIM} opacity="0.5" />
      </g>
      <path d="M78 58 l7 5 l-7 5" stroke={DIM} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g className="a-fade" style={v({ '--o0': '0.4', '--o1': '1', '--dur': '4s' })}>
        <rect x="92" y="58" width="42" height="10" rx="5" fill={DIM} opacity="0.5" />
      </g>
      <path d="M140 58 l7 5 l-7 5" stroke={DIM} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g className="a-grow" style={v({ '--g0': '0.55', '--dur': '4s' })}>
        <rect x="154" y="56" width="46" height="14" rx="7" fill={CY} />
      </g>
    </Svg>
  );
}

/** Pagination — the active page dot drifts along the row while prev/next nudge. */
export function PaginationIcon() {
  const dot = (cx: number) => <circle key={cx} cx={cx} cy="65" r="10" fill="none" stroke={DIM} strokeWidth="2" opacity="0.5" />;
  return (
    <Svg>
      <path d="M52 55 l-9 10 l9 10" stroke={DIM} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {[80, 106, 132, 158].map(dot)}
      <path d="M168 55 l9 10 l-9 10" stroke={DIM} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g className="a-drift" style={v({ '--dx': '78px', '--dy': '0px', '--dur': '4.4s' })}>
        <circle cx="80" cy="65" r="10" fill={CY} />
      </g>
    </Svg>
  );
}

/** Menu — a trigger dot pops a short list, the active row sweeping down it. */
export function MenuIcon() {
  return (
    <Svg>
      <circle cx="52" cy="65" r="9" fill="none" stroke={DIM} strokeWidth="2" />
      <circle cx="52" cy="60" r="1.6" fill={DIM} />
      <circle cx="52" cy="65" r="1.6" fill={DIM} />
      <circle cx="52" cy="70" r="1.6" fill={DIM} />
      <g className="a-panel" style={v({ '--dur': '4.2s' })}>
        <path d="M70 60 l8 5 l-8 5 Z" fill={CY} />
        <rect x="78" y="42" width="100" height="60" rx="8" fill={PAPER} stroke={CY} strokeWidth="2.5" />
        <g className="a-drift" style={v({ '--dx': '0px', '--dy': '18px', '--dur': '4.2s' })}>
          <rect x="88" y="50" width="80" height="12" rx="4" fill={CY} fillOpacity="0.22" />
        </g>
        <rect x="92" y="53" width="34" height="6" rx="3" fill={DIM} opacity="0.6" />
        <rect x="92" y="71" width="46" height="6" rx="3" fill={DIM} opacity="0.5" />
        <rect x="92" y="89" width="28" height="6" rx="3" fill={DIM} opacity="0.5" />
      </g>
    </Svg>
  );
}

/** Tabs — the indicator slides under the strip and the panel swaps with it. */
export function TabsIcon() {
  return (
    <Svg>
      <rect x="44" y="30" width="132" height="70" rx="8" stroke={DIM} strokeWidth="2" />
      <line x1="44" y1="52" x2="176" y2="52" stroke={DIM} strokeWidth="2" />
      <rect x="56" y="38" width="26" height="6" rx="3" fill={DIM} opacity="0.55" />
      <rect x="94" y="38" width="26" height="6" rx="3" fill={DIM} opacity="0.55" />
      <rect x="132" y="38" width="26" height="6" rx="3" fill={DIM} opacity="0.55" />
      {/* the indicator, sliding between the three tab stops */}
      <g className="a-drift" style={v({ '--dx': '76px', '--dy': '0px', '--dur': '4.4s' })}>
        <rect x="54" y="49" width="30" height="4" rx="2" fill={CY} />
      </g>
      {/* the panel body, cross-fading as the tab changes */}
      <g className="a-fade" style={v({ '--o0': '0.25', '--o1': '0.9', '--dur': '4.4s' })}>
        <rect x="58" y="64" width="104" height="7" rx="3.5" fill={CY} opacity="0.5" />
        <rect x="58" y="78" width="72" height="7" rx="3.5" fill={CY} opacity="0.35" />
      </g>
    </Svg>
  );
}

/** Input — the focus ring settles while a value types itself out. */
export function InputIcon() {
  return (
    <Svg>
      <rect
        className="a-fade"
        style={v({ '--o0': '0.35', '--o1': '1', '--dur': '4s' })}
        x="48"
        y="50"
        width="124"
        height="30"
        rx="9"
        stroke={CY}
        strokeWidth="2.5"
      />
      <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4s' })} x="60" y="62" width="44" height="6" rx="3" fill={DIM} opacity="0.65" />
      <line className="a-blink" x1="108" y1="58" x2="108" y2="72" stroke={CY} strokeWidth="2" />
    </Svg>
  );
}

/** Textarea — lines type themselves out under a blinking caret, resize handle at the corner. */
export function TextareaIcon() {
  return (
    <Svg>
      <rect x="48" y="26" width="124" height="78" rx="9" stroke={CY} strokeWidth="2.5" />
      <rect
        className="a-grow"
        style={v({ '--g0': '0.1', '--dur': '4.2s' })}
        x="60"
        y="42"
        width="80"
        height="6"
        rx="3"
        fill={DIM}
        opacity="0.6"
      />
      <rect
        className="a-grow"
        style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.15s' })}
        x="60"
        y="56"
        width="96"
        height="6"
        rx="3"
        fill={DIM}
        opacity="0.6"
      />
      <rect
        className="a-grow"
        style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.3s' })}
        x="60"
        y="70"
        width="64"
        height="6"
        rx="3"
        fill={DIM}
        opacity="0.5"
      />
      <line className="a-blink" x1="60" y1="84" x2="60" y2="94" stroke={CY} strokeWidth="2" />
      <path d="M158 96 l8 -8 M164 100 l8 -8" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** Field — a label bar sits above a boxed control; the helper line below it
 * breathes as the whole row's outline pulses, standing in for the
 * hint/error swap. */
export function FieldIcon() {
  return (
    <Svg>
      <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4s' })} x="48" y="28" width="60" height="7" rx="3.5" fill={DIM} opacity="0.7" />
      <rect
        className="a-fade"
        style={v({ '--o0': '0.4', '--o1': '1', '--dur': '4s', animationDelay: '0.15s' })}
        x="48"
        y="44"
        width="124"
        height="28"
        rx="8"
        stroke={CY}
        strokeWidth="2.5"
      />
      <line className="a-blink" x1="60" y1="54" x2="60" y2="64" stroke={CY} strokeWidth="2" />
      <rect
        className="a-fade"
        style={v({ '--o0': '0.25', '--o1': '0.75', '--dur': '4s', animationDelay: '0.3s' })}
        x="48"
        y="82"
        width="88"
        height="6"
        rx="3"
        fill={DIM}
      />
    </Svg>
  );
}

/** cn — two class tokens fold into one resolved pill. */
export function CnIcon() {
  return (
    <Svg>
      <g className="a-merge-l">
        <rect x="36" y="52" width="52" height="26" rx="13" stroke={DIM} strokeWidth="2" />
        <rect x="46" y="62" width="32" height="6" rx="3" fill={DIM} opacity="0.6" />
      </g>
      <g className="a-merge-r">
        <rect x="132" y="52" width="52" height="26" rx="13" stroke={DIM} strokeWidth="2" />
        <rect x="142" y="62" width="32" height="6" rx="3" fill={DIM} opacity="0.6" />
      </g>
      <g className="a-merge-in">
        <rect x="82" y="50" width="56" height="30" rx="15" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="2.5" />
        <path d="M97 65 l7 7 l15 -15" stroke={CY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}

/** VirtualList — the window slides over rows as the thumb mirrors it. */
export function VirtualListIcon() {
  return (
    <Svg>
      <rect x="52" y="24" width="104" height="82" rx="8" stroke={DIM} strokeWidth="2" />
      <clipPath id="vl-clip">
        <rect x="58" y="30" width="80" height="70" rx="3" />
      </clipPath>
      <g clipPath="url(#vl-clip)">
        <g className="a-drift" style={v({ '--dy': '-30px', '--dur': '5s' })}>
          {[26, 42, 58, 74, 90, 106, 122].map((y, i) => (
            <g key={y}>
              <rect x="64" y={y} width="52" height="6" rx="3" fill={i === 3 ? CY : DIM} opacity={i === 3 ? 0.85 : 0.4} />
              <rect x="64" y={y + 9} width="34" height="4" rx="2" fill={DIM} opacity="0.28" />
            </g>
          ))}
        </g>
      </g>
      <rect x="146" y="30" width="4" height="70" rx="2" fill={DIM} opacity="0.25" />
      <rect className="a-drift" style={v({ '--dy': '44px', '--dur': '5s' })} x="146" y="30" width="4" height="24" rx="2" fill={CY} />
      <rect x="164" y="30" width="8" height="70" rx="2" fill={CY} opacity="0.06" />
    </Svg>
  );
}

/** AnimatedList — two rows trade places, gliding past each other (FLIP). */
export function AnimatedListIcon() {
  return (
    <Svg>
      <rect x="52" y="26" width="104" height="78" rx="8" stroke={DIM} strokeWidth="2" />
      {/* bottom row sits still … */}
      <rect x="64" y="82" width="60" height="8" rx="4" fill={DIM} opacity="0.4" />
      {/* … while the top two rows swap slots (24px apart) and glide past. */}
      <g className="a-reorder-up">
        <rect x="64" y="62" width="60" height="8" rx="4" fill={CY} opacity="0.9" />
        <circle cx="138" cy="66" r="4" fill={CY} />
      </g>
      <g className="a-reorder-down">
        <rect x="64" y="38" width="44" height="8" rx="4" fill={DIM} opacity="0.45" />
      </g>
    </Svg>
  );
}

/** HoldEditable — the held row lifts and roams while the others jump in place;
 * a dashed outline marks the slot it will land in. */
export function HoldEditableIcon() {
  return (
    <Svg>
      <rect x="52" y="26" width="104" height="78" rx="8" stroke={DIM} strokeWidth="2" />
      {/* the vacated slot — a dashed outline where the held row will land */}
      <rect
        x="64"
        y="60"
        width="68"
        height="10"
        rx="5"
        stroke={CY}
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.45"
      />
      {/* neighbours jump in place, out of phase */}
      <g className="a-drift" style={v({ '--dy': '-3px', '--dur': '0.9s' })}>
        <rect x="64" y="38" width="56" height="10" rx="5" fill={DIM} opacity="0.45" />
      </g>
      <g className="a-drift" style={v({ '--dy': '-3px', '--dur': '1.15s' })}>
        <rect x="64" y="84" width="44" height="10" rx="5" fill={DIM} opacity="0.45" />
      </g>
      {/* the held row, lifted out of the flow, following the pointer */}
      <g className="a-drift" style={v({ '--dx': '16px', '--dy': '-14px', '--dur': '3.6s' })}>
        <rect x="64" y="60" width="68" height="10" rx="5" fill={CY} opacity="0.9" />
        <circle cx="120" cy="65" r="5" fill={CY} stroke={PAPER} strokeWidth="2" />
      </g>
    </Svg>
  );
}

/** Nav2D — the stick rolls its gate while the ray marches to the target. */
export function Nav2DIcon() {
  return (
    <Svg>
      <rect x="96" y="24" width="34" height="24" rx="5" stroke={DIM} strokeWidth="2" />
      <rect x="150" y="86" width="34" height="24" rx="5" stroke={DIM} strokeWidth="2" />
      <rect x="30" y="82" width="34" height="24" rx="5" stroke={CY} strokeWidth="2.5" fill={CY} fillOpacity="0.14" />
      <line
        className="a-dash"
        x1="47"
        y1="94"
        x2="167"
        y2="52"
        stroke={CY}
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity="0.85"
      />
      <rect
        className="a-fade"
        style={v({ '--o0': '0.35', '--o1': '1', '--dur': '2.6s' })}
        x="150"
        y="40"
        width="34"
        height="24"
        rx="5"
        stroke={CY}
        strokeWidth="2.5"
        fill={CY}
        fillOpacity="0.16"
      />
      <circle cx="47" cy="94" r="17" stroke={DIM} strokeWidth="1.5" opacity="0.5" />
      <circle className="a-joy" cx="47" cy="94" r="7" fill={CY} />
    </Svg>
  );
}

/** Changelog — a release lands: the star pings out from the log. */
export function ChangelogIcon() {
  return (
    <Svg>
      <rect x="52" y="24" width="104" height="82" rx="8" stroke={DIM} strokeWidth="2" />
      <rect x="64" y="36" width="22" height="12" rx="6" fill={CY} fillOpacity="0.16" stroke={CY} strokeWidth="1.5" />
      <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4.2s' })} x="94" y="52" width="50" height="5" rx="2.5" fill={DIM} opacity="0.55" />
      <rect x="64" y="52" width="22" height="5" rx="2.5" fill={DIM} opacity="0.3" />
      <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.3s' })} x="64" y="66" width="80" height="5" rx="2.5" fill={DIM} opacity="0.45" />
      <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.6s' })} x="64" y="78" width="64" height="5" rx="2.5" fill={DIM} opacity="0.3" />
      <g transform="translate(150 30)">
        <circle className="a-ping" style={v({ '--dur': '2.8s' })} r="11" stroke={CY} strokeWidth="2" />
        <circle className="a-breathe" style={v({ '--s': '1.15', '--dur': '2.8s' })} r="6" fill={CY} />
        <path d="M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1 Z" fill={PAPER} />
      </g>
    </Svg>
  );
}

/** ProgressiveText — lines write themselves in, one after another. */
export function ProgressiveTextIcon() {
  const bar = (y: number, w: number, o: number, delay: string) => (
    <rect
      className="a-grow"
      style={v({ '--g0': '0.05', '--dur': '4.4s', animationDelay: delay })}
      x="52"
      y={y}
      width={w}
      height="8"
      rx="4"
      fill={CY}
      fillOpacity={String(o)}
    />
  );
  return (
    <Svg>
      {bar(34, 116, 0.55, '0s')}
      {bar(56, 92, 0.45, '0.4s')}
      {bar(78, 64, 0.38, '0.8s')}
      <line className="a-blink" x1="126" y1="74" x2="126" y2="90" stroke={CY} strokeWidth="2.5" />
    </Svg>
  );
}

/** CharRoll — tally-counter windows, digit slugs rolling faster on the right. */
export function CharRollIcon() {
  const xs = [50, 94, 138];
  const durs = ['6.4s', '4.6s', '2.8s'];
  return (
    <Svg>
      {xs.map((x, i) => (
        <g key={x} className="a-drift" style={v({ '--dy': '24px', '--dur': durs[i] })}>
          <rect x={x + 8} y="18" width="18" height="10" rx="3" fill={CY} fillOpacity="0.3" />
          <rect x={x + 8} y="60" width="18" height="10" rx="3" fill={CY} fillOpacity="0.85" />
          <rect x={x + 8} y="102" width="18" height="10" rx="3" fill={CY} fillOpacity="0.3" />
        </g>
      ))}
      {/* scrims hide the strip outside the windows */}
      <rect x="38" y="0" width="152" height="38" fill={PAPER} />
      <rect x="38" y="92" width="152" height="38" fill={PAPER} />
      {xs.map((x) => (
        <rect key={x} x={x} y="38" width="34" height="54" rx="6" stroke={DIM} strokeWidth="2" />
      ))}
    </Svg>
  );
}

/** ProgressiveTable — a header bar, then grid rows rising one by one. */
export function ProgressiveTableIcon() {
  const cols = [46, 96, 146];
  const w = 44;
  const bodyYs = [52, 74, 96];
  return (
    <Svg>
      {cols.map((x, c) => (
        <rect
          key={`h${x}`}
          className="a-reveal"
          style={v({ '--dur': '4.2s', animationDelay: `${c * 0.07}s` })}
          x={x}
          y="28"
          width={w}
          height="15"
          rx="3"
          fill={CY}
          fillOpacity="0.55"
        />
      ))}
      {bodyYs.map((y, r) =>
        cols.map((x, c) => (
          <rect
            key={`${x}-${y}`}
            className="a-reveal"
            style={v({ '--dur': '4.2s', animationDelay: `${0.3 + r * 0.26 + c * 0.06}s` })}
            x={x}
            y={y}
            width={w}
            height="13"
            rx="3"
            fill={DIM}
            fillOpacity="0.45"
          />
        )),
      )}
    </Svg>
  );
}

/** RichInput — a composer: chips rise in, the send key swells. */
export function RichInputIcon() {
  return (
    <Svg>
      <rect
        className="a-fade"
        style={v({ '--o0': '0.4', '--o1': '1', '--dur': '4.4s' })}
        x="30"
        y="24"
        width="160"
        height="82"
        rx="12"
        stroke={CY}
        strokeWidth="2.5"
      />
      <rect className="a-grow" style={v({ '--g0': '0.08', '--dur': '4.4s' })} x="44" y="38" width="70" height="6" rx="3" fill={DIM} opacity="0.6" />
      <line className="a-blink" x1="120" y1="35" x2="120" y2="49" stroke={CY} strokeWidth="2" />
      <g className="a-reveal" style={v({ '--dur': '4.4s', animationDelay: '0.2s' })}>
        <rect x="44" y="80" width="34" height="14" rx="7" fill={CY} fillOpacity="0.16" stroke={CY} strokeWidth="1.5" />
      </g>
      <g className="a-reveal" style={v({ '--dur': '4.4s', animationDelay: '0.42s' })}>
        <rect x="84" y="80" width="30" height="14" rx="7" stroke={DIM} strokeWidth="1.5" />
      </g>
      <g className="a-reveal" style={v({ '--dur': '4.4s', animationDelay: '0.64s' })}>
        <rect x="120" y="80" width="24" height="14" rx="7" stroke={DIM} strokeWidth="1.5" />
      </g>
      <g className="a-breathe" style={v({ '--s': '1.14', '--dur': '3.2s' })}>
        <rect x="158" y="78" width="18" height="18" rx="5" fill={CY} fillOpacity="0.2" stroke={CY} strokeWidth="2" />
        <path d="M162 87 l10 0 M168 83 l4 4 -4 4" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}

/** ProgressiveList — rows stagger into view, the newest in accent. */
export function ProgressiveListIcon() {
  const ys = [30, 50, 70, 90];
  return (
    <Svg>
      {ys.map((y, i) => (
        <rect
          key={y}
          className="a-reveal"
          style={v({ '--dur': '4.2s', animationDelay: `${i * 0.3}s` })}
          x="54"
          y={y}
          width={i % 2 ? 92 : 112}
          height="13"
          rx="4"
          fill={i === ys.length - 1 ? CY : DIM}
          fillOpacity="0.5"
        />
      ))}
    </Svg>
  );
}

/** ProgressiveBash — a command types out, then its output rises. */
export function ProgressiveBashIcon() {
  return (
    <Svg>
      <rect x="40" y="22" width="140" height="86" rx="8" stroke={DIM} strokeWidth="2" />
      <line x1="40" y1="38" x2="180" y2="38" stroke={DIM} strokeWidth="1.5" opacity="0.5" />
      <circle cx="52" cy="30" r="3" fill={CY} opacity="0.7" />
      <circle cx="63" cy="30" r="3" fill={DIM} opacity="0.5" />
      <circle cx="74" cy="30" r="3" fill={DIM} opacity="0.5" />
      <path d="M54 52 l7 6 l-7 6" stroke={CY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect className="a-grow" style={v({ '--g0': '0.06', '--dur': '4.4s' })} x="70" y="53" width="74" height="9" rx="3" fill={CY} fillOpacity="0.75" />
      <line className="a-blink" x1="152" y1="50" x2="152" y2="64" stroke={CY} strokeWidth="2.5" />
      <rect className="a-reveal" style={v({ '--dur': '4.4s', animationDelay: '1.5s' })} x="54" y="76" width="96" height="6" rx="3" fill={DIM} opacity="0.45" />
      <rect className="a-reveal" style={v({ '--dur': '4.4s', animationDelay: '1.8s' })} x="54" y="90" width="70" height="6" rx="3" fill={DIM} opacity="0.3" />
    </Svg>
  );
}

/** ProgressiveTimeline — the head hands down the spine; each slot reveals in turn. */
export function ProgressiveTimelineIcon() {
  const ys = [30, 58, 86];
  return (
    <Svg>
      <line x1="62" y1="26" x2="62" y2="104" stroke={DIM} strokeWidth="2" opacity="0.4" />
      {ys.map((y, i) => (
        <g key={y} className="a-reveal" style={v({ '--dur': '4.2s', animationDelay: `${i * 0.55}s` })}>
          <circle cx="62" cy={y + 7} r="4" fill={i === ys.length - 1 ? CY : DIM} opacity="0.85" />
          {i === 1 ? (
            <rect
              className="a-grow"
              style={v({ '--g0': '0.12', '--dur': '4.2s', animationDelay: '0.55s' })}
              x="76"
              y={y}
              width="74"
              height="14"
              rx="4"
              fill={CY}
              fillOpacity="0.4"
            />
          ) : (
            <rect x="76" y={y} width={i === 0 ? 96 : 84} height="14" rx="4" fill={i === ys.length - 1 ? CY : DIM} fillOpacity="0.5" />
          )}
        </g>
      ))}
      <circle
        className="a-drift"
        style={v({ '--dy': '56px', '--dur': '4.2s' })}
        cx="62"
        cy="37"
        r="7"
        fill={PAPER}
        stroke={CY}
        strokeWidth="2.5"
      />
    </Svg>
  );
}

/** FloatingPanel — the window hovers, breathing above its dashed dock. */
export function FloatingPanelIcon() {
  return (
    <Svg>
      <rect x="46" y="56" width="128" height="54" rx="8" stroke={DIM} strokeWidth="2" strokeDasharray="5 5" opacity="0.55" />
      <g className="a-drift" style={v({ '--dy': '-6px', '--dur': '4.4s' })}>
        <rect x="62" y="26" width="104" height="66" rx="8" fill={INK} fillOpacity="0.08" stroke={CY} strokeWidth="2.5" />
        <path d="M62 42 h104" stroke={CY} strokeWidth="1.5" opacity="0.7" />
        <rect className="a-grow" style={v({ '--g0': '0.2', '--dur': '4.4s' })} x="72" y="32" width="30" height="6" rx="3" fill={CY} opacity="0.8" />
        <circle cx="152" cy="35" r="3" fill={CY} opacity="0.7" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.4s', animationDelay: '0.25s' })} x="72" y="52" width="68" height="5" rx="2.5" fill={DIM} opacity="0.5" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.4s', animationDelay: '0.5s' })} x="72" y="64" width="82" height="5" rx="2.5" fill={DIM} opacity="0.4" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.4s', animationDelay: '0.75s' })} x="72" y="76" width="50" height="5" rx="2.5" fill={DIM} opacity="0.3" />
      </g>
    </Svg>
  );
}

/** ResizableLayout — the left panel folds to the wall, the bottom panel takes the slack. */
export function ResizableLayoutIcon() {
  return (
    <Svg>
      <rect x="34" y="22" width="152" height="86" rx="8" stroke={DIM} strokeWidth="2" opacity="0.55" />
      <g className="a-rz-left">
        <rect x="34" y="22" width="44" height="86" rx="0" fill={CY} fillOpacity="0.14" />
        <line x1="78" y1="22" x2="78" y2="108" stroke={CY} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </g>
      <rect x="152" y="22" width="34" height="86" fill={INK} fillOpacity="0.06" />
      <line x1="152" y1="22" x2="152" y2="108" stroke={DIM} strokeWidth="2" opacity="0.6" />
      <g className="a-rz-bottom">
        <rect x="78" y="82" width="74" height="26" fill={CY} fillOpacity="0.16" />
        <line x1="78" y1="82" x2="152" y2="82" stroke={CY} strokeWidth="2.5" />
      </g>
      <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4.6s' })} x="90" y="34" width="30" height="6" rx="3" fill={DIM} opacity="0.5" />
      <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.6s', animationDelay: '0.3s' })} x="90" y="46" width="46" height="5" rx="2.5" fill={DIM} opacity="0.35" />
    </Svg>
  );
}

/** Toast — a card slides up from the corner, holds, slips away. */
export function ToastIcon() {
  return (
    <Svg>
      <rect x="40" y="24" width="140" height="82" rx="8" stroke={DIM} strokeWidth="2" opacity="0.5" />
      <g className="a-toast">
        <rect x="86" y="66" width="86" height="30" rx="8" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="2.5" />
        <path d="M96 81 l6 6 l10 -12" stroke={CY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4.2s', animationDelay: '0.4s' })} x="120" y="74" width="42" height="5" rx="2.5" fill={CY} opacity="0.75" />
        <rect className="a-grow" style={v({ '--g0': '0.12', '--dur': '4.2s', animationDelay: '0.65s' })} x="120" y="84" width="28" height="4" rx="2" fill={DIM} opacity="0.6" />
      </g>
    </Svg>
  );
}

/** Banner — a full-width bar drops from the top edge, holds, lifts away. */
export function BannerIcon() {
  return (
    <Svg>
      <rect x="30" y="16" width="160" height="98" rx="8" stroke={DIM} strokeWidth="2" opacity="0.4" />
      <g className="a-banner">
        <rect x="42" y="34" width="136" height="34" rx="8" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="2.5" />
        <circle cx="60" cy="51" r="7" fill={CY} fillOpacity="0.22" stroke={CY} strokeWidth="2" />
        <path d="M60 47 v6 M60 56.5 v0.5" stroke={CY} strokeWidth="2" strokeLinecap="round" />
        <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4.4s', animationDelay: '0.4s' })} x="78" y="43" width="76" height="5" rx="2.5" fill={CY} opacity="0.75" />
        <rect className="a-grow" style={v({ '--g0': '0.12', '--dur': '4.4s', animationDelay: '0.65s' })} x="78" y="53" width="48" height="4" rx="2" fill={DIM} opacity="0.6" />
      </g>
      <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.4s', animationDelay: '0.2s' })} x="42" y="82" width="60" height="6" rx="3" fill={DIM} opacity="0.4" />
      <rect className="a-grow" style={v({ '--g0': '0.08', '--dur': '4.4s', animationDelay: '0.5s' })} x="42" y="94" width="90" height="5" rx="2.5" fill={DIM} opacity="0.3" />
    </Svg>
  );
}

/** Modal — the scrim settles over the page as the panel scales in. */
export function ModalIcon() {
  return (
    <Svg>
      <rect x="34" y="20" width="152" height="90" rx="8" stroke={DIM} strokeWidth="2" />
      <rect className="a-scrim" x="34" y="20" width="152" height="90" rx="8" fill={INK} fillOpacity="0.3" />
      <g className="a-panel">
        <rect x="70" y="40" width="80" height="50" rx="8" fill={PAPER} stroke={CY} strokeWidth="2.5" />
        <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4.2s', animationDelay: '0.35s' })} x="80" y="52" width="40" height="5" rx="2.5" fill={CY} opacity="0.8" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.6s' })} x="80" y="64" width="52" height="4" rx="2" fill={DIM} opacity="0.6" />
        <rect x="112" y="74" width="28" height="9" rx="4.5" fill={CY} fillOpacity="0.3" />
      </g>
    </Svg>
  );
}

/** Tooltip — a bubble rises above the trigger on hover, holds, resets. */
export function TooltipIcon() {
  return (
    <Svg>
      <rect x="86" y="86" width="48" height="20" rx="6" stroke={DIM} strokeWidth="2" />
      <circle cx="110" cy="96" r="3" fill={DIM} opacity="0.6" />
      <g className="a-reveal" style={v({ '--dur': '3.8s' })}>
        <path d="M104 68 l6 10 l6 -10 Z" fill={CY} />
        <rect x="66" y="30" width="88" height="34" rx="8" fill={PAPER} stroke={CY} strokeWidth="2.5" />
        <rect x="78" y="42" width="44" height="5" rx="2.5" fill={CY} opacity="0.8" />
        <rect x="78" y="52" width="30" height="4" rx="2" fill={DIM} opacity="0.5" />
      </g>
    </Svg>
  );
}

/** Popover — a panel opens beside the trigger it's anchored to, then closes. */
export function PopoverIcon() {
  return (
    <Svg>
      <rect x="40" y="82" width="56" height="24" rx="6" stroke={DIM} strokeWidth="2" />
      <g className="a-panel" style={v({ '--dur': '4s' })}>
        <path d="M96 74 l10 6 l-10 6 Z" fill={CY} />
        <rect x="106" y="54" width="80" height="52" rx="10" fill={PAPER} stroke={CY} strokeWidth="2.5" />
        <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4s', animationDelay: '0.3s' })} x="118" y="66" width="44" height="5" rx="2.5" fill={CY} opacity="0.8" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4s', animationDelay: '0.5s' })} x="118" y="78" width="56" height="4" rx="2" fill={DIM} opacity="0.55" />
        <rect x="118" y="90" width="30" height="8" rx="4" fill={CY} fillOpacity="0.25" />
      </g>
    </Svg>
  );
}

/** ThemeToggle — the knob crosses the track and the sun yields to the moon. */
export function ThemeToggleIcon() {
  return (
    <Svg>
      <rect x="60" y="48" width="100" height="34" rx="17" stroke={DIM} strokeWidth="2" />
      <g className="a-swap">
        <circle cx="79" cy="65" r="11" fill={CY} fillOpacity="0.25" stroke={CY} strokeWidth="2.5" />
      </g>
      <path
        className="a-sun"
        d="M79 50 v-5 M79 80 v5 M64 65 h-5 M94 65 h5 M68 54 l-4 -4 M90 76 l4 4 M90 54 l4 -4 M68 76 l-4 4"
        stroke={CY}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path className="a-moon" d="M148 56 a11 11 0 1 0 8 17 a9 9 0 0 1 -8 -17 Z" fill={DIM} />
    </Svg>
  );
}

/** Spinner — the arc sweeps a revolution, easing through each turn. */
export function SpinnerIcon() {
  return (
    <Svg>
      <circle cx="110" cy="56" r="24" stroke={DIM} strokeWidth="3" opacity="0.35" />
      <path
        className="a-hand"
        style={v({ '--dur': '1.7s', '--pivot': '110px 56px' })}
        d="M110 32 a24 24 0 0 1 24 24"
        stroke={CY}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="82" y="96" width="56" height="6" rx="3" fill={DIM} opacity="0.5" />
    </Svg>
  );
}

/** Skeleton — placeholder bars shimmer in a slow wave. */
export function SkeletonIcon() {
  const bar = (x: number, y: number, w: number, h: number, rx: number, delay: string, fill = DIM, o = '0.55') => (
    <rect
      className="a-fade"
      style={v({ '--o0': o, '--o1': '0.22', '--dur': '2.8s', animationDelay: delay })}
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx}
      fill={fill}
    />
  );
  return (
    <Svg>
      {bar(42, 30, 44, 44, 8, '0s', CY, '0.28')}
      {bar(96, 34, 82, 8, 4, '0.18s')}
      {bar(96, 50, 64, 8, 4, '0.36s')}
      {bar(96, 66, 38, 8, 4, '0.54s')}
      {bar(42, 88, 136, 8, 4, '0.72s', DIM, '0.4')}
    </Svg>
  );
}

/** EmptyState — nothing in the tray; the placeholder hovers, the CTA invites. */
export function EmptyStateIcon() {
  return (
    <Svg>
      <path d="M62 46 h96 l-10 40 h-76 Z" stroke={DIM} strokeWidth="2" strokeLinejoin="round" />
      <line x1="52" y1="86" x2="168" y2="86" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
      <circle
        className="a-drift"
        style={v({ '--dy': '-7px', '--dur': '3.6s' })}
        cx="110"
        cy="40"
        r="12"
        stroke={CY}
        strokeWidth="2.5"
        strokeDasharray="4 5"
      />
      <rect
        className="a-breathe"
        style={v({ '--s': '1.08', '--dur': '3.6s' })}
        x="88"
        y="98"
        width="44"
        height="12"
        rx="6"
        fill={CY}
        fillOpacity="0.22"
        stroke={CY}
        strokeWidth="2"
      />
    </Svg>
  );
}

/** StatusBadge — pills hand the lifecycle down, then the tick lands. */
export function StatusBadgeIcon() {
  const pill = (x: number, y: number, cls: string, fill: string) => (
    <g className={cls}>
      <rect x={x} y={y} width="62" height="22" rx="11" fill={fill} fillOpacity="0.16" stroke={fill} strokeWidth="2" />
      <circle cx={x + 14} cy={y + 11} r="4" fill={fill} />
      <rect x={x + 24} y={y + 8} width="26" height="6" rx="3" fill={fill} opacity="0.7" />
    </g>
  );
  return (
    <Svg>
      {pill(48, 24, 'a-badge-1', DIM)}
      {pill(48, 54, 'a-badge-2', CY)}
      {pill(48, 84, 'a-badge-3', DIM)}
      <path className="a-tick" d="M136 60 l8 8 l16 -18" stroke={CY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** CopyButton — the sheet peels off its original, then the check lands. */
export function CopyButtonIcon() {
  return (
    <Svg>
      <rect x="64" y="30" width="52" height="62" rx="7" stroke={DIM} strokeWidth="2" />
      <g className="a-copy">
        <rect x="94" y="42" width="52" height="62" rx="7" fill={PAPER} stroke={CY} strokeWidth="2.5" />
        <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '3.8s', animationDelay: '0.5s' })} x="104" y="56" width="32" height="5" rx="2.5" fill={DIM} opacity="0.6" />
        <rect className="a-grow" style={v({ '--g0': '0.12', '--dur': '3.8s', animationDelay: '0.75s' })} x="104" y="68" width="24" height="5" rx="2.5" fill={DIM} opacity="0.6" />
      </g>
      <path className="a-check" d="M152 76 l7 7 l14 -16" stroke={CY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** DropZone — a file settles into the dashed target. */
export function DropZoneIcon() {
  return (
    <Svg>
      <rect x="52" y="34" width="116" height="72" rx="10" stroke={CY} strokeWidth="2.5" strokeDasharray="8 7" />
      <g className="a-drop">
        <rect x="94" y="24" width="32" height="40" rx="5" fill={CY} fillOpacity="0.18" stroke={CY} strokeWidth="2.5" />
        <path d="M104 44 l6 6 l6 -6 M110 34 v16" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <line x1="80" y1="92" x2="140" y2="92" stroke={DIM} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </Svg>
  );
}

/** SearchInput — the query writes itself beside the loupe. */
export function SearchInputIcon() {
  return (
    <Svg>
      <rect
        className="a-fade"
        style={v({ '--o0': '0.4', '--o1': '1', '--dur': '4.2s' })}
        x="44"
        y="50"
        width="132"
        height="32"
        rx="16"
        stroke={CY}
        strokeWidth="2.5"
      />
      <circle cx="64" cy="66" r="7" stroke={CY} strokeWidth="2.5" />
      <line x1="69" y1="71" x2="75" y2="77" stroke={CY} strokeWidth="2.5" strokeLinecap="round" />
      <rect className="a-grow" style={v({ '--g0': '0.08', '--dur': '4.2s' })} x="84" y="62" width="60" height="7" rx="3.5" fill={DIM} opacity="0.6" />
      <rect
        className="a-fade"
        style={v({ '--o0': '0.3', '--o1': '0.9', '--dur': '4.2s', animationDelay: '0.4s' })}
        x="150"
        y="58"
        width="18"
        height="16"
        rx="4"
        stroke={DIM}
        strokeWidth="1.5"
      />
    </Svg>
  );
}

/** RelativeTime — the hand sweeps, easing through each hour. */
export function RelativeTimeIcon() {
  return (
    <Svg>
      <circle cx="110" cy="58" r="28" stroke={DIM} strokeWidth="2" />
      <line
        className="a-hand"
        style={v({ '--dur': '5.6s', '--pivot': '110px 58px' })}
        x1="110"
        y1="58"
        x2="110"
        y2="40"
        stroke={CY}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="110" cy="58" r="3" fill={CY} />
      <rect className="a-grow" style={v({ '--g0': '0.25', '--dur': '5.6s' })} x="76" y="98" width="68" height="8" rx="4" fill={CY} fillOpacity="0.3" />
    </Svg>
  );
}

/** Hooks — the plug reaches its socket; a spark rings the contact. */
export function HooksIcon() {
  return (
    <Svg>
      <rect x="120" y="42" width="52" height="40" rx="8" stroke={DIM} strokeWidth="2" />
      <line x1="120" y1="54" x2="106" y2="54" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
      <line x1="120" y1="70" x2="106" y2="70" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
      <g className="a-drift" style={v({ '--dx': '12px', '--dur': '3.6s' })}>
        <rect x="40" y="46" width="46" height="32" rx="7" fill={CY} fillOpacity="0.16" stroke={CY} strokeWidth="2.5" />
        <line x1="86" y1="54" x2="106" y2="54" stroke={CY} strokeWidth="3" strokeLinecap="round" />
        <line x1="86" y1="70" x2="106" y2="70" stroke={CY} strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle className="a-ping" style={v({ '--dur': '3.6s', animationDelay: '1.3s' })} cx="118" cy="62" r="9" stroke={CY} strokeWidth="2" />
    </Svg>
  );
}

/** format — the raw value crosses the arrow and lands formatted. */
export function FormatIcon() {
  return (
    <Svg>
      <rect x="42" y="48" width="60" height="32" rx="8" stroke={DIM} strokeWidth="2" />
      <rect x="52" y="61" width="40" height="6" rx="3" fill={DIM} opacity="0.55" />
      <g className="a-drift" style={v({ '--dx': '5px', '--dur': '3.8s' })}>
        <path d="M108 64 h18 m-6 -6 l6 6 l-6 6" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="a-fade" style={v({ '--o0': '0.15', '--o1': '1', '--dur': '3.8s' })}>
        <rect x="134" y="46" width="46" height="36" rx="8" fill={CY} fillOpacity="0.16" stroke={CY} strokeWidth="2.5" />
        <rect className="a-grow" style={v({ '--g0': '0.2', '--dur': '3.8s', animationDelay: '0.4s' })} x="143" y="61" width="28" height="6" rx="3" fill={CY} opacity="0.8" />
      </g>
    </Svg>
  );
}

/** IframePreview — a small trigger blooms into a full browser frame. */
export function IframePreviewIcon() {
  return (
    <Svg>
      <rect x="30" y="52" width="44" height="26" rx="6" stroke={DIM} strokeWidth="2" />
      <rect x="40" y="62" width="24" height="6" rx="3" fill={DIM} opacity="0.55" />
      <g className="a-panel">
        <rect x="86" y="26" width="104" height="78" rx="8" fill={CY} fillOpacity="0.08" stroke={CY} strokeWidth="2.5" />
        <line x1="86" y1="46" x2="190" y2="46" stroke={CY} strokeWidth="2" opacity="0.7" />
        <rect className="a-grow" style={v({ '--g0': '0.2', '--dur': '4.2s' })} x="104" y="32" width="56" height="8" rx="4" fill={CY} opacity="0.45" />
        <circle cx="95" cy="36" r="3" fill={CY} opacity="0.8" />
        <path d="M172 32 l10 0 l0 10" stroke={CY} strokeWidth="2" strokeLinecap="round" />
        <rect className="a-grow" style={v({ '--g0': '0.12', '--dur': '4.2s', animationDelay: '0.25s' })} x="96" y="56" width="84" height="8" rx="4" fill={CY} opacity="0.5" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.5s' })} x="96" y="72" width="60" height="6" rx="3" fill={DIM} opacity="0.6" />
        <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '4.2s', animationDelay: '0.75s' })} x="96" y="86" width="72" height="6" rx="3" fill={DIM} opacity="0.6" />
      </g>
    </Svg>
  );
}

/** GlobalSearch — ⌘K summons the palette; the query lands on one row. */
export function GlobalSearchIcon() {
  return (
    <Svg>
      {/* scrim */}
      <rect x="0" y="0" width="220" height="130" fill={INK} opacity="0.06" />
      <g className="a-panel">
        {/* palette */}
        <rect x="30" y="20" width="160" height="92" rx="10" fill={PAPER} stroke={DIM} strokeWidth="2" />
        {/* search bar */}
        <rect x="42" y="30" width="136" height="22" rx="6" fill={CY} fillOpacity="0.06" stroke={CY} strokeWidth="2" />
        <circle cx="55" cy="41" r="5" stroke={CY} strokeWidth="2" />
        <line x1="59" y1="45" x2="63" y2="49" stroke={CY} strokeWidth="2" strokeLinecap="round" />
        <rect
          className="a-grow"
          style={v({ '--g0': '0.05', '--dur': '4.4s' })}
          x="70"
          y="37"
          width="52"
          height="7"
          rx="3.5"
          fill={CY}
          opacity="0.55"
        />
        <line className="a-blink" x1="126" y1="35" x2="126" y2="47" stroke={CY} strokeWidth="2" strokeLinecap="round" />
        {/* the ⌘K badge, pressed */}
        <rect
          className="a-fade"
          style={v({ '--o0': '0.25', '--o1': '1', '--dur': '4.4s' })}
          x="152"
          y="34"
          width="20"
          height="14"
          rx="4"
          stroke={DIM}
          strokeWidth="1.5"
        />
        {/* results — the top one is the active row */}
        <rect
          className="a-fade"
          style={v({ '--o0': '0', '--o1': '1', '--dur': '4.4s', animationDelay: '0.5s' })}
          x="42"
          y="60"
          width="136"
          height="16"
          rx="5"
          fill={CY}
          fillOpacity="0.12"
          stroke={CY}
          strokeWidth="1.5"
        />
        <rect x="50" y="65" width="44" height="6" rx="3" fill={CY} opacity="0.8" />
        <rect x="100" y="65" width="30" height="6" rx="3" fill={DIM} opacity="0.5" />
        <rect
          className="a-fade"
          style={v({ '--o0': '0.15', '--o1': '0.6', '--dur': '4.4s', animationDelay: '0.7s' })}
          x="50"
          y="84"
          width="60"
          height="6"
          rx="3"
          fill={DIM}
        />
        <rect
          className="a-fade"
          style={v({ '--o0': '0.15', '--o1': '0.6', '--dur': '4.4s', animationDelay: '0.9s' })}
          x="50"
          y="98"
          width="80"
          height="6"
          rx="3"
          fill={DIM}
        />
      </g>
    </Svg>
  );
}

/** ElementPicker — a cursor crosses the page and a box lights up under it. */
export function ElementPickerIcon() {
  return (
    <Svg>
      <rect x="42" y="22" width="136" height="86" rx="7" stroke={DIM} strokeWidth="2" />
      <rect x="54" y="32" width="52" height="8" rx="4" fill={DIM} opacity="0.5" />
      <rect x="54" y="50" width="50" height="44" rx="5" stroke={DIM} strokeWidth="2" />

      <g className="a-fade" style={v({ '--o0': '0.25', '--o1': '1', '--dur': '4.4s' })}>
        <rect x="116" y="50" width="50" height="44" rx="5" fill={CY} fillOpacity="0.18" stroke={CY} strokeWidth="2.5" />
        <rect className="a-grow" style={v({ '--g0': '0.15', '--dur': '4.4s', animationDelay: '0.3s' })} x="124" y="58" width="26" height="5" rx="2.5" fill={CY} opacity="0.7" />
        <rect className="a-grow" style={v({ '--g0': '0.12', '--dur': '4.4s', animationDelay: '0.55s' })} x="124" y="68" width="34" height="5" rx="2.5" fill={CY} opacity="0.4" />
      </g>

      <g className="a-drift" style={v({ '--dx': '52px', '--dy': '12px', '--dur': '4.4s' })}>
        <path
          d="M78 58 L78 80 L84 74.5 L88.5 84 L93 82 L88.5 72.5 L96 72 Z"
          fill={PAPER}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    </Svg>
  );
}

/**
 * The component *is* the toggle, so the icon is the toggle: a card grid and a
 * list stack cross-fading in antiphase (one `a-fade` run backwards against the
 * other), while the segmented control's chip slides between the two glyphs.
 */
export function CollectionIcon() {
  const DUR = '4.6s';
  // Card grid — 3 across, 2 down. Each card is a picture over a title bar.
  const cards = [0, 1, 2].flatMap((col) =>
    [0, 1].map((row) => ({ x: 46 + col * 46, y: 44 + row * 34, key: `${col}-${row}` })),
  );
  return (
    <Svg>
      {/* the segmented cards/list control */}
      <rect x="46" y="18" width="42" height="18" rx="5" stroke={DIM} strokeWidth="2" />
      <rect
        className="a-drift"
        style={v({ '--dx': '20px', '--dur': DUR })}
        x="48"
        y="20"
        width="18"
        height="14"
        rx="3.5"
        fill={CY}
        fillOpacity="0.9"
      />
      {/* grid glyph */}
      {[0, 1].flatMap((r) =>
        [0, 1].map((c) => (
          <rect key={`g${r}${c}`} x={53 + c * 6} y={24 + r * 6} width="4" height="4" rx="1" fill={INK} opacity="0.55" />
        )),
      )}
      {/* list glyph */}
      {[0, 1, 2].map((r) => (
        <rect key={`l${r}`} x={72} y={24 + r * 4.5} width="10" height="2.5" rx="1.25" fill={DIM} opacity="0.55" />
      ))}

      {/* cards view — fades out as the list fades in */}
      <g className="a-fade" style={v({ '--o0': '1', '--o1': '0.05', '--dur': DUR })}>
        {cards.map(({ x, y, key }) => (
          <g key={key}>
            <rect x={x} y={y} width="38" height="28" rx="4" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="1.6" />
            <rect x={x + 4} y={y + 4} width="30" height="14" rx="2" fill={CY} opacity="0.45" />
            <rect x={x + 4} y={y + 21} width="20" height="3" rx="1.5" fill={DIM} opacity="0.6" />
          </g>
        ))}
      </g>

      {/* list view — the same items, one column, thumbnail + two lines */}
      <g className="a-fade" style={v({ '--o0': '0.05', '--o1': '1', '--dur': DUR })}>
        {[0, 1, 2, 3].map((i) => {
          const y = 44 + i * 17;
          return (
            <g key={i}>
              <rect x="46" y={y} width="14" height="14" rx="3" fill={CY} opacity="0.5" />
              <rect x="66" y={y + 2} width={i % 2 ? 58 : 74} height="4" rx="2" fill={CY} opacity="0.75" />
              <rect x="66" y={y + 9} width={i % 2 ? 40 : 50} height="3" rx="1.5" fill={DIM} opacity="0.4" />
            </g>
          );
        })}
      </g>
    </Svg>
  );
}

/** Progress — a bar fills its track while a percent tick counts along. */
export function ProgressIcon() {
  return (
    <Svg>
      <rect x="46" y="42" width="128" height="12" rx="6" stroke={DIM} strokeWidth="2" />
      <rect
        className="a-grow"
        style={v({ '--g0': '0.08', '--dur': '4.6s' })}
        x="50"
        y="46"
        width="120"
        height="4"
        rx="2"
        fill={CY}
      />
      {/* the indeterminate cousin — a pill sweeping its own track */}
      <rect x="46" y="76" width="128" height="12" rx="6" stroke={DIM} strokeWidth="2" opacity="0.6" />
      <g className="a-drift" style={v({ '--dx': '86px', '--dur': '2.6s' })}>
        <rect x="50" y="80" width="34" height="4" rx="2" fill={DIM} opacity="0.8" />
      </g>
      <rect className="a-fade" style={v({ '--o0': '0.2', '--o1': '0.9', '--dur': '4.6s' })} x="150" y="24" width="24" height="8" rx="3" fill={CY} opacity="0.5" />
    </Svg>
  );
}

/** StatTile — the KPI ticks up and its trend arrow lifts off. */
export function StatTileIcon() {
  return (
    <Svg>
      <rect x="52" y="28" width="116" height="74" rx="9" stroke={DIM} strokeWidth="2" />
      <rect x="64" y="40" width="44" height="5" rx="2.5" fill={DIM} opacity="0.5" />
      {/* the big number — digit bars rolling in one after another */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          className="a-reveal"
          style={v({ '--dur': '4.2s', animationDelay: `${i * 0.22}s` })}
          x={64 + i * 15}
          y="56"
          width="11"
          height="20"
          rx="3"
          fill={CY}
          fillOpacity="0.8"
        />
      ))}
      <rect x="64" y="86" width="56" height="4" rx="2" fill={DIM} opacity="0.35" />
      {/* delta chip drifting upward, the good direction */}
      <g className="a-drift" style={v({ '--dx': '3px', '--dy': '-6px', '--dur': '4.2s' })}>
        <rect x="126" y="56" width="30" height="14" rx="7" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="1.6" />
        <path d="M133 66 l6 -6 m0 0 h-4.5 m4.5 0 v4.5" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}

/** DataTable — a sort flips and the rows glide into their new order. */
export function DataTableIcon() {
  const row = (y: number, w1: number, w2: number, delay: string) => (
    <g className="a-reveal" style={v({ '--dur': '4.6s', animationDelay: delay })}>
      <rect x="52" y={y} width="6" height="6" rx="1.5" stroke={DIM} strokeWidth="1.5" />
      <rect x="66" y={y + 1} width={w1} height="4" rx="2" fill={CY} opacity="0.75" />
      <rect x="120" y={y + 1} width={w2} height="4" rx="2" fill={DIM} opacity="0.5" />
    </g>
  );
  return (
    <Svg>
      <rect x="44" y="26" width="132" height="78" rx="8" stroke={DIM} strokeWidth="2" />
      {/* sticky header */}
      <line x1="44" y1="46" x2="176" y2="46" stroke={DIM} strokeWidth="2" />
      <rect x="66" y="34" width="34" height="5" rx="2.5" fill={CY} opacity="0.85" />
      <rect x="120" y="34" width="26" height="5" rx="2.5" fill={DIM} opacity="0.55" />
      {/* the sort chevron breathing at the active header */}
      <g className="a-breathe" style={v({ '--s': '1.35', '--dur': '4.6s' })}>
        <path d="M106 39 l4 -5 l4 5" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {row(56, 44, 34, '0s')}
      {row(70, 36, 40, '0.25s')}
      {row(84, 48, 28, '0.5s')}
    </Svg>
  );
}

/** Switch — the thumb slides across while the track lights up behind it. */
export function SwitchIcon() {
  return (
    <Svg>
      <rect x="70" y="45" width="80" height="40" rx="20" stroke={DIM} strokeWidth="2.5" />
      <rect
        className="a-fade"
        style={v({ '--o0': '0', '--o1': '0.18', '--dur': '4.4s' })}
        x="70"
        y="45"
        width="80"
        height="40"
        rx="20"
        fill={CY}
      />
      <g className="a-drift" style={v({ '--dx': '40px', '--dur': '4.4s' })}>
        <circle cx="90" cy="65" r="13" fill={PAPER} stroke={CY} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Checkbox — the box fills and a tick draws in. */
export function CheckboxIcon() {
  return (
    <Svg>
      <rect x="70" y="35" width="60" height="60" rx="10" stroke={DIM} strokeWidth="2.5" />
      <rect
        className="a-fade"
        style={v({ '--o0': '0', '--o1': '1', '--dur': '4s' })}
        x="70"
        y="35"
        width="60"
        height="60"
        rx="10"
        fill={CY}
        fillOpacity="0.16"
        stroke={CY}
        strokeWidth="2.5"
      />
      <path
        className="a-fade"
        style={v({ '--o0': '0', '--o1': '1', '--dur': '4s', animationDelay: '0.25s' })}
        d="M84 65 l12 12 l24 -24"
        stroke={CY}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="146" y="52" width="52" height="6" rx="3" fill={DIM} opacity="0.5" />
      <rect x="146" y="66" width="36" height="6" rx="3" fill={DIM} opacity="0.3" />
    </Svg>
  );
}

/** Radio — the selection ring hops between three stacked options. */
export function RadioIcon() {
  const rows: Array<[number, number]> = [
    [30, 66],
    [65, 50],
    [100, 58],
  ];
  return (
    <Svg>
      {rows.map(([y, w]) => (
        <g key={y}>
          <circle cx="66" cy={y} r="11" stroke={DIM} strokeWidth="2.5" />
          <rect x="90" y={y - 5} width={w} height="10" rx="5" fill={DIM} opacity="0.35" />
        </g>
      ))}
      <g className="a-drift" style={v({ '--dy': '70px', '--dur': '4.6s' })}>
        <circle cx="66" cy="30" r="11" fill={CY} fillOpacity="0.16" stroke={CY} strokeWidth="2.5" />
        <circle cx="66" cy="30" r="4.5" fill={CY} />
      </g>
    </Svg>
  );
}

/** Slider — the thumb sweeps the track and the fill keeps up. */
/** SplitView — a frame half photo, half pixel grid, with a handle sweeping the seam. */
export function SplitViewIcon() {
  return (
    <Svg>
      <rect x="42" y="26" width="136" height="78" rx="7" stroke={DIM} strokeWidth="2" />
      <path d="M42 82 L74 56 L96 72 L116 50 L146 78 L178 60 V104 H42 Z" fill={DIM} opacity="0.28" />
      <g opacity="0.6">
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={124 + col * 18}
              y={30 + row * 18}
              width="16"
              height="16"
              fill={col + row === 0 ? PAPER : CY}
              opacity={((row + col) % 3) * 0.25 + 0.25}
            />
          )),
        )}
      </g>
      <g className="a-drift" style={v({ '--dx': '30px', '--dur': '5s' })}>
        <line x1="110" y1="26" x2="110" y2="104" stroke={CY} strokeWidth="2.5" />
        <circle cx="110" cy="65" r="11" fill={PAPER} stroke={CY} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

export function SliderIcon() {
  return (
    <Svg>
      <rect x="48" y="62" width="124" height="6" rx="3" stroke={DIM} strokeWidth="2" />
      <rect
        className="a-grow"
        style={v({ '--g0': '0.14', '--dur': '5s' })}
        x="50"
        y="64"
        width="100"
        height="2"
        rx="1"
        fill={CY}
      />
      <g className="a-drift" style={v({ '--dx': '86px', '--dur': '5s' })}>
        <circle cx="64" cy="65" r="10" fill={PAPER} stroke={CY} strokeWidth="2.5" />
      </g>
      <rect x="48" y="34" width="30" height="5" rx="2.5" fill={DIM} opacity="0.5" />
      <rect
        className="a-fade"
        style={v({ '--o0': '0.35', '--o1': '0.9', '--dur': '5s' })}
        x="152"
        y="34"
        width="20"
        height="5"
        rx="2.5"
        fill={CY}
      />
    </Svg>
  );
}

/** Select — the list drops open and the highlight walks down to its pick. */
export function SelectIcon() {
  return (
    <Svg>
      <rect x="52" y="22" width="116" height="24" rx="7" stroke={DIM} strokeWidth="2" />
      <rect x="62" y="31" width="42" height="5" rx="2.5" fill={DIM} opacity="0.6" />
      <g className="a-drift" style={v({ '--dy': '3px', '--dur': '4.8s' })}>
        <path d="M152 31 l6 7 l6 -7" stroke={CY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="a-fade" style={v({ '--o0': '0', '--o1': '1', '--dur': '4.8s' })}>
        <rect x="52" y="52" width="116" height="56" rx="7" stroke={DIM} strokeWidth="2" fill={PAPER} />
        <rect x="62" y="60" width="52" height="5" rx="2.5" fill={DIM} opacity="0.5" />
        <rect x="62" y="94" width="44" height="5" rx="2.5" fill={DIM} opacity="0.5" />
        {/* the active row's highlight, walking to the picked option */}
        <g className="a-drift" style={v({ '--dy': '-17px', '--dur': '4.8s' })}>
          <rect x="57" y="90" width="106" height="14" rx="4" fill={CY} fillOpacity="0.14" />
        </g>
        <rect x="62" y="77" width="58" height="5" rx="2.5" fill={CY} opacity="0.9" />
        <path
          className="a-fade"
          style={v({ '--o0': '0', '--o1': '1', '--dur': '4.8s', animationDelay: '0.4s' })}
          d="M150 77 l4 5 l8 -9"
          stroke={CY}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </Svg>
  );
}

/** FileEditor — a code buffer types itself while the caret blinks in the gutter's shadow. */
export function FileEditorIcon() {
  const codeLine = (y: number, xs: [number, number, string][], delay: string) => (
    <g className="a-reveal" style={v({ '--dur': '5s', animationDelay: delay })}>
      {xs.map(([x, w, tone], i) => (
        <rect key={i} x={x} y={y} width={w} height="4" rx="2" fill={tone} opacity={tone === CY ? '0.85' : '0.5'} />
      ))}
    </g>
  );
  return (
    <Svg>
      <rect x="44" y="22" width="132" height="86" rx="8" stroke={DIM} strokeWidth="2" />
      {/* menu bar */}
      <line x1="44" y1="38" x2="176" y2="38" stroke={DIM} strokeWidth="2" />
      <rect x="52" y="28" width="16" height="4" rx="2" fill={CY} opacity="0.85" />
      <rect x="74" y="28" width="16" height="4" rx="2" fill={DIM} opacity="0.55" />
      {/* dropdown unfurling under the File menu */}
      <g className="a-fade" style={v({ '--dur': '5s' })}>
        <rect x="50" y="42" width="40" height="26" rx="4" fill={PAPER} stroke={DIM} strokeWidth="1.5" />
        <rect x="56" y="48" width="24" height="3.5" rx="1.75" fill={CY} opacity="0.8" />
        <rect x="56" y="56" width="18" height="3.5" rx="1.75" fill={DIM} opacity="0.5" />
      </g>
      {/* gutter */}
      <line x1="60" y1="38" x2="60" y2="108" stroke={DIM} strokeWidth="1.5" opacity="0.6" />
      {[48, 60, 72, 84, 96].map((y) => (
        <rect key={y} x="50" y={y} width="5" height="3.5" rx="1.75" fill={DIM} opacity="0.4" />
      ))}
      {/* highlighted code lines */}
      {codeLine(48, [[98, 20, CY], [122, 30, DIM]], '0s')}
      {codeLine(60, [[104, 34, DIM], [142, 16, CY]], '0.3s')}
      {codeLine(72, [[98, 14, DIM], [116, 26, CY], [146, 18, DIM]], '0.6s')}
      {codeLine(84, [[104, 42, DIM]], '0.9s')}
      {/* the caret, breathing */}
      <g className="a-breathe" style={v({ '--s': '1', '--dur': '2.2s' })}>
        <rect x="150" y="94" width="2.5" height="10" rx="1.25" fill={CY} />
      </g>
    </Svg>
  );
}

/** ColorPicker — the saturation/value square with its thumb wandering, and a
 * hue strip below with a drifting thumb of its own. */
export function ColorPickerIcon() {
  const x0 = 62;
  const y0 = 22;
  const w = 96;
  const h = 62;
  const steps = 6;
  return (
    <Svg>
      <rect x={x0} y={y0} width={w} height={h} rx="8" stroke={DIM} strokeWidth="2" />
      {/* opacity-stepped columns stand in for the saturation gradient */}
      {Array.from({ length: steps }, (_, i) => (
        <rect
          key={i}
          x={x0 + 4 + i * ((w - 8) / steps)}
          y={y0 + 4}
          width={(w - 8) / steps - 2}
          height={h - 8}
          rx="3"
          fill={CY}
          fillOpacity={0.08 + (i / (steps - 1)) * 0.55}
        />
      ))}
      {/* the picker thumb wandering across the square */}
      <g className="a-drift" style={v({ '--dx': '56px', '--dur': '5s' })}>
        <circle cx={x0 + 22} cy={y0 + 26} r="7" fill={PAPER} stroke={CY} strokeWidth="2.5" />
      </g>
      {/* hue strip */}
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={`h${i}`}
          x={x0 + i * (w / 8)}
          y={y0 + h + 12}
          width={w / 8 - 2}
          height="10"
          rx="3"
          fill={CY}
          fillOpacity={[0.9, 0.7, 0.5, 0.35, 0.5, 0.65, 0.8, 0.95][i]}
        />
      ))}
      <g className="a-drift" style={v({ '--dx': '-60px', '--dur': '5s' })}>
        <circle cx={x0 + w - 14} cy={y0 + h + 17} r="7.5" fill={PAPER} stroke={CY} strokeWidth="2.5" />
      </g>
    </Svg>
  );
}

/** Toolbar — a strip of tool cells; the active highlight hops along the strip
 * while the overflow "⋯" blinks at the end. */
export function ToolbarIcon() {
  const s = 24;
  const g = 7;
  const n = 4;
  const x0 = 40;
  const y0 = 53;
  return (
    <Svg>
      <rect
        x={x0 - 8}
        y={y0 - 8}
        width={n * (s + g) + 26 + s + 8}
        height={s + 16}
        rx="10"
        stroke={DIM}
        strokeWidth="2"
      />
      {/* the active-tool highlight hopping between the first cells */}
      <g className="a-drift" style={v({ '--dx': `${2 * (s + g)}px`, '--dur': '4.6s' })}>
        <rect x={x0} y={y0} width={s} height={s} rx="6" fill={CY} fillOpacity="0.85" />
      </g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * (s + g)} y={y0} width={s} height={s} rx="6" stroke={DIM} strokeWidth="2" />
          <circle cx={x0 + i * (s + g) + s / 2} cy={y0 + s / 2} r="4" fill={DIM} opacity="0.5" />
        </g>
      ))}
      {/* group hairline then the overflow ⋯ */}
      <line
        x1={x0 + n * (s + g) + 3}
        y1={y0 + 2}
        x2={x0 + n * (s + g) + 3}
        y2={y0 + s - 2}
        stroke={DIM}
        strokeWidth="2"
      />
      <g className="a-fade" style={v({ '--o0': '0.3', '--o1': '1', '--dur': '2.6s' })}>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={x0 + n * (s + g) + 18 + i * 8} cy={y0 + s / 2} r="2.5" fill={CY} />
        ))}
      </g>
    </Svg>
  );
}

/** InspectorPanel — a property panel whose label/control rows breathe in
 * sequence under two section headers. */
export function InspectorPanelIcon() {
  const x0 = 62;
  const y0 = 16;
  const w = 96;
  const row = (y: number, i: number) => (
    <g key={i} className="a-fade" style={v({ '--o0': '0.35', '--o1': '1', '--dur': '4s', '--delay': `${i * 0.35}s` })}>
      <rect x={x0 + 10} y={y} width="26" height="5" rx="2.5" fill={DIM} opacity="0.6" />
      <rect x={x0 + 46} y={y - 3} width="40" height="11" rx="4" stroke={CY} strokeWidth="2" />
    </g>
  );
  return (
    <Svg>
      <rect x={x0} y={y0} width={w} height="98" rx="10" stroke={DIM} strokeWidth="2" />
      {/* section header: chevron + title */}
      <path d={`M ${x0 + 12} 30 l 5 4 l -5 4`} stroke={CY} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x={x0 + 24} y="31" width="34" height="5" rx="2.5" fill={CY} fillOpacity="0.8" />
      {row(48, 0)}
      {row(64, 1)}
      <line x1={x0 + 6} y1="78" x2={x0 + w - 6} y2="78" stroke={DIM} strokeWidth="1.5" opacity="0.7" />
      <path d={`M ${x0 + 12} 84 l 5 4 l -5 4`} stroke={CY} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x={x0 + 24} y="85" width="26" height="5" rx="2.5" fill={CY} fillOpacity="0.8" />
      {row(102, 2)}
    </Svg>
  );
}

/** BottomNav — the bar with its raised centre bubble; the sub-link drawer
 * slides up from behind it and back down. */
export function BottomNavIcon() {
  const slot = (cx: number) => (
    <g key={cx}>
      <rect x={cx - 7} y="92" width="14" height="10" rx="3" stroke={DIM} strokeWidth="2" />
      <rect x={cx - 9} y="107" width="18" height="4" rx="2" fill={DIM} opacity="0.55" />
    </g>
  );
  return (
    <Svg>
      {/* the drawer, rising from behind the bar */}
      <g className="a-drift" style={v({ '--dx': '0px', '--dy': '-26px', '--dur': '4.6s' })}>
        <g className="a-fade" style={v({ '--o0': '0', '--o1': '1', '--dur': '4.6s' })}>
          <rect x="34" y="86" width="152" height="30" rx="8" fill={PAPER} stroke={DIM} strokeWidth="2" />
          {[62, 96, 130, 164].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="97" r="5" stroke={CY} strokeWidth="2" opacity="0.9" />
              <rect x={cx - 8} y="106" width="16" height="4" rx="2" fill={CY} opacity="0.6" />
            </g>
          ))}
        </g>
      </g>
      {/* the bar itself */}
      <rect x="26" y="82" width="168" height="38" rx="10" fill={INK} fillOpacity="0.25" stroke={DIM} strokeWidth="2" />
      {[54, 82, 138, 166].map(slot)}
      {/* the raised centre bubble */}
      <g className="a-breathe" style={v({ '--s': '1.06', '--dur': '3.4s' })}>
        <rect x="94" y="64" width="32" height="32" rx="10" fill={CY} />
        <circle cx="110" cy="80" r="6" fill={INK} fillOpacity="0.55" />
      </g>
      <rect x="99" y="103" width="22" height="4" rx="2" fill={CY} opacity="0.85" />
    </Svg>
  );
}
