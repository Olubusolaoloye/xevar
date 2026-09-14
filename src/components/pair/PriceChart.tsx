import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisPrice, formatCompact } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { usePairCandles } from '@/hooks/usePairChart';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CandleInterval } from '@/data/sources/geckoterminal';
import type { Pair } from '@/data/types';

type Range = '1h' | '6h' | '24h' | '7d' | 'all';

const RANGE_OPTIONS = [
  { value: '1h' as Range, label: '1H' },
  { value: '6h' as Range, label: '6H' },
  { value: '24h' as Range, label: '24H' },
  { value: '7d' as Range, label: '7D' },
  { value: 'all' as Range, label: 'ALL' },
];

/**
 * Each range picks the candle interval that gives it a useful number of bars —
 * five-minute candles over a day would be 288 slivers, daily candles over an
 * hour would be one.
 */
const RANGE_SPEC: Record<Range, { interval: CandleInterval; bars: number }> = {
  '1h': { interval: 'm5', bars: 12 },
  '6h': { interval: 'm15', bars: 24 },
  '24h': { interval: 'h1', bars: 24 },
  '7d': { interval: 'h4', bars: 42 },
  all: { interval: 'd1', bars: 180 },
};

function ChartTooltip({
  active,
  payload,
  priceText,
}: {
  active?: boolean;
  payload?: Array<{ payload: { time: number; close: number; volume: number } }>;
  priceText: (usd: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-md border border-line-strong bg-overlay px-3 py-2 shadow-popover">
      <p className="text-[10px] uppercase tracking-wider text-ink-low">
        {new Date(point.time).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <p className="tnum mt-1 font-mono text-sm font-semibold text-ink">
        {priceText(point.close)}
      </p>
      <p className="tnum font-mono text-[11px] text-ink-low">
        Vol {formatCompact(point.volume, '$')}
      </p>
    </div>
  );
}

/**
 * The pair price chart.
 *
 * An area chart rather than candles by choice: at the widths this panel
 * occupies, candles become illegible slivers, while a filled area reads the
 * trend instantly. The gradient and stroke follow the direction of the
 * *visible range*, not the 24h figure, so the colour always matches what is
 * actually on screen.
 */
export function PriceChart({ pair }: { pair: Pair }) {
  const [range, setRange] = useState<Range>('24h');
  const { priceText, convert, symbol } = useCurrency();

  const spec = RANGE_SPEC[range];
  const { data: candles, loading, simulated } = usePairCandles(pair, spec.interval);
  const data = useMemo(() => candles.slice(-spec.bars), [candles, spec.bars]);

  const rising = data.length > 1 && data[data.length - 1].close >= data[0].close;
  const color = rising ? 'var(--color-up)' : 'var(--color-down)';

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
          Price
          {simulated && (
            <span className="rounded-xs bg-accent-500/12 px-1 py-0.5 text-accent-500 normal-case tracking-normal">
              sample history
            </span>
          )}
        </p>
        <SegmentedControl<Range>
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          size="sm"
        />
      </div>

      <div className="h-[300px] p-2 sm:h-[380px]">
        {loading && data.length === 0 ? (
          <Skeleton className="h-full w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-ink-low">
            No price history for this pool yet.
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--grid-line)" vertical={false} />

            <XAxis
              dataKey="time"
              tickFormatter={(time: number) =>
                new Date(time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }
              tick={{ fill: 'var(--color-ink-dim)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
            />

            <YAxis
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) => formatAxisPrice(convert(value), symbol)}
              tick={{ fill: 'var(--color-ink-dim)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={62}
              orientation="right"
            />

            <Tooltip
              content={<ChartTooltip priceText={priceText} />}
              cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }}
            />

            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={1.75}
              fill="url(#priceFill)"
              // Animating 160 points on every currency or range change is
              // distracting rather than delightful.
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
