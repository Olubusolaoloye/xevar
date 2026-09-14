import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Override the auto-derived colour (which follows the series direction). */
  tone?: 'up' | 'down' | 'brand';
  /** Fill the area beneath the line with a fading gradient. */
  filled?: boolean;
  strokeWidth?: number;
}

const TONE_COLOR = {
  up: 'var(--color-up)',
  down: 'var(--color-down)',
  brand: 'var(--color-brand-500)',
} as const;

export interface SparklineGeometry {
  linePath: string;
  areaPath: string;
  /** Number of points that survived the finite filter. */
  plotted: number;
}

/**
 * Turn a series into SVG path data.
 *
 * Exported for tests: this is where a bad datum used to become an invisible
 * chart, and where a motionless price used to look like a crash.
 */
export function sparklineGeometry(
  data: readonly number[],
  width: number,
  height: number,
  strokeWidth: number,
): SparklineGeometry {
  // Drop anything that cannot be placed on an axis. A single Infinity or NaN
  // poisons min/max, turns every coordinate into NaN, and the browser discards
  // the whole path — the chart vanishes with no error anywhere.
  const points = data.filter((value) => Number.isFinite(value));
  if (points.length < 2) return { linePath: '', areaPath: '', plotted: points.length };

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;
  // Inset vertically so the stroke is never clipped by the viewBox edge.
  const padY = strokeWidth;
  const usableH = Math.max(0, height - padY * 2);

  // A flat series has no meaningful vertical position, so centre it. The
  // previous `max - min || 1` pinned every point to the bottom edge, which
  // read as a broken chart rather than as "this price has not moved".
  const yFor = (value: number) =>
    range === 0 ? padY + usableH / 2 : padY + (1 - (value - min) / range) * usableH;

  const stepX = width / (points.length - 1);

  const linePath = points
    .map((value, i) => {
      const x = i * stepX;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${yFor(value).toFixed(2)}`;
    })
    .join(' ');

  return {
    linePath,
    areaPath: `${linePath} L${width},${height} L0,${height} Z`,
    plotted: points.length,
  };
}

/**
 * A dependency-free inline trend line.
 *
 * Recharts is excellent for the full-size charts but far too heavy to mount
 * 160 times in a table — one `<svg>` per row keeps scrolling smooth.
 */
export function Sparkline({
  data,
  width = 88,
  height = 28,
  className,
  tone,
  filled = true,
  strokeWidth = 1.5,
}: SparklineProps) {
  const gradientId = useId();

  const { linePath, areaPath, color } = useMemo(() => {
    const { linePath: line, areaPath: area, plotted } = sparklineGeometry(
      data,
      width,
      height,
      strokeWidth,
    );
    if (!line) return { linePath: '', areaPath: '', color: TONE_COLOR.brand };

    const finite = data.filter((value) => Number.isFinite(value));
    const resolved = tone ?? (finite[plotted - 1] >= finite[0] ? 'up' : 'down');

    return { linePath: line, areaPath: area, color: TONE_COLOR[resolved] };
  }, [data, width, height, tone, strokeWidth]);

  if (!linePath) return <div style={{ width, height }} className={className} />;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
