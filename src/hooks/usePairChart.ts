import { useEffect, useState } from 'react';
import { cached } from '@/data/cache';
import { fetchCandles, fetchTrades, type CandleInterval } from '@/data/sources/geckoterminal';
import { generateCandles, generateTrades } from '@/data/sources/mock';
import type { Candle, Pair, Trade } from '@/data/types';

interface AsyncResult<T> {
  data: T;
  loading: boolean;
  /** True when the data is generated because the provider was unreachable. */
  simulated: boolean;
}

/**
 * Real OHLCV for a pair.
 *
 * GeckoTerminal allows ~30 requests a minute, so this is only ever called on a
 * pair page — never per row. Responses are cached for a minute, which also
 * makes switching chart ranges back and forth free.
 */
export function usePairCandles(pair: Pair | undefined, interval: CandleInterval) {
  const [state, setState] = useState<AsyncResult<Candle[]>>({
    data: [],
    loading: true,
    simulated: false,
  });

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    cached(
      `candles:${pair.id}:${interval}`,
      () => fetchCandles(pair.chain, pair.pairAddress, interval),
      { freshMs: 60_000, maxStaleMs: 15 * 60_000 },
    )
      .then(({ value }) => {
        if (cancelled) return;
        // An empty response means the pool has no history on this provider;
        // that is a real answer, not a failure.
        setState({ data: value, loading: false, simulated: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ data: generateCandles(pair), loading: false, simulated: true });
      });

    return () => {
      cancelled = true;
    };
  }, [pair, interval]);

  return state;
}

/** Real recent trades for a pair, refreshed on an interval. */
export function usePairTrades(pair: Pair | undefined, refreshMs = 20_000) {
  const [state, setState] = useState<AsyncResult<Trade[]>>({
    data: [],
    loading: true,
    simulated: false,
  });

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;

    const load = () => {
      cached(
        `trades:${pair.id}`,
        () => fetchTrades(pair.chain, pair.pairAddress),
        { freshMs: refreshMs - 2_000, maxStaleMs: 5 * 60_000 },
      )
        .then(({ value }) => {
          if (!cancelled) setState({ data: value, loading: false, simulated: false });
        })
        .catch(() => {
          if (!cancelled) {
            setState({ data: generateTrades(pair, 40), loading: false, simulated: true });
          }
        });
    };

    load();
    const timer = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pair, refreshMs]);

  return state;
}
