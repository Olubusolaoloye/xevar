import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import type { Holding } from '@/data/types';

/**
 * Portfolio holdings, revalued against the live board.
 *
 * Stored holdings carry the balance and cost basis — facts about the wallet —
 * but their price must come from the market, not from storage, or the portfolio
 * silently freezes at whatever price it was seeded with while the rest of the
 * app ticks.
 *
 * Matching is by base symbol, with the wrapped prefix stripped, so a WETH
 * position is valued off the ETH market.
 */
export function useLiveHoldings(): Holding[] {
  const holdings = usePortfolioStore((s) => s.holdings);
  const pairs = useMarketStore((s) => s.pairs);

  return useMemo(() => {
    // Deepest pair per symbol wins — the most liquid market is the best price.
    const bestBySymbol = new Map<string, (typeof pairs)[number]>();
    for (const pair of pairs) {
      const key = pair.baseToken.symbol.replace(/^W/, '').toUpperCase();
      const incumbent = bestBySymbol.get(key);
      if (!incumbent || pair.liquidityUsd > incumbent.liquidityUsd) {
        bestBySymbol.set(key, pair);
      }
    }

    return holdings.map((holding) => {
      // Stablecoins are pinned; quoting them off a pool adds noise, not signal.
      if (holding.token.symbol === 'USDC' || holding.token.symbol === 'USDT') {
        return { ...holding, priceUsd: 1, valueUsd: holding.balance, change24h: 0 };
      }

      const market = bestBySymbol.get(holding.token.symbol.replace(/^W/, '').toUpperCase());
      if (!market) return holding;

      return {
        ...holding,
        priceUsd: market.priceUsd,
        valueUsd: holding.balance * market.priceUsd,
        change24h: market.change.h24,
      };
    });
  }, [holdings, pairs]);
}
