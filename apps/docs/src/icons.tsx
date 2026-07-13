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

/** PhonePreview — a device whose screen scrolls in a slow breath. */
export function PhonePreviewIcon() {
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
          <rect x="96" y="40" width="28" height="6" rx="3" fill={CY} opacity="0.6" />
          <rect x="96" y="52" width="20" height="4" rx="2" fill={DIM} opacity="0.5" />
          <rect x="96" y="64" width="28" height="6" rx="3" fill={CY} opacity="0.6" />
          <rect x="96" y="76" width="24" height="4" rx="2" fill={DIM} opacity="0.5" />
          <rect x="96" y="88" width="28" height="6" rx="3" fill={CY} opacity="0.6" />
          <rect x="96" y="100" width="18" height="4" rx="2" fill={DIM} opacity="0.5" />
          <rect x="96" y="112" width="26" height="6" rx="3" fill={CY} opacity="0.6" />
        </g>
      </g>
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
      <rect x="94" y="52" width="50" height="5" rx="2.5" fill={DIM} opacity="0.55" />
      <rect x="64" y="52" width="22" height="5" rx="2.5" fill={DIM} opacity="0.3" />
      <rect x="64" y="66" width="80" height="5" rx="2.5" fill={DIM} opacity="0.45" />
      <rect x="64" y="78" width="64" height="5" rx="2.5" fill={DIM} opacity="0.3" />
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
      <rect x="44" y="38" width="70" height="6" rx="3" fill={DIM} opacity="0.6" />
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

/** FloatingPanel — the window hovers, breathing above its dashed dock. */
export function FloatingPanelIcon() {
  return (
    <Svg>
      <rect x="46" y="56" width="128" height="54" rx="8" stroke={DIM} strokeWidth="2" strokeDasharray="5 5" opacity="0.55" />
      <g className="a-drift" style={v({ '--dy': '-6px', '--dur': '4.4s' })}>
        <rect x="62" y="26" width="104" height="66" rx="8" fill={INK} fillOpacity="0.08" stroke={CY} strokeWidth="2.5" />
        <path d="M62 42 h104" stroke={CY} strokeWidth="1.5" opacity="0.7" />
        <rect x="72" y="32" width="30" height="6" rx="3" fill={CY} opacity="0.8" />
        <circle cx="152" cy="35" r="3" fill={CY} opacity="0.7" />
        <rect x="72" y="52" width="68" height="5" rx="2.5" fill={DIM} opacity="0.5" />
        <rect x="72" y="64" width="82" height="5" rx="2.5" fill={DIM} opacity="0.4" />
        <rect x="72" y="76" width="50" height="5" rx="2.5" fill={DIM} opacity="0.3" />
      </g>
    </Svg>
  );
}

/** ResizableLayout — side and bottom drawers breathe open against the frame. */
export function ResizableLayoutIcon() {
  return (
    <Svg>
      <rect x="34" y="22" width="152" height="86" rx="8" stroke={DIM} strokeWidth="2" opacity="0.55" />
      <g className="a-grow" style={v({ '--g0': '0.2', '--dur': '4.6s' })}>
        <rect x="34" y="22" width="44" height="86" rx="0" fill={CY} fillOpacity="0.14" />
        <line x1="78" y1="22" x2="78" y2="108" stroke={CY} strokeWidth="2.5" />
      </g>
      <rect x="152" y="22" width="34" height="86" fill={INK} fillOpacity="0.06" />
      <line x1="152" y1="22" x2="152" y2="108" stroke={DIM} strokeWidth="2" opacity="0.6" />
      <g className="a-drift" style={v({ '--dy': '-5px', '--dur': '4.2s' })}>
        <rect x="78" y="82" width="74" height="26" fill={CY} fillOpacity="0.16" />
        <line x1="78" y1="82" x2="152" y2="82" stroke={CY} strokeWidth="2.5" />
      </g>
      <rect x="90" y="34" width="30" height="6" rx="3" fill={DIM} opacity="0.5" />
      <rect x="90" y="46" width="46" height="5" rx="2.5" fill={DIM} opacity="0.35" />
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
        <rect x="120" y="74" width="42" height="5" rx="2.5" fill={CY} opacity="0.75" />
        <rect x="120" y="84" width="28" height="4" rx="2" fill={DIM} opacity="0.6" />
      </g>
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
        <rect x="80" y="52" width="40" height="5" rx="2.5" fill={CY} opacity="0.8" />
        <rect x="80" y="64" width="52" height="4" rx="2" fill={DIM} opacity="0.6" />
        <rect x="112" y="74" width="28" height="9" rx="4.5" fill={CY} fillOpacity="0.3" />
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
        <rect x="104" y="56" width="32" height="5" rx="2.5" fill={DIM} opacity="0.6" />
        <rect x="104" y="68" width="24" height="5" rx="2.5" fill={DIM} opacity="0.6" />
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
      <rect x="76" y="98" width="68" height="8" rx="4" fill={CY} fillOpacity="0.3" />
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
        <rect x="143" y="61" width="28" height="6" rx="3" fill={CY} opacity="0.8" />
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
        <rect x="104" y="32" width="56" height="8" rx="4" fill={CY} opacity="0.45" />
        <circle cx="95" cy="36" r="3" fill={CY} opacity="0.8" />
        <path d="M172 32 l10 0 l0 10" stroke={CY} strokeWidth="2" strokeLinecap="round" />
        <rect x="96" y="56" width="84" height="8" rx="4" fill={CY} opacity="0.5" />
        <rect x="96" y="72" width="60" height="6" rx="3" fill={DIM} opacity="0.6" />
        <rect x="96" y="86" width="72" height="6" rx="3" fill={DIM} opacity="0.6" />
      </g>
    </Svg>
  );
}
