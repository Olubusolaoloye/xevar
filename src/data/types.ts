/**
 * The domain model for PanScreener.
 *
 * These types are the contract between the UI and whatever is supplying market
 * data. Any market source — DexScreener today, another provider tomorrow —
 * all produce exactly these shapes, which is what makes the data source
 * swappable without touching a single component.
 */

import type { ListingStatus } from './listingStatus';

export type ChainId =
  | 'ethereum'
  | 'solana'
  | 'bsc'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'avalanche'
  | 'sui';

/** The windows every rolling metric is reported over. */
export type Timeframe = 'm5' | 'h1' | 'h6' | 'h24';

export const TIMEFRAMES: readonly Timeframe[] = ['m5', 'h1', 'h6', 'h24'];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  m5: '5M',
  h1: '1H',
  h6: '6H',
  h24: '24H',
};

/** A value measured across each rolling window. */
export type Windowed<T> = Record<Timeframe, T>;

export interface TokenRef {
  address: string;
  name: string;
  symbol: string;
}

export interface TxnCounts {
  buys: number;
  sells: number;
}

/**
 * Automated contract checks. Presented as signals, never as a verdict — the
 * UI is explicit that these are heuristics rather than an audit.
 */
export interface SecuritySignals {
  /**
   * Whether these signals are actually known.
   *
   * The public market APIs expose no contract-safety data. Rendering a
   * fabricated "liquidity locked" pass on a real token would be worse than
   * showing nothing, so when this is false the UI states plainly that the
   * checks are unavailable rather than showing a pass or a fail.
   */
  available: boolean;
  liquidityLocked: boolean;
  /** Percentage of liquidity locked or burned, 0–100. */
  liquidityLockedPct: number;
  mintRenounced: boolean;
  ownershipRenounced: boolean;
  verifiedContract: boolean;
  /** Share of supply held by the top 10 wallets, 0–100. */
  topHolderPct: number;
  /** Sell tax as a percentage. */
  sellTaxPct: number;
  buyTaxPct: number;
}

/** A tradeable market: one base token against one quote token on one DEX. */
export interface Pair {
  id: string;
  chain: ChainId;
  /** Human-readable exchange name, e.g. "Uniswap V3". */
  dex: string;
  pairAddress: string;
  baseToken: TokenRef;
  quoteToken: TokenRef;

  priceUsd: number;
  /** Price denominated in the quote asset (ETH, SOL, BNB…). */
  priceNative: number;

  change: Windowed<number>;
  volume: Windowed<number>;
  txns: Windowed<TxnCounts>;

  /** Distinct trading addresses over 24h. `-1` means the source doesn't report it. */
  makers24h: number;
  liquidityUsd: number;
  fdv: number;
  marketCap: number;

  /** Pair creation time, in epoch milliseconds. */
  createdAt: number;

  /** Paid promotion count, mirroring the "boosts" concept the market provider reports. */
  boosts: number;
  /** Trending rank, if the pair is currently trending. */
  trendingRank?: number;

  /** ~48 recent price points, for the inline row sparkline. */
  sparkline: number[];

  security: SecuritySignals;

  /**
   * Links submitted with the listing and approved in review.
   *
   * Never the market provider's own social fields. Everything here has been
   * through a human, which is what lets the token page offer them as real
   * links rather than as inert claims.
   */
  socials: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };

  /** Token logo — the operator's override, else the provider's. */
  imageUrl?: string;
  /** Wide banner set by the operator. */
  coverUrl?: string;
  /** Operator-written description. */
  blurb?: string;
  /** Pinned to the top of the board. */
  featured?: boolean;

  /**
   * Which registry entry put this pair listed.
   *
   * `pinned` means the token was fetched by contract address and is certainly
   * the right asset. False means it was matched by ticker alone, which can
   * resolve to an impostor sharing the symbol — the UI flags those.
   */
  tracked?: {
    tokenId: string;
    pinned: boolean;
    /** An admin has confirmed this is the project it claims to be. */
    verified: boolean;
    /** Where the listing sits in the paid-listing workflow. */
    status: ListingStatus;
  };
}

/** A single fill on the tape. */
export interface Trade {
  id: string;
  timestamp: number;
  side: 'buy' | 'sell';
  priceUsd: number;
  /** Trade size in base tokens. */
  amount: number;
  /** Trade size in USD. */
  valueUsd: number;
  maker: string;
}

/** One OHLC bar. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                     */
/* -------------------------------------------------------------------------- */

export type AlertMetric =
  | 'price'
  | 'marketCap'
  | 'change24h'
  | 'liquidity'
  | 'volume24h';
export type AlertComparator = 'above' | 'below';

export interface Alert {
  id: string;
  pairId: string;
  /** Denormalised for display, so the alert list renders without a lookup. */
  pairLabel: string;
  chain: ChainId;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  enabled: boolean;
  createdAt: number;
  triggeredAt?: number;
}

/* -------------------------------------------------------------------------- */
/* Screener query                                                             */
/* -------------------------------------------------------------------------- */

export type SortKey =
  | 'trending'
  | 'priceUsd'
  | 'change'
  | 'volume'
  | 'txns'
  | 'makers24h'
  | 'liquidityUsd'
  | 'marketCap'
  | 'createdAt';

export type SortDirection = 'asc' | 'desc';

export interface ScreenerFilters {
  /** Empty array means "every chain". */
  chains: ChainId[];
  dexes: string[];
  search: string;
  minLiquidity: number | null;
  maxLiquidity: number | null;
  minVolume24h: number | null;
  minMarketCap: number | null;
  maxMarketCap: number | null;
  /** Maximum pair age in hours. `null` is any age. */
  maxAgeHours: number | null;
  minTxns24h: number | null;
  /** Only pairs whose liquidity is locked. */
  liquidityLockedOnly: boolean;
}

export interface ScreenerQuery extends ScreenerFilters {
  sortKey: SortKey;
  sortDirection: SortDirection;
  /** The window that `change`, `volume` and `txns` sorting refer to. */
  timeframe: Timeframe;
}

/**
 * State of the market feed, surfaced in the top bar.
 *
 * `stale` is the important one: the last refresh failed, so the board is
 * showing cached values rather than live ones. Saying so is the whole point —
 * presenting a cached price as live is the one thing a market app must never
 * do.
 */
export type FeedStatus =
  | 'connecting'
  | 'live'
  | 'stale'
  | 'offline';
