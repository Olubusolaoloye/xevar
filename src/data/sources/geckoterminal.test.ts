import { describe, expect, it } from 'vitest';
import { mapOhlcvRows } from './geckoterminal';

/** [unix seconds, open, high, low, close, volume] — the wire shape. */
const RISING: number[][] = [
  [1_757_000_000, 0.000042, 0.0000431, 0.0000418, 0.0000429, 12_000],
  [1_757_003_600, 0.0000429, 0.000044, 0.0000427, 0.0000438, 15_000],
  [1_757_007_200, 0.0000438, 0.0000452, 0.0000436, 0.0000449, 18_000],
];

/** The bucket GeckoTerminal emits for a period nothing traded in. */
const EMPTY_BUCKET: number[] = [1_757_010_800, 0, 0, 0, 0, 0];

describe('mapOhlcvRows', () => {
  it('converts seconds to milliseconds', () => {
    expect(mapOhlcvRows([RISING[0]])[0].time).toBe(1_757_000_000_000);
  });

  it('sorts oldest first whatever order the API returns', () => {
    const shuffled = [RISING[2], RISING[0], RISING[1]];
    const times = mapOhlcvRows(shuffled).map((c) => c.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('drops an empty bucket rather than plotting a zero price', () => {
    // The regression. A zero close is finite, so it used to survive: the line
    // fell off a cliff at the right edge and the chart went red on a pair that
    // had actually risen.
    const candles = mapOhlcvRows([...RISING, EMPTY_BUCKET]);

    expect(candles).toHaveLength(3);
    expect(candles.every((c) => c.close > 0)).toBe(true);
  });

  it('leaves the direction of a rising series intact', () => {
    const candles = mapOhlcvRows([...RISING, EMPTY_BUCKET]);
    const rising = candles[candles.length - 1].close >= candles[0].close;
    expect(rising).toBe(true);
  });

  it('keeps the y-axis domain off zero', () => {
    const closes = mapOhlcvRows([...RISING, EMPTY_BUCKET]).map((c) => c.close);
    // dataMin drove the axis to 0, flattening the real variation to a sliver.
    expect(Math.min(...closes)).toBeGreaterThan(0);
  });

  it('discards rows with an unusable timestamp or close', () => {
    const rows = [
      [Number.NaN, 1, 1, 1, 1, 1],
      [1_757_000_000, 1, 1, 1, Number.NaN, 1],
      [1_757_003_600, 1, 1, 1, -5, 1],
      RISING[0],
    ];
    expect(mapOhlcvRows(rows)).toHaveLength(1);
  });

  it('returns nothing for an empty list', () => {
    expect(mapOhlcvRows([])).toEqual([]);
  });
});
