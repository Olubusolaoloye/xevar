import { describe, expect, it } from 'vitest';
import {
  conditionSatisfied,
  evaluateAlert,
  metricReported,
  readMetricValue,
  type AlertReadable,
  type EvaluableAlert,
} from './alertRules';

const pair = (over: Partial<AlertReadable> = {}): AlertReadable => ({
  priceUsd: 1,
  marketCap: 1_000_000,
  liquidityUsd: 50_000,
  change: { h24: 0 },
  volume: { h24: 10_000 },
  ...over,
});

const alert = (over: Partial<EvaluableAlert> = {}): EvaluableAlert => ({
  enabled: true,
  metric: 'price',
  comparator: 'above',
  threshold: 10,
  conditionMet: false,
  ...over,
});

describe('readMetricValue', () => {
  it('reads each metric off the pair', () => {
    const p = pair({ priceUsd: 2, marketCap: 3, liquidityUsd: 4, change: { h24: 5 }, volume: { h24: 6 } });
    expect(readMetricValue(p, 'price')).toBe(2);
    expect(readMetricValue(p, 'marketCap')).toBe(3);
    expect(readMetricValue(p, 'liquidity')).toBe(4);
    expect(readMetricValue(p, 'change24h')).toBe(5);
    expect(readMetricValue(p, 'volume24h')).toBe(6);
  });
});

describe('metricReported', () => {
  it('treats zero price and zero market cap as missing, not as a reading', () => {
    /* The provider sends 0 when it has neither a market cap nor an FDV. A
       "market cap below 5,000,000" alert would otherwise fire on every token
       it happens to have no figure for. */
    expect(metricReported('price', 0)).toBe(false);
    expect(metricReported('marketCap', 0)).toBe(false);
  });

  it('treats zero liquidity, volume and change as real readings', () => {
    // Zero liquidity is a drained pool and zero volume is a day with no
    // trades. An alert watching for either is watching for exactly that.
    expect(metricReported('liquidity', 0)).toBe(true);
    expect(metricReported('volume24h', 0)).toBe(true);
    expect(metricReported('change24h', 0)).toBe(true);
  });

  it('rejects anything not finite', () => {
    expect(metricReported('liquidity', Number.NaN)).toBe(false);
    expect(metricReported('volume24h', Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('conditionSatisfied', () => {
  it('is strict on both sides, so landing exactly on the threshold does not fire', () => {
    expect(conditionSatisfied('above', 10, 10)).toBe(false);
    expect(conditionSatisfied('below', 10, 10)).toBe(false);
    expect(conditionSatisfied('above', 10, 10.0001)).toBe(true);
    expect(conditionSatisfied('below', 10, 9.9999)).toBe(true);
  });
});

describe('evaluateAlert', () => {
  it('fires on the transition into the condition', () => {
    const outcome = evaluateAlert(alert({ conditionMet: false }), pair({ priceUsd: 12 }));
    expect(outcome).toEqual({ action: 'fire', value: 12, conditionMet: true });
  });

  it('stays quiet while the condition is still satisfied', () => {
    /* The whole reason for edge triggering. A price sitting one cent past a
       threshold would otherwise fire every poll — on the server that is a
       notification a minute, all night. */
    const outcome = evaluateAlert(alert({ conditionMet: true }), pair({ priceUsd: 12 }));
    expect(outcome.action).toBe('hold');
  });

  it('re-arms once the condition clears', () => {
    const outcome = evaluateAlert(alert({ conditionMet: true }), pair({ priceUsd: 8 }));
    expect(outcome).toEqual({ action: 'clear', value: 8, conditionMet: false });
  });

  it('fires again after clearing and re-entering', () => {
    let state = false;
    const step = (price: number) => {
      const outcome = evaluateAlert(alert({ conditionMet: state }), pair({ priceUsd: price }));
      if ('conditionMet' in outcome) state = outcome.conditionMet;
      return outcome.action;
    };

    expect(step(12)).toBe('fire');
    expect(step(13)).toBe('hold');
    expect(step(8)).toBe('clear');
    expect(step(14)).toBe('fire');
  });

  it('leaves the state alone when the pair is missing', () => {
    // Not "cleared". Re-arming here would fire again the moment the pair came
    // back, whether or not anything actually crossed.
    expect(evaluateAlert(alert({ conditionMet: true }), null)).toEqual({
      action: 'skip',
      reason: 'no-pair',
    });
  });

  it('leaves the state alone when the metric is unreported', () => {
    expect(evaluateAlert(alert({ metric: 'marketCap', conditionMet: true }), pair({ marketCap: 0 })))
      .toEqual({ action: 'skip', reason: 'unreported' });
  });

  it('skips a disabled alert without deciding anything about it', () => {
    expect(evaluateAlert(alert({ enabled: false }), pair({ priceUsd: 999 }))).toEqual({
      action: 'skip',
      reason: 'disabled',
    });
  });

  it('handles a below-threshold alert on a falling market cap', () => {
    const falling = evaluateAlert(
      alert({ metric: 'marketCap', comparator: 'below', threshold: 120_000, conditionMet: false }),
      pair({ marketCap: 119_000 }),
    );
    expect(falling.action).toBe('fire');
  });
});
