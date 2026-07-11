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

/** VirtualList — a viewport window over a long list, with a moving scrollbar. */
export function VirtualListIcon() {
  return (
    <Svg>
      <rect x="52" y="24" width="104" height="82" rx="8" stroke={DIM} strokeWidth="2" />
      <clipPath id="vl">
        <rect x="58" y="30" width="80" height="70" rx="3" />
      </clipPath>
      <g clipPath="url(#vl)">
        <g className="a-vscroll">
          {[26, 42, 58, 74, 90, 106].map((y, i) => (
            <g key={y}>
              <rect x="64" y={y} width="52" height="6" rx="3" fill={i === 2 || i === 3 ? CY : DIM} opacity={i === 2 || i === 3 ? 0.85 : 0.4} />
              <rect x="64" y={y + 9} width="34" height="4" rx="2" fill={DIM} opacity="0.3" />
            </g>
          ))}
        </g>
      </g>
      <rect x="146" y="30" width="4" height="70" rx="2" fill={DIM} opacity="0.25" />
      <rect className="a-thumb" x="146" y="30" width="4" height="22" rx="2" fill={CY} />
      <rect x="164" y="30" width="8" height="70" rx="2" fill={CY} opacity="0.06" />
    </Svg>
  );
}

/** Nav2D — a joystick casting a ray from a selected tile to a preview tile. */
export function Nav2DIcon() {
  return (
    <Svg>
      {/* candidate targets */}
      <rect x="96" y="24" width="34" height="24" rx="5" stroke={DIM} strokeWidth="2" />
      <rect x="150" y="86" width="34" height="24" rx="5" stroke={DIM} strokeWidth="2" />
      {/* selected (ray origin) */}
      <rect x="30" y="82" width="34" height="24" rx="5" stroke={CY} strokeWidth="2.5" fill={CY} fillOpacity="0.14" />
      {/* the 2-D ray */}
      <line x1="47" y1="94" x2="167" y2="52" stroke={CY} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" opacity="0.85" />
      {/* preview target, pulsing */}
      <g transform="translate(150 40)">
        <rect className="a-ring" x="0" y="0" width="34" height="24" rx="5" stroke="var(--safelight, #f5a623)" strokeWidth="2.5" fill="var(--safelight, #f5a623)" fillOpacity="0.16" />
      </g>
      {/* invisible joystick at the press point */}
      <circle cx="47" cy="94" r="17" stroke={DIM} strokeWidth="1.5" opacity="0.5" />
      <circle className="a-joy" cx="47" cy="94" r="7" fill={CY} />
    </Svg>
  );
}

/** Changelog — a version log with a pulsing "new release" mark. */
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
        <circle className="a-pulse" r="12" fill={CY} fillOpacity="0.18" />
        <circle r="6" fill={CY} />
        <path d="M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1 Z" fill="var(--ink-950)" />
      </g>
    </Svg>
  );
}

/** ProgressiveText — text lines with a growing typed run and a blinking caret. */
export function ProgressiveTextIcon() {
  return (
    <Svg>
      <rect x="52" y="34" width="116" height="8" rx="4" fill={CY} fillOpacity="0.5" />
      <rect x="52" y="56" width="92" height="8" rx="4" fill={CY} fillOpacity="0.42" />
      <rect className="a-type" x="52" y="78" width="4" height="8" rx="4" fill={CY} />
      <line className="a-caret" x1="146" y1="74" x2="146" y2="90" stroke={CY} strokeWidth="2.5" />
    </Svg>
  );
}

/** ProgressiveList — rows that stagger into view one after another. */
/** ProgressiveTable — a header bar, then grid rows revealing one by one. */
export function ProgressiveTableIcon() {
  const cols = [46, 96, 146]; // x of each of 3 cells
  const w = 44;
  const bodyYs = [52, 74, 96];
  return (
    <Svg>
      {/* header row — appears first */}
      {cols.map((x, c) => (
        <rect
          key={`h${x}`}
          className="a-reveal"
          style={{ animationDelay: `${c * 0.06}s` }}
          x={x}
          y="28"
          width={w}
          height="15"
          rx="3"
          fill={CY}
          fillOpacity="0.55"
        />
      ))}
      {/* body cells — staggered per row */}
      {bodyYs.map((y, r) =>
        cols.map((x, c) => (
          <rect
            key={`${x}-${y}`}
            className="a-reveal"
            style={{ animationDelay: `${0.28 + r * 0.28 + c * 0.05}s` }}
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

/** RichInput — a composer with chips, a blinking caret and a send button. */
export function RichInputIcon() {
  return (
    <Svg>
      <rect className="a-ring" x="30" y="24" width="160" height="82" rx="12" stroke={CY} strokeWidth="2.5" />
      <rect x="44" y="38" width="70" height="6" rx="3" fill={DIM} opacity="0.6" />
      <line className="a-caret" x1="120" y1="35" x2="120" y2="49" stroke={CY} strokeWidth="2" />
      {/* toggle chips */}
      <rect x="44" y="80" width="34" height="14" rx="7" fill={CY} fillOpacity="0.16" stroke={CY} strokeWidth="1.5" />
      <rect x="84" y="80" width="30" height="14" rx="7" stroke={DIM} strokeWidth="1.5" />
      <rect x="120" y="80" width="24" height="14" rx="7" stroke={DIM} strokeWidth="1.5" />
      {/* send button */}
      <rect className="a-pop" x="158" y="78" width="18" height="18" rx="5" fill={CY} fillOpacity="0.2" stroke={CY} strokeWidth="2" />
      <path d="M162 87 l10 0 M168 83 l4 4 -4 4" stroke={CY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProgressiveListIcon() {
  const ys = [30, 50, 70, 90];
  return (
    <Svg>
      {ys.map((y, i) => (
        <rect
          key={y}
          className="a-reveal"
          style={{ animationDelay: `${i * 0.28}s` }}
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

/** ProgressiveBash — a terminal typing a command after a prompt, with a caret. */
export function ProgressiveBashIcon() {
  return (
    <Svg>
      {/* terminal window */}
      <rect x="40" y="22" width="140" height="86" rx="8" stroke={DIM} strokeWidth="2" />
      {/* title bar + traffic lights */}
      <line x1="40" y1="38" x2="180" y2="38" stroke={DIM} strokeWidth="1.5" opacity="0.5" />
      <circle cx="52" cy="30" r="3" fill={CY} opacity="0.7" />
      <circle cx="63" cy="30" r="3" fill={DIM} opacity="0.5" />
      <circle cx="74" cy="30" r="3" fill={DIM} opacity="0.5" />
      {/* prompt glyph */}
      <path d="M54 52 l7 6 l-7 6" stroke={CY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* typed command — grows */}
      <rect className="a-type" x="70" y="52" width="4" height="10" rx="2" fill={CY} fillOpacity="0.75" />
      {/* blinking caret */}
      <line className="a-caret" x1="152" y1="50" x2="152" y2="64" stroke={CY} strokeWidth="2.5" />
      {/* revealed output lines */}
      <rect x="54" y="76" width="96" height="6" rx="3" fill={DIM} opacity="0.45" />
      <rect x="54" y="90" width="70" height="6" rx="3" fill={DIM} opacity="0.3" />
    </Svg>
  );
}

/** FloatingPanel — a floating window offset over a dashed dock outline. */
export function FloatingPanelIcon() {
  return (
    <Svg>
      {/* dashed dock outline underneath */}
      <rect x="46" y="56" width="128" height="54" rx="8" stroke={DIM} strokeWidth="2" strokeDasharray="5 5" opacity="0.55" />
      {/* floating panel, offset up-left */}
      <g className="a-pop">
        <rect x="62" y="24" width="104" height="66" rx="8" fill="var(--ink-950)" fillOpacity="0.5" stroke={CY} strokeWidth="2.5" />
        {/* header bar */}
        <path d="M62 40 h104" stroke={CY} strokeWidth="1.5" opacity="0.7" />
        <rect x="72" y="30" width="30" height="6" rx="3" fill={CY} opacity="0.8" />
        {/* dock/close dots */}
        <circle cx="152" cy="33" r="3" fill={CY} opacity="0.7" />
        {/* body content */}
        <rect x="72" y="50" width="68" height="5" rx="2.5" fill={DIM} opacity="0.5" />
        <rect x="72" y="62" width="82" height="5" rx="2.5" fill={DIM} opacity="0.4" />
        <rect x="72" y="74" width="50" height="5" rx="2.5" fill={DIM} opacity="0.3" />
      </g>
    </Svg>
  );
}
