import { useMemo } from 'react';
import { useDebounced } from '@/hooks/useDebounced';
import { runQuery } from '@/data/query';
import { useMarketStore } from '@/store/useMarketStore';
import { useScreenerStore } from '@/store/useScreenerStore';
import type { Pair, ScreenerQuery } from '@/data/types';

/** Assemble the live query object from the screener store. */
export function useScreenerQuery(): ScreenerQuery {
  const state = useScreenerStore();
  // Search trails the input so typing never blocks on re-filtering the board.
  const search = useDebounced(state.search, 180);

  return useMemo(
    () => ({
      chains: state.chains,
      dexes: state.dexes,
      search,
      minLiquidity: state.minLiquidity,
      maxLiquidity: state.maxLiquidity,
      minVolume24h: state.minVolume24h,
      minMarketCap: state.minMarketCap,
      maxMarketCap: state.maxMarketCap,
      maxAgeHours: state.maxAgeHours,
      minTxns24h: state.minTxns24h,
      liquidityLockedOnly: state.liquidityLockedOnly,
      sortKey: state.sortKey,
      sortDirection: state.sortDirection,
      timeframe: state.timeframe,
    }),
    [
      state.chains,
      state.dexes,
      search,
      state.minLiquidity,
      state.maxLiquidity,
      state.minVolume24h,
      state.minMarketCap,
      state.maxMarketCap,
      state.maxAgeHours,
      state.minTxns24h,
      state.liquidityLockedOnly,
      state.sortKey,
      state.sortDirection,
      state.timeframe,
    ],
  );
}

/** The filtered, sorted board for the current query. */
export function useScreenerResults(): { query: ScreenerQuery; results: Pair[] } {
  const pairs = useMarketStore((s) => s.pairs);
  const query = useScreenerQuery();

  const results = useMemo(() => runQuery(pairs, query), [pairs, query]);

  return { query, results };
}
