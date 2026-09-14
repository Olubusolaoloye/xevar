import { useEffect, useState } from 'react';
import { searchPairs } from '@/data/sources/dexscreener';
import { useDebounced } from '@/hooks/useDebounced';
import type { ChainId, Pair } from '@/data/types';

interface SearchState {
  results: Pair[];
  loading: boolean;
  error: string | null;
}

/**
 * Live token search against DexScreener.
 *
 * This backs the admin "add token" flow. The point is that the user picks a
 * real result — with its chain, contract and liquidity visible — rather than
 * typing a ticker and hoping. Ticker collisions on a DEX are routine, so
 * choosing from live results is the only reliable way to add the right asset.
 */
export function useTokenSearch(query: string, chain?: ChainId): SearchState {
  const debounced = useDebounced(query.trim(), 350);
  const [state, setState] = useState<SearchState>({
    results: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (debounced.length < 2) {
      setState({ results: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    searchPairs(debounced)
      .then((pairs) => {
        if (cancelled) return;

        const filtered = chain ? pairs.filter((p) => p.chain === chain) : pairs;

        // One row per token, not per pool: the same token across five pools is
        // one choice, and the deepest pool is the one worth quoting.
        const best = new Map<string, Pair>();
        for (const pair of filtered) {
          const key = `${pair.chain}:${pair.baseToken.address.toLowerCase()}`;
          const incumbent = best.get(key);
          if (!incumbent || pair.liquidityUsd > incumbent.liquidityUsd) {
            best.set(key, pair);
          }
        }

        setState({
          results: [...best.values()]
            .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
            .slice(0, 20),
          loading: false,
          error: null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          results: [],
          loading: false,
          error: 'Could not reach the market API. Check your connection and try again.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, chain]);

  return state;
}
