/*
 * One custom animated SVG per component — the homepage cards' whole personality.
 * Monochrome cyanotype (cyan strokes on ink). Motion is driven by CSS keyframes
 * (see index.css, `.a-*` classes), so `prefers-reduced-motion` disables it all
 * via the `.anim-svg` guard.
 */
const VB = '0 0 220 130';
const CY = 'var(--cyan)';
const DIM = 'var(--cyan-deep)';

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={VB} className="anim-svg h-full w-full" fill="none" role="img" aria-hidden>
      {children}
    </svg>
  );
}

/** ImageViewer — a plate with a loupe crossing it. */
export function ImageViewerIcon() {
  return (
    <Svg>
      <rect x="40" y="28" width="140" height="74" rx="6" stroke={DIM} strokeWidth="2" />
      <path d="M40 84 L84 58 L110 78 L136 50 L180 86" stroke={CY} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="150" cy="42" r="7" fill={CY} opacity="0.5" />
      <g className="a-loupe">
        <circle cx="96" cy="66" r="20" stroke={CY} strokeWidth="2.5" fill="var(--ink-950)" fillOpacity="0.55" />
        <line x1="111" y1="81" x2="126" y2="96" stroke={CY} strokeWidth="3" strokeLinecap="round" />
        <line x1="90" y1="66" x2="102" y2="66" stroke={CY} strokeWidth="2" strokeLinecap="round" />
        <line x1="96" y1="60" x2="96" y2="72" stroke={CY} strokeWidth="2" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

/** ViewableImage — a grid where one tile pops open. */
export function ViewableImageIcon() {
  const tile = (x: number, y: number, cls?: string) => (
    <rect x={x} y={y} width="42" height="42" rx="4" stroke={DIM} strokeWidth="2" className={cls} />
  );
  return (
    <Svg>
      {tile(52, 26)}
      {tile(102, 26)}
      {tile(52, 74)}
      <g className="a-pop">
        <rect x="102" y="74" width="42" height="42" rx="4" stroke={CY} strokeWidth="2.5" fill={CY} fillOpacity="0.12" />
      </g>
      <path d="M158 30 l8 0 0 8 M158 112 l8 0 0 -8" stroke={CY} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** ProgressiveImage — coarse blocks resolving into a sharp image. */
export function ProgressiveImageIcon() {
  return (
    <Svg>
      <rect x="60" y="26" width="100" height="78" rx="6" stroke={DIM} strokeWidth="2" />
      <path d="M60 90 L92 66 L114 82 L140 58 L160 78 L160 104 L60 104 Z" fill={CY} fillOpacity="0.16" />
      <circle cx="132" cy="46" r="7" fill={CY} opacity="0.55" />
      <g className="a-resolve">
        <rect x="60" y="26" width="50" height="39" fill={CY} fillOpacity="0.4" />
        <rect x="110" y="26" width="50" height="39" fill={DIM} fillOpacity="0.5" />
        <rect x="60" y="65" width="50" height="39" fill={DIM} fillOpacity="0.5" />
        <rect x="110" y="65" width="50" height="39" fill={CY} fillOpacity="0.35" />
      </g>
    </Svg>
  );
}

/** FuzzyList — rows with a scanning highlight + caret. */
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
      <line className="a-caret" x1="70" y1="24" x2="70" y2="38" stroke={CY} strokeWidth="2" />
      <g className="a-scan">
        <rect x="66" y="52" width="98" height="24" rx="4" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="1.5" />
      </g>
      <g transform="translate(0 6)">{row(52)}</g>
      <g transform="translate(0 6)">{row(82)}</g>
    </Svg>
  );
}

/** PhonePreview — a device with a scrolling screen. */
export function PhonePreviewIcon() {
  return (
    <Svg>
      <rect x="86" y="18" width="48" height="94" rx="12" stroke={DIM} strokeWidth="2" />
      <rect x="100" y="24" width="20" height="5" rx="2.5" fill={CY} />
      <clipPath id="scr">
        <rect x="90" y="33" width="40" height="75" rx="4" />
      </clipPath>
      <g clipPath="url(#scr)">
        <rect x="90" y="33" width="40" height="75" fill={CY} fillOpacity="0.06" />
        <g className="a-scroll">
          <rect x="96" y="40" width="28" height="6" rx="3" fill={CY} opacity="0.6" />
          <rect x="96" y="52" width="20" height="4" rx="2" fill={DIM} opacity="0.5" />
          <rect x="96" y="64" width="28" height="6" rx="3" fill={CY} opacity="0.6" />
          <rect x="96" y="76" width="24" height="4" rx="2" fill={DIM} opacity="0.5" />
          <rect x="96" y="88" width="28" height="6" rx="3" fill={CY} opacity="0.6" />
          <rect x="96" y="100" width="18" height="4" rx="2" fill={DIM} opacity="0.5" />
        </g>
      </g>
    </Svg>
  );
}

/** Button — a control taking a click, with a ripple. */
export function ButtonIcon() {
  return (
    <Svg>
      <rect x="62" y="48" width="96" height="34" rx="9" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="2.5" />
      <rect x="86" y="62" width="48" height="6" rx="3" fill={CY} opacity="0.8" />
      <circle className="a-ripple" cx="110" cy="65" r="6" fill={CY} fillOpacity="0.3" />
      <path d="M120 78 l0 26 l7 -7 l6 12 l5 -3 l-6 -12 l10 0 Z" fill="var(--paper)" stroke="var(--ink-950)" strokeWidth="1.5" />
    </Svg>
  );
}

/** Input — a field with a focus ring and blinking caret. */
export function InputIcon() {
  return (
    <Svg>
      <rect className="a-ring" x="48" y="50" width="124" height="30" rx="8" stroke={CY} strokeWidth="2.5" />
      <rect x="60" y="63" width="44" height="5" rx="2.5" fill={DIM} opacity="0.6" />
      <line className="a-caret" x1="110" y1="58" x2="110" y2="72" stroke={CY} strokeWidth="2" />
    </Svg>
  );
}

/** cn — two class tokens merging into one. */
export function CnIcon() {
  return (
    <Svg>
      <g className="a-merge-l">
        <rect x="34" y="52" width="52" height="26" rx="13" stroke={DIM} strokeWidth="2" />
        <rect x="44" y="62" width="32" height="6" rx="3" fill={DIM} opacity="0.6" />
      </g>
      <g className="a-merge-r">
        <rect x="134" y="52" width="52" height="26" rx="13" stroke={DIM} strokeWidth="2" />
        <rect x="144" y="62" width="32" height="6" rx="3" fill={DIM} opacity="0.6" />
      </g>
      <g className="a-merge-in">
        <rect x="82" y="50" width="56" height="30" rx="15" fill={CY} fillOpacity="0.14" stroke={CY} strokeWidth="2.5" />
        <path d="M96 65 l8 8 l16 -16" stroke={CY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}
