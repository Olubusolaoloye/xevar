import { useEffect, useState } from 'react';
import { cached } from '@/data/cache';
import { HttpError } from '@/data/http';
import {
  fetchCandles,
  fetchTopPool,
  fetchTrades,
  type CandleInterval,
} from '@/data/sources/geckoterminal';
import type { Candle, Pair, Trade } from '@/data/types';

/**
 * Why a request came back with nothing.
 *
 * These are not the same problem and must not read as though they were. A
 * pool the provider has never indexed is a permanent fact about that pool; a
 * rate limit clears in under a minute; an unreachable host is the user's own
 * network as often as it is ours. Telling somebody "the provider is
 * unreachable" when they have simply hit a 30-call limit sends them to check
 * their wifi, and telling them the same thing about an unindexed pool sends
 * them to wait for a recovery that will never come.
 */
export type FailureReason = 'unindexed' | 'rate-limited' | 'unreachable';

function reasonFor(error: unknown): FailureReason {
  if (error instanceof HttpError) {
    if (error.status === 404) return 'unindexed';
    if (error.isRateLimited) return 'rate-limited';
  }
  return 'unreachable';
}

/**
 * The pool this provider will chart, resolved once per token.
 *
 * Falls back to whatever the listing pinned. That address came from a
 * different index and may not exist here — but a 404 the caller can report is
 * better than refusing to try, and for the many tokens where the two indexes
 * do agree it is exactly right.
 *
 * Cached for an hour: which pool is deepest changes on the timescale of days,
 * and this provider allows about thirty calls a minute across the whole app.
 */
function chartPool(chain: string, tokenAddress: string, pinned: string): Promise<string> {
  return cached(
    `pool:${chain}:${tokenAddress.toLowerCase()}`,
    async () => (await fetchTopPool(chain as never, tokenAddress)) ?? pinned,
    { freshMs: 60 * 60_000, maxStaleMs: 24 * 60 * 60_000 },
  )
    .then(({ value }) => value)
    .catch(() => pinned);
}

interface AsyncResult<T> {
  data: T;
  loading: boolean;
  /**
   * True when the request produced nothing usable.
   *
   * The data is empty in that case. It used to be filled with a generated
   * series instead, which drew a plausible-looking chart of a market that
   * never happened — the one thing this app must never do. An empty chart
   * that says why is the honest answer.
   */
  failed: boolean;
  /** Which kind of failure, so the UI can say something true about it. */
  reason: FailureReason | null;
  /**
   * Age of the data, when it came from cache because the refresh failed.
   *
   * Null when the value is live. A chart drawn from cache must say so — a
   * stale series presented as current is the one thing worse than an empty
   * panel, because it looks exactly like a working chart.
   */
  cachedAgeMs: number | null;
}

/**
 * Real OHLCV for a pair.
 *
 * GeckoTerminal allows ~30 requests a minute, so this is only ever called on a
 * pair page — never per row. Responses are cached for a minute, which also
 * makes switching chart ranges back and forth free.
 */
export function usePairCandles(pair: Pair | undefined, interval: CandleInterval) {
  // The feed hands every subscriber a fresh Pair object on each poll, so
  // depending on `pair` itself re-ran this effect every 15 seconds: each run
  // flipped `loading` back on and re-entered the cache for a pool whose
  // candles had not changed. These three fields are what the request is
  // actually built from.
  const { id: pairId, chain, pairAddress } = pair ?? {};
  const [state, setState] = useState<AsyncResult<Candle[]>>({
    data: [],
    loading: true,
    failed: false,
    reason: null,
    cachedAgeMs: null,
  });

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    cached(
      `candles:${pair.id}:${interval}`,
      async () =>
        fetchCandles(
          pair.chain,
          await chartPool(pair.chain, pair.baseToken.address, pair.pairAddress),
          interval,
        ),
      {
        freshMs: 60_000,
        // A day, now that the cache survives reloads. Beyond that the series
        // is kept on disk but not offered: a day-old shape is context, a
        // week-old one is a different market.
        maxStaleMs: 24 * 60 * 60_000,
        persist: true,
      },
    )
      .then(({ value, stale, ageMs }) => {
        if (cancelled) return;
        // An empty response means the pool has no history on this provider;
        // that is a real answer, not a failure.
        setState({
          data: value,
          loading: false,
          failed: false,
          reason: null,
          cachedAgeMs: stale ? ageMs : null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          data: [],
          loading: false,
          failed: true,
          reason: reasonFor(error),
          cachedAgeMs: null,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pair` is a new
    // object every poll; these three fields are what the request depends on.
  }, [pairId, chain, pairAddress, interval]);

  return state;
}

/** Real recent trades for a pair, refreshed on an interval. */
export function usePairTrades(pair: Pair | undefined, refreshMs = 20_000) {
  // Same reasoning as usePairCandles: key off stable identifiers, not the
  // Pair object the feed replaces on every poll.
  const { id: pairId, chain, pairAddress } = pair ?? {};
  const [state, setState] = useState<AsyncResult<Trade[]>>({
    data: [],
    loading: true,
    failed: false,
    reason: null,
    cachedAgeMs: null,
  });

  useEffect(() => {
    if (!pair) return;
    let cancelled = false;

    const load = () => {
      cached(
        `trades:${pair.id}`,
        async () =>
          fetchTrades(
            pair.chain,
            await chartPool(pair.chain, pair.baseToken.address, pair.pairAddress),
          ),
        { freshMs: refreshMs - 2_000, maxStaleMs: 5 * 60_000 },
      )
        .then(({ value }) => {
          if (!cancelled)
            setState({ data: value, loading: false, failed: false, reason: null, cachedAgeMs: null });
        })
        .catch((error) => {
          if (!cancelled)
            setState({
              data: [],
              loading: false,
              failed: true,
              reason: reasonFor(error),
              cachedAgeMs: null,
            });
        });
    };

    load();
    const timer = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above.
  }, [pairId, chain, pairAddress, refreshMs]);

  return state;
}
