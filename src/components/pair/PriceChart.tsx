import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { formatAxisPrice } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useChartTheme } from '@/hooks/useChartTheme';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { usePairCandles, type FailureReason } from '@/hooks/usePairChart';
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

/**
 * What to say when the chart has nothing to draw.
 *
 * One message for all three failures used to send people to check their wifi
 * over a rate limit, and to wait indefinitely for a pool the provider has
 * simply never indexed. Nothing is drawn in any of these cases — inventing a
 * series is the one thing this app must never do — but the reason a reader is
 * looking at an empty panel is worth being accurate about.
 */
const FAILURE_TEXT: Record<FailureReason, string> = {
  unindexed:
    'No chart for this pool. The price above is live, but the chart provider has not indexed this pool, so there is no history to draw.',
  'rate-limited':
    'Too many chart requests in the last minute. The provider allows about 30; this will come back on its own shortly.',
  unreachable:
    'Could not load price history. The chart provider is unreachable — nothing is drawn rather than guessed.',
};

/** Colour with an alpha channel appended, for the area gradient. */
function withAlpha(color: string, alpha: string): string {
  // Tokens arrive as 6-digit hex (#1dbf63) or 8-digit with alpha baked in.
  // Anything else — a named colour, an rgb() — is returned untouched rather
  // than corrupted by string surgery.
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${alpha}`;
  return color;
}

/**
 * The smallest price step the scale should resolve, for this series.
 *
 * This is load-bearing on a memecoin board. Lightweight Charts quantises the
 * price scale to `minMove`, which defaults to 0.01 — so for a token trading at
 * 0.000000068 every tick rounds to the same value, the scale finds no distinct
 * positions, and it draws no labels at all. The axis comes back empty and the
 * chart looks broken.
 *
 * So the step is derived from the data: four significant figures below the
 * leading digit, which is the precision the rest of the app shows prices to.
 */
function priceStep(values: number[]): { minMove: number; precision: number } {
  const smallest = values.reduce(
    (min, v) => (v > 0 && v < min ? v : min),
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(smallest) || smallest <= 0) return { minMove: 0.01, precision: 2 };

  // 6.8e-8 → exponent -8 → 11 decimal places, a step of 1e-11.
  const exponent = Math.floor(Math.log10(smallest));
  const precision = Math.min(15, Math.max(2, -exponent + 3));
  return { minMove: 10 ** -precision, precision };
}

/**
 * The pair price chart.
 *
 * An area chart rather than candles by choice: at the widths this panel
 * occupies, candles become illegible slivers, while a filled area reads the
 * trend instantly. The gradient and stroke follow the direction of the
 * *visible range*, not the 24h figure, so the colour always matches what is
 * actually on screen.
 *
 * Built on Lightweight Charts rather than a general-purpose charting library:
 * it is purpose-built for price series, so the time axis handles irregular
 * gaps and the price scale handles sub-cent values without being taught how,
 * and it costs about a sixth of the bundle.
 */
export function PriceChart({ pair }: { pair: Pair }) {
  const [range, setRange] = useState<Range>('24h');
  const { priceText, convert, symbol } = useCurrency();
  const theme = useChartTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const spec = RANGE_SPEC[range];
  const { data: candles, loading, failed, reason } = usePairCandles(pair, spec.interval);

  const data = useMemo(() => {
    return candles
      .slice(-spec.bars)
      .map((candle) => ({
        // Lightweight Charts counts in seconds; Candle.time is epoch millis.
        time: Math.floor(candle.time / 1000) as UTCTimestamp,
        value: convert(candle.close),
      }))
      // Lightweight Charts throws on a non-finite value rather than skipping
      // it, and an uncaught throw here takes the whole pair page down with it.
      // One corrupt point is not worth a blank screen, so it is dropped — the
      // same call `mapOhlcvRows` already makes about empty candles.
      .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.time));
  }, [candles, spec.bars, convert]);

  const step = useMemo(() => priceStep(data.map((d) => d.value)), [data]);

  const rising = data.length > 1 && data[data.length - 1].value >= data[0].value;
  const color = rising ? theme.up : theme.down;

  const empty = data.length === 0;

  /* Create the chart once. Options that change — colours, formatters — are
     applied by the effects below rather than by tearing the chart down, so a
     theme switch does not flash an empty panel. */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || empty) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        // The panel behind the canvas already carries the surface colour, and
        // painting it again here would show as a hard rectangle in light mode
        // wherever the two disagree by a shade.
        background: { color: 'transparent' },
        attributionLogo: false,
      },
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [empty]);

  /* Theme and formatting. Re-runs whenever the palette changes — which is what
     makes the canvas follow light/dark, including a mid-session OS switch. */
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    chart.applyOptions({
      layout: { textColor: theme.text },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        // Without this an hourly range labels every tick with the day of the
        // month, so a 24h chart reads "20 20 21 21 21" instead of clock times.
        timeVisible: spec.interval !== 'd1',
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: theme.crosshair,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme.border,
        },
        horzLine: {
          color: theme.crosshair,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme.border,
        },
      },
      localization: {
        priceFormatter: (value: number) => formatAxisPrice(value, symbol),
      },
    });

    series.applyOptions({
      lineColor: color,
      topColor: withAlpha(color, '4d'),
      bottomColor: withAlpha(color, '00'),
      priceFormat: {
        type: 'custom',
        formatter: (v: number) => formatAxisPrice(v, symbol),
        minMove: step.minMove,
      },
    });
  }, [theme, color, symbol, step, spec.interval]);

  /* The data itself. */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || empty) return;
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data, empty]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
          Price
        </p>
        <SegmentedControl<Range>
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          size="sm"
        />
      </div>

      <div className="h-[300px] p-2 sm:h-[380px]">
        {loading && empty ? (
          <Skeleton className="h-full w-full" />
        ) : empty ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-ink-low">
            {failed ? FAILURE_TEXT[reason ?? 'unreachable'] : 'No price history for this pool yet.'}
          </div>
        ) : (
          <div
            ref={containerRef}
            className="h-full w-full"
            role="img"
            aria-label={`${pair.baseToken.symbol} price over ${range}, currently ${priceText(
              pair.priceUsd,
            )}`}
          />
        )}
      </div>
    </div>
  );
}
