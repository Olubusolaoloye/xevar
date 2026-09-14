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
    if (data.length < 2) {
      return { linePath: '', areaPath: '', color: TONE_COLOR.brand };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    // A perfectly flat series would divide by zero; draw it down the middle.
    const span = max - min || 1;
    const stepX = width / (data.length - 1);
    // Inset vertically so the stroke is never clipped by the viewBox edge.
    const padY = strokeWidth;

    const points = data.map((value, i) => {
      const x = i * stepX;
      const y = padY + (1 - (value - min) / span) * (height - padY * 2);
      return [x, y] as const;
    });

    const line = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');

    const area = `${line} L${width},${height} L0,${height} Z`;

    const resolved =
      tone ?? (data[data.length - 1] >= data[0] ? 'up' : 'down');

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
