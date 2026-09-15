import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALERT_METRIC_LABEL,
  conditionMet,
  metricFormat,
  readMetric,
  useAlertStore,
} from './useAlertStore';
import type { Alert, Pair } from '@/data/types';

/** A pair with only the fields the evaluator reads; the rest is scaffolding. */
function pair(overrides: Partial<Pair> & { id: string }): Pair {
  return {
    chain: 'bsc',
    dex: 'PancakeSwap V3',
    pairAddress: '0xpair',
    baseToken: { address: '0xbase', name: 'Wiki Cat', symbol: 'WKC' },
    quoteToken: { address: '0xquote', name: 'Wrapped BNB', symbol: 'WBNB' },
    priceUsd: 1,
    priceNative: 1,
    change: { m5: 0, h1: 0, h6: 0, h24: 0 },
    volume: { m5: 0, h1: 0, h6: 0, h24: 0 },
    txns: {
      m5: { buys: 0, sells: 0 },
      h1: { buys: 0, sells: 0 },
      h6: { buys: 0, sells: 0 },
      h24: { buys: 0, sells: 0 },
    },
    makers24h: -1,
    liquidityUsd: 0,
    fdv: 0,
    marketCap: 0,
    createdAt: 0,
    boosts: 0,
    ...overrides,
  } as Pair;
}

const reset = () =>
  useAlertStore.setState({ alerts: [], events: [], met: {} });

/** Add an alert and return it, so tests can reference its generated id. */
function addAlert(partial: Partial<Alert> = {}) {
  useAlertStore.getState().addAlert({
    pairId: 'p1',
    pairLabel: 'WKC / WBNB',
    chain: 'bsc',
    metric: 'price',
    comparator: 'above',
    threshold: 10,
    enabled: true,
    ...partial,
  } as Omit<Alert, 'id' | 'createdAt'>);
  return useAlertStore.getState().alerts[0];
}

beforeEach(reset);

describe('readMetric', () => {
  it('reads each supported metric off the pair', () => {
    const p = pair({
      id: 'p1',
      priceUsd: 3,
      change: { m5: 0, h1: 0, h6: 0, h24: -12.5 },
      liquidityUsd: 900,
      volume: { m5: 0, h1: 0, h6: 0, h24: 4200 },
      marketCap: 4_200_000,
    });

    expect(readMetric(p, 'price')).toBe(3);
    expect(readMetric(p, 'marketCap')).toBe(4_200_000);
    expect(readMetric(p, 'change24h')).toBe(-12.5);
    expect(readMetric(p, 'liquidity')).toBe(900);
    expect(readMetric(p, 'volume24h')).toBe(4200);
  });
});

describe('conditionMet', () => {
  const base = { comparator: 'above', threshold: 10 } as Alert;

  it('is strict at the threshold, so touching it is not crossing it', () => {
    expect(conditionMet(base, 10)).toBe(false);
    expect(conditionMet(base, 10.0001)).toBe(true);
    expect(conditionMet({ ...base, comparator: 'below' }, 10)).toBe(false);
    expect(conditionMet({ ...base, comparator: 'below' }, 9.999)).toBe(true);
  });
});

describe('evaluate', () => {
  it('fires once when the condition is entered, not on every refresh', () => {
    addAlert();
    const { evaluate } = useAlertStore.getState();

    evaluate([pair({ id: 'p1', priceUsd: 5 })]); // below threshold
    expect(useAlertStore.getState().events).toHaveLength(0);

    evaluate([pair({ id: 'p1', priceUsd: 12 })]); // crosses
    expect(useAlertStore.getState().events).toHaveLength(1);

    // Still above, three more polls. This is the bug the edge test exists for:
    // a level-triggered check would log an event every single time.
    evaluate([pair({ id: 'p1', priceUsd: 13 })]);
    evaluate([pair({ id: 'p1', priceUsd: 20 })]);
    evaluate([pair({ id: 'p1', priceUsd: 14 })]);
    expect(useAlertStore.getState().events).toHaveLength(1);
  });

  it('re-arms after the condition clears', () => {
    addAlert();
    const { evaluate } = useAlertStore.getState();

    evaluate([pair({ id: 'p1', priceUsd: 12 })]);
    evaluate([pair({ id: 'p1', priceUsd: 4 })]); // clears
    evaluate([pair({ id: 'p1', priceUsd: 11 })]); // crosses again

    expect(useAlertStore.getState().events).toHaveLength(2);
  });

  it('records the value that crossed, not the threshold', () => {
    addAlert();
    useAlertStore.getState().evaluate([pair({ id: 'p1', priceUsd: 17.5 })]);

    const [event] = useAlertStore.getState().events;
    expect(event.value).toBe(17.5);
    expect(event.threshold).toBe(10);
  });

  it('stamps triggeredAt on the alert that fired', () => {
    addAlert();
    useAlertStore.getState().evaluate([pair({ id: 'p1', priceUsd: 12 })]);
    expect(useAlertStore.getState().alerts[0].triggeredAt).toBeTypeOf('number');
  });

  it('ignores disabled alerts', () => {
    addAlert({ enabled: false });
    useAlertStore.getState().evaluate([pair({ id: 'p1', priceUsd: 99 })]);
    expect(useAlertStore.getState().events).toHaveLength(0);
  });

  it('does not re-fire for a pair that drops off the board and returns', () => {
    addAlert();
    const { evaluate } = useAlertStore.getState();

    evaluate([pair({ id: 'p1', priceUsd: 12 })]); // fires
    evaluate([pair({ id: 'other', priceUsd: 1 })]); // p1 missing this round
    evaluate([pair({ id: 'p1', priceUsd: 13 })]); // back, still above

    // Treating "missing" as "cleared" would have re-armed and fired again.
    expect(useAlertStore.getState().events).toHaveLength(1);
  });

  it('re-arms an alert toggled off and on', () => {
    const alert = addAlert();
    const store = useAlertStore.getState();

    store.evaluate([pair({ id: 'p1', priceUsd: 12 })]);
    expect(useAlertStore.getState().events).toHaveLength(1);

    useAlertStore.getState().toggleAlert(alert.id); // off
    useAlertStore.getState().toggleAlert(alert.id); // on again
    useAlertStore.getState().evaluate([pair({ id: 'p1', priceUsd: 12 })]);

    expect(useAlertStore.getState().events).toHaveLength(2);
  });

  it('skips a metric the source does not report', () => {
    addAlert({ metric: 'price' });
    useAlertStore.getState().evaluate([pair({ id: 'p1', priceUsd: Number.NaN })]);
    expect(useAlertStore.getState().events).toHaveLength(0);
  });

  it('drops a deleted alert and its history together', () => {
    const alert = addAlert();
    useAlertStore.getState().evaluate([pair({ id: 'p1', priceUsd: 12 })]);
    expect(useAlertStore.getState().events).toHaveLength(1);

    useAlertStore.getState().removeAlert(alert.id);
    expect(useAlertStore.getState().alerts).toHaveLength(0);
    expect(useAlertStore.getState().events).toHaveLength(0);
  });
});

describe('market cap alerts', () => {
  it('fires when market cap crosses the threshold', () => {
    // The case asked for: "alert me when market cap hits 120,000".
    addAlert({ metric: 'marketCap', comparator: 'above', threshold: 120_000 });
    const { evaluate } = useAlertStore.getState();

    evaluate([pair({ id: 'p1', marketCap: 90_000 })]);
    expect(useAlertStore.getState().events).toHaveLength(0);

    evaluate([pair({ id: 'p1', marketCap: 121_500 })]);
    const [event] = useAlertStore.getState().events;
    expect(event.metric).toBe('marketCap');
    expect(event.value).toBe(121_500);
    expect(event.threshold).toBe(120_000);
  });

  it('fires on a fall through the threshold', () => {
    addAlert({ metric: 'marketCap', comparator: 'below', threshold: 5_000_000 });
    const { evaluate } = useAlertStore.getState();

    evaluate([pair({ id: 'p1', marketCap: 6_000_000 })]);
    evaluate([pair({ id: 'p1', marketCap: 4_800_000 })]);
    expect(useAlertStore.getState().events).toHaveLength(1);
  });

  it('is edge-triggered like every other metric', () => {
    addAlert({ metric: 'marketCap', comparator: 'above', threshold: 120_000 });
    const { evaluate } = useAlertStore.getState();

    evaluate([pair({ id: 'p1', marketCap: 100_000 })]);
    evaluate([pair({ id: 'p1', marketCap: 130_000 })]);
    evaluate([pair({ id: 'p1', marketCap: 140_000 })]);
    evaluate([pair({ id: 'p1', marketCap: 150_000 })]);
    expect(useAlertStore.getState().events).toHaveLength(1);
  });

  it('skips a pair with no market cap rather than firing at zero', () => {
    // DexScreener reports 0 when it has neither market cap nor FDV. A "below"
    // alert would otherwise fire instantly for every such token.
    addAlert({ metric: 'marketCap', comparator: 'below', threshold: 5_000_000 });
    useAlertStore.getState().evaluate([pair({ id: 'p1', marketCap: 0 })]);
    expect(useAlertStore.getState().events).toHaveLength(0);
  });
});

describe('metric presentation', () => {
  it('labels every metric', () => {
    for (const metric of ['price', 'marketCap', 'change24h', 'liquidity', 'volume24h'] as const) {
      expect(ALERT_METRIC_LABEL[metric]).toBeTruthy();
    }
    expect(ALERT_METRIC_LABEL.marketCap).toBe('Market cap');
  });

  it('formats market cap as money, not as a percentage or a raw price', () => {
    expect(metricFormat('marketCap')).toBe('money');
    expect(metricFormat('change24h')).toBe('percent');
    expect(metricFormat('price')).toBe('price');
    expect(metricFormat('liquidity')).toBe('money');
    expect(metricFormat('volume24h')).toBe('money');
  });
});
