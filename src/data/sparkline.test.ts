import { describe, expect, it } from 'vitest';
import {
  extendSparkline,
  impliedOpeningPrice,
  SPARKLINE_MAX_POINTS,
} from './sparkline';
import { sparklineGeometry } from '@/components/ui/Sparkline';

/** Vertical spread of a series, as a percentage of its low. */
function rangePct(series: number[]): number {
  const min = Math.min(...series);
  const max = Math.max(...series);
  return ((max - min) / min) * 100;
}

describe('impliedOpeningPrice', () => {
  it('inverts the 24h change', () => {
    expect(impliedOpeningPrice(108, 8)).toBeCloseTo(100, 6);
    expect(impliedOpeningPrice(50, -50)).toBeCloseTo(100, 6);
  });

  it('refuses a -100% change rather than returning Infinity', () => {
    // 1 + (-100/100) === 0. Dividing by it produced Infinity, which poisoned
    // every coordinate in the path and made the chart disappear.
    expect(impliedOpeningPrice(0.001, -100)).toBeNull();
  });

  it('refuses a change that rounds the divisor to almost zero', () => {
    expect(impliedOpeningPrice(0.001, -99.999)).toBeNull();
  });

  it('refuses unusable prices and changes', () => {
    expect(impliedOpeningPrice(Number.NaN, 5)).toBeNull();
    expect(impliedOpeningPrice(0, 5)).toBeNull();
    expect(impliedOpeningPrice(-1, 5)).toBeNull();
    expect(impliedOpeningPrice(2, Number.NaN)).toBeNull();
  });
});

describe('extendSparkline', () => {
  /** A token up 8% on the day, drifting a fraction of a percent per poll. */
  function poll(times: number) {
    let observed: number[] = [];
    let price = 0.00004212;
    let last = { observed, sparkline: [] as number[] };

    for (let i = 0; i < times; i++) {
      price *= 1 + (i % 2 ? 0.0004 : -0.0003);
      last = extendSparkline(observed, price, 8);
      observed = last.observed;
    }
    return last;
  }

  it('keeps the full 24h range however long the session runs', () => {
    // The regression: after three polls the anchor was dropped and the series
    // became observed-only, collapsing the range from ~8% to ~0.04% — a flat
    // line within a minute of opening the board.
    expect(rangePct(poll(2).sparkline)).toBeGreaterThan(7);
    expect(rangePct(poll(3).sparkline)).toBeGreaterThan(7);
    expect(rangePct(poll(30).sparkline)).toBeGreaterThan(7);
  });

  it('returns a new array each poll so the chart is not frozen', () => {
    // The stored array used to be mutated in place, so every Pair carried the
    // same reference and the memo in <Sparkline> never recomputed.
    const first = extendSparkline([], 10, 8);
    const second = extendSparkline(first.observed, 11, 8);

    expect(second.observed).not.toBe(first.observed);
    expect(second.sparkline).not.toBe(first.sparkline);
    expect(first.observed).toEqual([10]); // the earlier array is untouched
  });

  it('grows by one observed point per poll', () => {
    expect(poll(1).sparkline).toHaveLength(2); // anchor + 1
    expect(poll(5).sparkline).toHaveLength(6);
  });

  it('caps the window so a long session cannot grow without bound', () => {
    const { sparkline, observed } = poll(500);
    expect(sparkline).toHaveLength(SPARKLINE_MAX_POINTS);
    expect(observed).toHaveLength(SPARKLINE_MAX_POINTS - 1);
  });

  it('drops an unusable price instead of recording it', () => {
    const { observed } = extendSparkline([1, 2], Number.NaN, 8);
    expect(observed).toEqual([1, 2]);
  });

  it('never emits a non-finite point, whatever it is fed', () => {
    for (const [price, change] of [
      [0.001, -100],
      [Number.NaN, 5],
      [0, 5],
      [2, Number.NaN],
      [1e-12, -99.9999],
    ] as const) {
      const { sparkline } = extendSparkline([0.5], price, change);
      expect(sparkline.every(Number.isFinite)).toBe(true);
    }
  });
});

describe('sparklineGeometry', () => {
  const W = 88;
  const H = 28;
  const SW = 1.5;

  it('centres a flat series rather than pinning it to the bottom', () => {
    const { linePath } = sparklineGeometry([5, 5, 5], W, H, SW);
    const ys = [...linePath.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));

    expect(ys).toHaveLength(3);
    for (const y of ys) expect(y).toBeCloseTo(H / 2, 6);
  });

  it('filters non-finite points instead of emitting NaN coordinates', () => {
    const { linePath, plotted } = sparklineGeometry(
      [1, Number.NaN, Number.POSITIVE_INFINITY, 3],
      W,
      H,
      SW,
    );
    expect(plotted).toBe(2);
    expect(linePath).not.toContain('NaN');
    expect(linePath).not.toContain('Infinity');
  });

  it('renders nothing when too few points survive', () => {
    expect(sparklineGeometry([Number.NaN, Number.POSITIVE_INFINITY], W, H, SW).linePath).toBe('');
    expect(sparklineGeometry([7], W, H, SW).linePath).toBe('');
    expect(sparklineGeometry([], W, H, SW).linePath).toBe('');
  });

  it('keeps every coordinate inside the viewBox', () => {
    const { linePath } = sparklineGeometry([1, 9, 3, 7], W, H, SW);
    const coords = [...linePath.matchAll(/[ML]([\d.]+),([\d.]+)/g)];

    for (const [, x, y] of coords) {
      expect(Number(x)).toBeGreaterThanOrEqual(0);
      expect(Number(x)).toBeLessThanOrEqual(W);
      expect(Number(y)).toBeGreaterThanOrEqual(SW);
      expect(Number(y)).toBeLessThanOrEqual(H - SW);
    }
  });
});
