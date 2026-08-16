import * as React from 'react';

import { cn } from '../../lib/utils';
import type { Tone } from '../status-badge';

/*
 * Tones are written out in full — Tailwind scans source text, so a template
 * literal like `stroke-${tone}-500` would compile to nothing.
 */
const STROKE_TONES: Record<Tone, string> = {
  neutral: 'stroke-foreground/70',
  sky: 'stroke-sky-500',
  emerald: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  rose: 'stroke-rose-500',
  violet: 'stroke-violet-500',
};

const SOLID_TONES: Record<Tone, string> = {
  neutral: 'fill-foreground/70',
  sky: 'fill-sky-500',
  emerald: 'fill-emerald-500',
  amber: 'fill-amber-500',
  rose: 'fill-rose-500',
  violet: 'fill-violet-500',
};

const AREA_TONES: Record<Tone, string> = {
  neutral: 'fill-foreground/10',
  sky: 'fill-sky-500/15',
  emerald: 'fill-emerald-500/15',
  amber: 'fill-amber-500/15',
  rose: 'fill-rose-500/15',
  violet: 'fill-violet-500/15',
};

export interface SparklineProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, 'width' | 'height' | 'points' | 'fill'> {
  /** The series, oldest first. Fewer than 2 points renders nothing. */
  data: number[];
  /** @default 64 */
  width?: number;
  /** @default 24 */
  height?: number;
  tone?: Tone;
  /** Render as bars instead of a line. @default 'line' */
  variant?: 'line' | 'bar';
  /** Shade the area under the line (`variant="line"` only). @default false */
  fill?: boolean;
  strokeWidth?: number;
  /** Mark the last point with a dot (`variant="line"` only). @default true */
  showLastPoint?: boolean;
}

/**
 * An inline trend indicator sized for a {@link StatTile} or a table cell — no
 * axes, no legend, no tooltip, just the shape of a series. Reads its colour
 * from the shared {@link Tone} scale so it can match a `StatusBadge`/`Progress`
 * elsewhere on the same card. For anything that needs hover detail or an
 * axis, this isn't it — reach for a real charting library instead.
 *
 * @summary Inline trend line or bar chart, no axes/legend — for a StatTile or
 * table cell.
 */
export function Sparkline({
  data,
  width = 64,
  height = 24,
  tone = 'sky',
  variant = 'line',
  fill = false,
  strokeWidth = 1.5,
  showLastPoint = true,
  className,
  ...props
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min;
  const normalize = (v: number) => (span === 0 ? 0.5 : (v - min) / span);

  const svgProps = {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    className: cn('overflow-visible', className),
    role: 'img' as const,
    'aria-hidden': (!props['aria-label'] && !props['aria-labelledby']) || undefined,
    ...props,
  };

  if (variant === 'bar') {
    const gap = Math.min(2, width / data.length / 4);
    const barWidth = Math.max(1, width / data.length - gap);
    return (
      <svg {...svgProps}>
        {data.map((v, i) => {
          const x = (i / data.length) * width + gap / 2;
          const barHeight = Math.max(1, normalize(v) * height);
          return (
            <rect
              key={i}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(1, barWidth / 2)}
              className={SOLID_TONES[tone]}
            />
          );
        })}
      </svg>
    );
  }

  const pad = strokeWidth;
  const innerHeight = height - pad * 2;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + innerHeight - normalize(v) * innerHeight;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg {...svgProps}>
      {fill && (
        <path
          d={`${linePath} L${width},${height} L0,${height} Z`}
          className={AREA_TONES[tone]}
          stroke="none"
        />
      )}
      <path
        d={linePath}
        className={STROKE_TONES[tone]}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLastPoint && (
        <circle cx={lastX} cy={lastY} r={strokeWidth * 1.4} className={SOLID_TONES[tone]} />
      )}
    </svg>
  );
}
