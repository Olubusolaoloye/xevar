/**
 * GeckoTerminal API adapter.
 *
 * Covers the two things DexScreener's public API does not return: OHLCV
 * candles and an actual trade history. Also free and keyless, but limited to
 * roughly 30 requests per minute — an order of magnitude tighter than
 * DexScreener — so it is only called on a pair page, never for the board.
 *
 * Docs: https://www.geckoterminal.com/dex-api
 */

import { getJson } from '../http';
import type { Candle, ChainId, Trade } from '../types';

const BASE = 'https://api.geckoterminal.com/api/v2';

/**
 * GeckoTerminal uses its own network slugs, which do not match DexScreener's.
 * This mapping is the entire reason the two providers can be used together.
 */
const NETWORK: Record<ChainId, string> = {
  ethereum: 'eth',
  solana: 'solana',
  bsc: 'bsc',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  avalanche: 'avax',
  sui: 'sui-network',
};

export type CandleInterval = 'm5' | 'm15' | 'h1' | 'h4' | 'd1';

/** Each interval maps to a GeckoTerminal timeframe plus an aggregate factor. */
const INTERVAL: Record<CandleInterval, { timeframe: string; aggregate: number }> = {
  m5: { timeframe: 'minute', aggregate: 5 },
  m15: { timeframe: 'minute', aggregate: 15 },
  h1: { timeframe: 'hour', aggregate: 1 },
  h4: { timeframe: 'hour', aggregate: 4 },
  d1: { timeframe: 'day', aggregate: 1 },
};

interface OhlcvResponse {
  data?: {
    attributes?: {
      /** [unix seconds, open, high, low, close, volume] */
      ohlcv_list?: number[][];
    };
  };
}

/** OHLCV history for a pool, oldest first. */
export async function fetchCandles(
  chain: ChainId,
  poolAddress: string,
  interval: CandleInterval = 'h1',
  limit = 160,
): Promise<Candle[]> {
  const { timeframe, aggregate } = INTERVAL[interval];
  const url =
    `${BASE}/networks/${NETWORK[chain]}/pools/${poolAddress}/ohlcv/${timeframe}` +
    `?aggregate=${aggregate}&limit=${Math.min(1000, limit)}&currency=usd`;

  const response = await getJson<OhlcvResponse>(url);
  return mapOhlcvRows(response.data?.attributes?.ohlcv_list ?? []);
}

/**
 * Turn raw `ohlcv_list` rows into candles.
 *
 * Exported for tests. The filter is the load-bearing part: a bucket with no
 * trades in it comes back as zeroes, and the currently forming bucket is
 * usually one of those. `Number.isFinite(0)` is true, so guarding on finiteness
 * alone let it through — which dropped the line to zero at the right edge,
 * dragged the y-axis domain down to 0 so the real price variation was squashed
 * into a sliver, and painted the whole chart red because the closing price now
 * sat below the opening one. A period with no trades has no price: it is
 * absent, not zero.
 */
export function mapOhlcvRows(rows: number[][]): Candle[] {
  return rows
    .map(([time, open, high, low, close, volume]) => ({
      // The API reports seconds; the rest of the app works in milliseconds.
      time: time * 1000,
      open,
      high,
      low,
      close,
      volume,
    }))
    .filter(
      (candle) =>
        Number.isFinite(candle.time) &&
        Number.isFinite(candle.close) &&
        candle.close > 0,
    )
    .sort((a, b) => a.time - b.time);
}

interface TradesResponse {
  data?: Array<{
    id?: string;
    attributes?: {
      block_timestamp?: string;
      kind?: string;
      price_to_in_currency_token?: string;
      price_from_in_currency_token?: string;
      volume_in_usd?: string;
      from_token_amount?: string;
      to_token_amount?: string;
      tx_from_address?: string;
    };
  }>;
}

/**
 * Recent trades for a pool, newest first.
 *
 * GeckoTerminal reports each trade from the perspective of the pool's base
 * token, so `kind` is already "buy" or "sell" and needs no inference.
 */
export async function fetchTrades(
  chain: ChainId,
  poolAddress: string,
  minVolumeUsd = 0,
): Promise<Trade[]> {
  const url =
    `${BASE}/networks/${NETWORK[chain]}/pools/${poolAddress}/trades` +
    `?trade_volume_in_usd_greater_than=${minVolumeUsd}`;

  const response = await getJson<TradesResponse>(url);

  return (response.data ?? [])
    .map((entry, index) => {
      const a = entry.attributes ?? {};
      const side: Trade['side'] = a.kind === 'sell' ? 'sell' : 'buy';

      const valueUsd = Number.parseFloat(a.volume_in_usd ?? '0') || 0;
      const priceUsd =
        Number.parseFloat(
          (side === 'buy' ? a.price_to_in_currency_token : a.price_from_in_currency_token) ?? '0',
        ) || 0;
      const amount =
        Number.parseFloat((side === 'buy' ? a.to_token_amount : a.from_token_amount) ?? '0') || 0;

      return {
        id: entry.id ?? `gt-${index}`,
        timestamp: a.block_timestamp ? Date.parse(a.block_timestamp) : Date.now(),
        side,
        priceUsd: priceUsd > 0 ? priceUsd : valueUsd / (amount || 1),
        amount,
        valueUsd,
        maker: a.tx_from_address ?? '',
      };
    })
    .filter((trade) => trade.valueUsd > 0)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/* A holder count used to be fetched here, from this provider's
   /tokens/{address}/info endpoint.

   It was removed because the figure did not match the chain. Whether the field
   is stale or means something other than "wallets holding this token" could
   not be established, and a holder count is read as a distribution check by
   someone deciding whether to buy — so a wrong one is worse than none. The
   pair page links to the chain explorer's own token page instead.

   Re-adding this needs a provider whose number can actually be checked against
   an explorer, which in practice means a keyed API. */

/** Whether a chain is covered by this provider. */
export function supportsChain(chain: ChainId): boolean {
  return chain in NETWORK;
}
