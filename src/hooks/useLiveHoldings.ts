import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { usePositionsStore } from '@/store/usePositionsStore';
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

/**
 * Positions the user recorded on pair pages, expressed as holdings.
 *
 * These carry a real cost basis the user typed in, which wallet-derived
 * holdings do not, so they feed the portfolio's P&L more accurately than a
 * balance alone ever could.
 */
export function useTrackedPositions(): Holding[] {
  const entries = usePositionsStore((s) => s.entries);
  const pairs = useMarketStore((s) => s.pairs);

  return useMemo(() => {
    // Several entries in the same pair blend into one line, the way a broker
    // shows one position rather than one row per fill.
    const byPair = new Map<string, typeof entries>();
    for (const entry of entries) {
      byPair.set(entry.pairId, [...(byPair.get(entry.pairId) ?? []), entry]);
    }

    const holdings: Holding[] = [];
    for (const [pairId, group] of byPair) {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) continue;

      const amount = group.reduce((sum, e) => sum + e.amount, 0);
      const cost = group.reduce((sum, e) => sum + e.amount * e.entryPriceUsd, 0);
      if (amount <= 0) continue;

      holdings.push({
        id: `pos-${pairId}`,
        walletId: 'tracked',
        chain: pair.chain,
        token: pair.baseToken,
        balance: amount,
        priceUsd: pair.priceUsd,
        valueUsd: amount * pair.priceUsd,
        change24h: pair.change.h24,
        costBasis: cost / amount,
      });
    }

    return holdings;
  }, [entries, pairs]);
}
