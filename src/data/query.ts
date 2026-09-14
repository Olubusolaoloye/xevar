/**
 * The screener query engine.
 *
 * Pure functions over the pair board: no React, no store access. Filtering and
 * sorting live here rather than inside a component so the behaviour is
 * explicit, reusable across the screener / watchlist / home pages, and
 * trivially testable.
 */

import type { Pair, ScreenerQuery, SortKey, Timeframe } from './types';

/** Value a given sort key resolves to for one pair, in the active window. */
function sortValue(pair: Pair, key: SortKey, timeframe: Timeframe): number {
  switch (key) {
    case 'trending':
      // Unranked pairs sort below every ranked one regardless of direction.
      return pair.trendingRank ? -pair.trendingRank : -Infinity;
    case 'priceUsd':
      return pair.priceUsd;
    case 'change':
      return pair.change[timeframe];
    case 'volume':
      return pair.volume[timeframe];
    case 'txns':
      return pair.txns[timeframe].buys + pair.txns[timeframe].sells;
    case 'makers24h':
      return pair.makers24h;
    case 'liquidityUsd':
      return pair.liquidityUsd;
    case 'marketCap':
      return pair.marketCap;
    case 'createdAt':
      return pair.createdAt;
    default:
      return 0;
  }
}

/** Case-insensitive match across every field a user might type. */
function matchesSearch(pair: Pair, needle: string): boolean {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;

  return (
    pair.baseToken.symbol.toLowerCase().includes(q) ||
    pair.baseToken.name.toLowerCase().includes(q) ||
    pair.quoteToken.symbol.toLowerCase().includes(q) ||
    pair.dex.toLowerCase().includes(q) ||
    pair.chain.includes(q) ||
    pair.baseToken.address.toLowerCase().includes(q) ||
    pair.pairAddress.toLowerCase().includes(q)
  );
}

export function filterPairs(pairs: Pair[], query: ScreenerQuery, now = Date.now()): Pair[] {
  const {
    chains,
    dexes,
    search,
    minLiquidity,
    maxLiquidity,
    minVolume24h,
    minMarketCap,
    maxMarketCap,
    maxAgeHours,
    minTxns24h,
    liquidityLockedOnly,
  } = query;

  return pairs.filter((pair) => {
    if (chains.length > 0 && !chains.includes(pair.chain)) return false;
    if (dexes.length > 0 && !dexes.includes(pair.dex)) return false;
    if (!matchesSearch(pair, search)) return false;

    if (minLiquidity !== null && pair.liquidityUsd < minLiquidity) return false;
    if (maxLiquidity !== null && pair.liquidityUsd > maxLiquidity) return false;
    if (minVolume24h !== null && pair.volume.h24 < minVolume24h) return false;
    if (minMarketCap !== null && pair.marketCap < minMarketCap) return false;
    if (maxMarketCap !== null && pair.marketCap > maxMarketCap) return false;

    if (maxAgeHours !== null) {
      const ageHours = (now - pair.createdAt) / 3_600_000;
      if (ageHours > maxAgeHours) return false;
    }

    if (minTxns24h !== null && pair.txns.h24.buys + pair.txns.h24.sells < minTxns24h) {
      return false;
    }

    if (liquidityLockedOnly && !pair.security.liquidityLocked) return false;

    return true;
  });
}

export function sortPairs(pairs: Pair[], query: ScreenerQuery): Pair[] {
  const { sortKey, sortDirection, timeframe } = query;
  const factor = sortDirection === 'asc' ? 1 : -1;

  return [...pairs].sort((a, b) => {
    const left = sortValue(a, sortKey, timeframe);
    const right = sortValue(b, sortKey, timeframe);
    if (left === right) {
      // Stable, meaningful tie-break: deeper liquidity ranks first.
      return b.liquidityUsd - a.liquidityUsd;
    }
    return (left - right) * factor;
  });
}

export function runQuery(pairs: Pair[], query: ScreenerQuery, now = Date.now()): Pair[] {
  return sortPairs(filterPairs(pairs, query, now), query);
}

/** Count of filters the user has actually applied, for the "clear" badge. */
export function activeFilterCount(query: ScreenerQuery): number {
  let count = 0;
  if (query.chains.length) count += 1;
  if (query.dexes.length) count += 1;
  if (query.minLiquidity !== null || query.maxLiquidity !== null) count += 1;
  if (query.minVolume24h !== null) count += 1;
  if (query.minMarketCap !== null || query.maxMarketCap !== null) count += 1;
  if (query.maxAgeHours !== null) count += 1;
  if (query.minTxns24h !== null) count += 1;
  if (query.liquidityLockedOnly) count += 1;
  return count;
}

/** Board-wide aggregates for the home page summary strip. */
export function marketSummary(pairs: Pair[]) {
  let volume24h = 0;
  let liquidity = 0;
  let gainers = 0;
  let losers = 0;
  let txns24h = 0;

  for (const pair of pairs) {
    volume24h += pair.volume.h24;
    liquidity += pair.liquidityUsd;
    txns24h += pair.txns.h24.buys + pair.txns.h24.sells;
    if (pair.change.h24 > 0) gainers += 1;
    else if (pair.change.h24 < 0) losers += 1;
  }

  return {
    volume24h,
    liquidity,
    txns24h,
    gainers,
    losers,
    pairCount: pairs.length,
    /** Share of the board that is up on the day, 0–100. */
    breadth: pairs.length ? (gainers / pairs.length) * 100 : 0,
  };
}
