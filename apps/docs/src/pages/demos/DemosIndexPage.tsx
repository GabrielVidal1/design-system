import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/*
 * /demos — the proof pages. Each card opens a full-screen app built only from
 * @gabvdl/ui, imitating one of the lab's real service frontends. The card art
 * speaks the same animated-SVG language as the component catalogue
 * (three tones, one shared easing — see icons.tsx).
 */

const VB = '0 0 220 130';
const CY = 'var(--cyan)';
const DIM = 'var(--cyan-deep)';
const v = (o: Record<string, string>) => o as CSSProperties;

function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={VB} className="anim-svg h-full w-full" fill="none" role="img" aria-hidden>
      {children}
    </svg>
  );
}

/** Chat — bubbles land on both sides while the composer types. */
function ChatArt() {
  return (
    <Art>
      <rect x="40" y="22" width="140" height="86" rx="9" stroke={DIM} strokeWidth="2" />
      <line x1="66" y1="22" x2="66" y2="108" stroke={DIM} strokeWidth="1.5" opacity="0.5" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="46" y={30 + i * 13} width="14" height="7" rx="2" fill={DIM} opacity={i === 1 ? 0.8 : 0.35} />
      ))}
      <g className="a-reveal" style={v({ '--dur': '5s' })}>
        <rect x="76" y="32" width="66" height="14" rx="7" fill={DIM} opacity="0.4" />
      </g>
      <g className="a-reveal" style={v({ '--dur': '5s', animationDelay: '0.6s' })}>
        <rect x="108" y="52" width="62" height="14" rx="7" fill={CY} fillOpacity="0.7" />
      </g>
      <g className="a-reveal" style={v({ '--dur': '5s', animationDelay: '1.2s' })}>
        <rect x="76" y="72" width="82" height="14" rx="7" fill={DIM} opacity="0.4" />
      </g>
      <rect x="76" y="94" width="94" height="10" rx="5" stroke={CY} strokeWidth="1.6" />
      <rect className="a-grow" style={v({ '--g0': '0.1', '--dur': '5s' })} x="80" y="97" width="60" height="4" rx="2" fill={CY} opacity="0.8" />
    </Art>
  );
}

/** Command palette — the scrim lifts, results re-rank under the query. */
function SearchArt() {
  return (
    <Art>
      <rect x="40" y="22" width="140" height="86" rx="9" stroke={DIM} strokeWidth="2" opacity="0.35" />
      <g className="a-breathe" style={v({ '--s': '1.03', '--dur': '4.6s' })}>
        <rect x="60" y="34" width="100" height="62" rx="8" fill="var(--surface-2)" stroke={CY} strokeWidth="2" />
        <rect x="68" y="42" width="52" height="7" rx="3.5" fill={CY} opacity="0.8" />
        <line className="a-blink" x1="124" y1="41" x2="124" y2="50" stroke={CY} strokeWidth="2" />
        <rect x="140" y="42" width="12" height="7" rx="2" stroke={DIM} strokeWidth="1.4" />
        {[0, 1, 2].map((i) => (
          <g key={i} className="a-reveal" style={v({ '--dur': '4.6s', animationDelay: `${0.3 + i * 0.25}s` })}>
            <rect x="68" y={56 + i * 12} width={i === 0 ? 84 : 64 - i * 8} height="6" rx="3" fill={i === 0 ? CY : DIM} opacity={i === 0 ? 0.65 : 0.4} />
          </g>
        ))}
      </g>
    </Art>
  );
}

/** Job queue — rows tick down the lifecycle while one bar fills. */
function JobsArt() {
  return (
    <Art>
      {[0, 1, 2].map((i) => (
        <rect key={i} x="42" y={26 + i * 20} width="112" height="12" rx="4" stroke={DIM} strokeWidth="1.6" opacity="0.5" />
      ))}
      <circle className="a-blink" cx="164" cy="32" r="4" fill={CY} />
      <circle cx="164" cy="52" r="4" stroke={DIM} strokeWidth="1.6" />
      <circle cx="164" cy="72" r="4" stroke={DIM} strokeWidth="1.6" />
      <rect x="42" y="88" width="136" height="10" rx="5" stroke={CY} strokeWidth="1.8" />
      <rect className="a-grow" style={v({ '--g0': '0.08', '--dur': '4.4s' })} x="46" y="91" width="128" height="4" rx="2" fill={CY} />
      {/* terminal cursor for the log pane */}
      <rect x="42" y="106" width="60" height="4" rx="2" fill={DIM} opacity="0.4" />
      <line className="a-blink" x1="108" y1="103" x2="108" y2="110" stroke={CY} strokeWidth="2" />
    </Art>
  );
}

interface DemoCard {
  to: string;
  name: string;
  blurb: string;
  /** The receipt: which library pieces this screen is assembled from. */
  proves: string;
  Art: () => ReactNode;
}

const DEMOS: DemoCard[] = [
  {
    to: '/demos/chat',
    name: 'Agent console',
    blurb:
      'The ai-agent screen: conversations on the left, run details on the right, a streaming reply in the middle, and the batteries-included composer underneath.',
    proves: 'ResizableLayout · RichInput · ProgressiveText · StatusBadge · RelativeTime',
    Art: ChatArt,
  },
  {
    to: '/demos/search',
    name: 'Switchboard',
    blurb:
      'One palette over the whole lab — services, projects, boxes, actions. ⌘K or tap; every result is reachable by keys alone, and by thumb alone.',
    proves: 'GlobalSearch · FuzzyList · Badge · Toast',
    Art: SearchArt,
  },
  {
    to: '/demos/jobs',
    name: 'Render queue',
    blurb:
      'A 3d-gen-style service frontend: KPI strip, a live sortable queue, per-job progress, and a terminal replaying each job\'s logs as it runs.',
    proves: 'StatTile · DataTable · Progress · ProgressiveBash · StatusBadge',
    Art: JobsArt,
  },
];

export function DemosIndexPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Demos — gabvdl/ui';
    return () => {
      document.title = 'gabvdl/ui';
    };
  }, []);

  return (
    <>
      <section className="mb-10">
        <p className="eyebrow mb-3">Full-page demos</p>
        <h1 className="display max-w-2xl text-3xl leading-tight text-foreground sm:text-4xl">
          The pieces, composed into real screens.
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          A component isn't done until it survives contact with an actual app. Each demo below is a
          full-screen replica of a screen the lab really runs — built from <span className="mono text-sm">@gabvdl/ui</span>{' '}
          alone, phone-first, no one-off primitives. The caption under each card is the bill of materials.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map(({ to, name, blurb, proves, Art }) => (
          <Link key={to} to={to} className="comp-card group block text-left" aria-label={`Open the ${name} demo`}>
            <div className="comp-card__art">
              <Art />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="mono text-sm text-foreground">{name}</span>
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--cyan-deep)]">
                  demo
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{blurb}</p>
              <p className="mono mt-3 border-t border-border pt-2.5 text-[10.5px] leading-relaxed text-[color:var(--cyan-deep)]">
                {proves}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
