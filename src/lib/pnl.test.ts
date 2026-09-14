import { describe, expect, it } from 'vitest';
import {
  blendPositions,
  evaluatePosition,
  projectAtMarketCap,
  projectTargets,
} from './pnl';

describe('evaluatePosition', () => {
  it('computes cost, value and return for a winning position', () => {
    const result = evaluatePosition({
      amount: 250_000_000_000,
      entryPriceUsd: 2e-9,
      currentPriceUsd: 3.2568e-8,
    });

    expect(result.costUsd).toBeCloseTo(500, 6);
    expect(result.valueUsd).toBeCloseTo(8142, 0);
    expect(result.pnlUsd).toBeCloseTo(7642, 0);
    expect(result.pnlPct).toBeCloseTo(1528.4, 0);
    expect(result.multiple).toBeCloseTo(16.284, 2);
  });

  it('reports a loss as a negative, not an absolute', () => {
    const result = evaluatePosition({
      amount: 100,
      entryPriceUsd: 10,
      currentPriceUsd: 4,
    });

    expect(result.pnlUsd).toBe(-600);
    expect(result.pnlPct).toBe(-60);
    expect(result.multiple).toBeCloseTo(0.4, 6);
  });

  it('does not divide by zero on a zero-cost position', () => {
    // An airdrop has infinite return; NaN or Infinity must never reach the UI.
    const result = evaluatePosition({
      amount: 1000,
      entryPriceUsd: 0,
      currentPriceUsd: 5,
    });

    expect(Number.isFinite(result.pnlPct)).toBe(true);
    expect(result.pnlPct).toBe(0);
    expect(result.multiple).toBe(0);
  });
});

describe('blendPositions', () => {
  it('weights the average entry by cost, not by a mean of the prices', () => {
    // A naive mean of 1 and 2 would be 1.5. The correct cost-weighted answer
    // is dominated by the much larger second buy.
    const blended = blendPositions(
      [
        { amount: 10, entryPriceUsd: 1 },
        { amount: 1000, entryPriceUsd: 2 },
      ],
      3,
    );

    expect(blended.amount).toBe(1010);
    expect(blended.costUsd).toBe(2010);
    expect(blended.averageEntryUsd).toBeCloseTo(1.9901, 4);
    expect(blended.averageEntryUsd).not.toBeCloseTo(1.5, 2);
    expect(blended.valueUsd).toBe(3030);
    expect(blended.pnlUsd).toBe(1020);
  });

  it('handles a single entry identically to evaluating it directly', () => {
    const blended = blendPositions([{ amount: 50, entryPriceUsd: 4 }], 6);
    const direct = evaluatePosition({ amount: 50, entryPriceUsd: 4, currentPriceUsd: 6 });

    expect(blended.costUsd).toBe(direct.costUsd);
    expect(blended.valueUsd).toBe(direct.valueUsd);
    expect(blended.pnlPct).toBeCloseTo(direct.pnlPct, 10);
  });

  it('returns zeroes rather than NaN for an empty set', () => {
    const blended = blendPositions([], 10);
    expect(blended.amount).toBe(0);
    expect(Number.isFinite(blended.pnlPct)).toBe(true);
    expect(Number.isFinite(blended.averageEntryUsd)).toBe(true);
  });
});

describe('projectTargets', () => {
  const input = {
    investmentUsd: 1000,
    entryPriceUsd: 1,
    currentPriceUsd: 1,
    currentMarketCapUsd: 10_000_000,
  };

  it('scales price, market cap and value together', () => {
    const rows = projectTargets(input, [2, 10]);

    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe('2x');
    expect(rows[0].priceUsd).toBe(2);
    expect(rows[0].marketCapUsd).toBe(20_000_000);
    expect(rows[0].valueUsd).toBe(2000);
    expect(rows[0].pnlPct).toBe(100);

    expect(rows[1].valueUsd).toBe(10_000);
    expect(rows[1].pnlUsd).toBe(9000);
  });

  it('measures multiples from the current price, not the entry', () => {
    // Someone already up 5x asking "what if it 2x's" means 2x from here.
    const rows = projectTargets({ ...input, entryPriceUsd: 0.2 }, [2]);
    expect(rows[0].priceUsd).toBe(2);
    // 1000 at 0.2 buys 5000 tokens; at $2 that is $10,000.
    expect(rows[0].valueUsd).toBe(10_000);
  });

  it('returns nothing when the inputs are incomplete', () => {
    expect(projectTargets({ ...input, investmentUsd: 0 })).toEqual([]);
    expect(projectTargets({ ...input, entryPriceUsd: 0 })).toEqual([]);
  });
});

describe('projectAtMarketCap', () => {
  it('values a bag at an explicit market cap target', () => {
    const row = projectAtMarketCap(
      {
        investmentUsd: 1000,
        entryPriceUsd: 0.5,
        currentPriceUsd: 1,
        currentMarketCapUsd: 10_000_000,
      },
      50_000_000,
    )!;

    // 5x the market cap is 5x the price, so $5 a token.
    expect(row.priceUsd).toBe(5);
    // 1000 at 0.5 buys 2000 tokens; at $5 that is $10,000.
    expect(row.valueUsd).toBe(10_000);
    expect(row.pnlUsd).toBe(9000);
    expect(row.pnlPct).toBe(900);
  });

  it('returns null when the current market cap is unknown', () => {
    const row = projectAtMarketCap(
      {
        investmentUsd: 1000,
        entryPriceUsd: 1,
        currentPriceUsd: 1,
        currentMarketCapUsd: 0,
      },
      1_000_000,
    );
    expect(row).toBeNull();
  });
});
