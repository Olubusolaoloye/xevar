/**
 * DexScreener API adapter.
 *
 * The primary source of real market data. It is free, needs no API key and no
 * signup, and allows roughly 300 requests per minute — which is why it beats
 * paying for an explorer API. Explorers like Etherscan bill for *chain* data
 * (transactions, contract source, logs); a screener needs *market* data, which
 * is a different product entirely.
 *
 * Docs: https://docs.dexscreener.com/api/reference
 *
 * Everything here converts DexScreener's wire format into the app's own `Pair`
 * type. No component ever sees a DexScreener shape, so replacing this provider
 * means rewriting only this file.
 */

import { getJson } from '../http';
import { CHAIN_IDS } from '../chains';
import type { ChainId, Pair, SecuritySignals, TokenRef, Windowed } from '../types';

const BASE = 'https://api.dexscreener.com';

/* -------------------------------------------------------------------------- */
/* Wire format                                                                */
/* -------------------------------------------------------------------------- */

interface WirePair {
  chainId: string;
  dexId: string;
  url?: string;
  pairAddress: string;
  labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  /** Numbers arrive as strings on the price fields. */
  priceNative?: string;
  priceUsd?: string;
  txns?: Partial<Record<string, { buys: number; sells: number }>>;
  volume?: Partial<Record<string, number>>;
  priceChange?: Partial<Record<string, number>>;
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ label?: string; url: string }>;
    socials?: Array<{ type?: string; platform?: string; url?: string; handle?: string }>;
  };
  boosts?: { active?: number };
}

interface SearchResponse {
  schemaVersion?: string;
  pairs: WirePair[] | null;
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

/** DexScreener's chain slugs happen to match our ChainId values exactly. */
function toChainId(slug: string): ChainId | null {
  return (CHAIN_IDS as string[]).includes(slug) ? (slug as ChainId) : null;
}

/**
 * Exchanges whose own casing a naive title-case would get wrong.
 * "Pancakeswap" and "Sushiswap" are misspellings of real brands.
 */
const DEX_NAMES: Record<string, string> = {
  pancakeswap: 'PancakeSwap',
  sushiswap: 'SushiSwap',
  uniswap: 'Uniswap',
  quickswap: 'QuickSwap',
  baseswap: 'BaseSwap',
  traderjoe: 'TraderJoe',
  balancer: 'Balancer',
  aerodrome: 'Aerodrome',
  raydium: 'Raydium',
  meteora: 'Meteora',
  orca: 'Orca',
  camelot: 'Camelot',
  curve: 'Curve',
  cetus: 'Cetus',
};

/** Their dexId is a lowercase slug; present it the way the exchange writes it. */
function prettyDex(dexId: string, labels?: string[]): string {
  const name =
    DEX_NAMES[dexId.toLowerCase()] ??
    dexId
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const version = labels?.find((label) => /^v\d/i.test(label));
  return version ? `${name} ${version.toUpperCase()}` : name;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function windows<T>(
  source: Partial<Record<string, T>> | undefined,
  fallback: T,
): Windowed<T> {
  return {
    m5: source?.m5 ?? fallback,
    h1: source?.h1 ?? fallback,
    h6: source?.h6 ?? fallback,
    h24: source?.h24 ?? fallback,
  };
}

/**
 * Security signals the public API does not expose.
 *
 * DexScreener returns no contract-safety data, and inventing it would be worse
 * than useless — a fabricated "liquidity locked" badge on a real token is
 * actively dangerous. Everything is therefore reported as unknown, and the UI
 * renders an explicit "not available" state rather than a false pass or fail.
 */
function unknownSecurity(): SecuritySignals {
  return {
    liquidityLocked: false,
    liquidityLockedPct: 0,
    mintRenounced: false,
    ownershipRenounced: false,
    verifiedContract: false,
    topHolderPct: 0,
    sellTaxPct: 0,
    buyTaxPct: 0,
    available: false,
  };
}

function socialUrl(
  socials: WirePair['info'] extends infer I ? (I extends { socials?: infer S } ? S : never) : never,
  kind: string,
): string | undefined {
  const list = socials as Array<{ type?: string; platform?: string; url?: string; handle?: string }> | undefined;
  const match = list?.find(
    (entry) => (entry.type ?? entry.platform ?? '').toLowerCase() === kind,
  );
  if (!match) return undefined;
  if (match.url) return match.url;
  if (!match.handle) return undefined;
  return kind === 'twitter'
    ? `https://x.com/${match.handle}`
    : `https://t.me/${match.handle}`;
}

/** Convert one wire pair. Returns null for chains the app does not track. */
export function mapPair(wire: WirePair): Pair | null {
  const chain = toChainId(wire.chainId);
  if (!chain) return null;

  const priceUsd = num(wire.priceUsd);
  // A pair with no price is not renderable and not useful.
  if (priceUsd <= 0) return null;

  const baseToken: TokenRef = {
    address: wire.baseToken.address,
    name: wire.baseToken.name,
    symbol: wire.baseToken.symbol,
  };

  const txns = windows(wire.txns, { buys: 0, sells: 0 });

  return {
    // Chain + pair address is globally unique and stable across reloads, which
    // matters because it is the URL of every pair page.
    id: `${chain}-${wire.pairAddress}`,
    chain,
    dex: prettyDex(wire.dexId, wire.labels),
    pairAddress: wire.pairAddress,
    baseToken,
    quoteToken: {
      address: wire.quoteToken.address,
      name: wire.quoteToken.name,
      symbol: wire.quoteToken.symbol,
    },
    priceUsd,
    priceNative: num(wire.priceNative),
    change: windows(wire.priceChange, 0),
    volume: windows(wire.volume, 0),
    txns,
    // The API exposes no distinct-maker count; unique traders are not derivable
    // from transaction counts, so this is reported as unknown (-1) and the UI
    // prints a dash rather than a fabricated number.
    makers24h: -1,
    liquidityUsd: num(wire.liquidity?.usd),
    fdv: num(wire.fdv),
    marketCap: num(wire.marketCap, num(wire.fdv)),
    createdAt: wire.pairCreatedAt ?? 0,
    boosts: wire.boosts?.active ?? 0,
    // Filled in by the chart source; the pair endpoint carries no history.
    sparkline: [],
    security: unknownSecurity(),
    socials: {
      website: wire.info?.websites?.[0]?.url,
      twitter: socialUrl(wire.info?.socials, 'twitter'),
      telegram: socialUrl(wire.info?.socials, 'telegram'),
    },
    imageUrl: wire.info?.imageUrl,
  };
}

function mapMany(wire: WirePair[] | null | undefined): Pair[] {
  if (!wire) return [];
  const mapped: Pair[] = [];
  for (const entry of wire) {
    const pair = mapPair(entry);
    if (pair) mapped.push(pair);
  }
  return mapped;
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

/** Free-text search across tokens, symbols and pair addresses. */
export async function searchPairs(query: string): Promise<Pair[]> {
  const response = await getJson<SearchResponse>(
    `${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`,
  );
  return mapMany(response.pairs);
}

/** One pair by chain and pair address. */
export async function fetchPair(chain: ChainId, pairAddress: string): Promise<Pair | null> {
  const response = await getJson<SearchResponse>(
    `${BASE}/latest/dex/pairs/${chain}/${pairAddress}`,
  );
  return mapMany(response.pairs)[0] ?? null;
}

/** Every pool for one token. */
export async function fetchTokenPairs(chain: ChainId, tokenAddress: string): Promise<Pair[]> {
  const response = await getJson<WirePair[]>(
    `${BASE}/token-pairs/v1/${chain}/${tokenAddress}`,
  );
  return mapMany(response);
}

/**
 * Every pool for a set of token addresses on one chain.
 *
 * Looking a token up by contract is the only way to be certain which asset is
 * being priced. Ticker collisions on a DEX are routine and frequently
 * deliberate, so a symbol match is a guess and an address is not.
 *
 * The endpoint accepts up to 30 addresses per call.
 */
export async function fetchTokensByAddress(
  chain: ChainId,
  addresses: string[],
): Promise<Pair[]> {
  if (addresses.length === 0) return [];
  const response = await getJson<WirePair[]>(
    `${BASE}/tokens/v1/${chain}/${addresses.slice(0, 30).join(',')}`,
  );
  return mapMany(response);
}

interface BoostEntry {
  chainId: string;
  tokenAddress: string;
  amount?: number;
  totalAmount?: number;
}

/**
 * Currently boosted tokens, resolved to their pairs.
 *
 * This is the closest thing the public API has to a trending feed, and it is
 * how the board is populated without a hardcoded token list. Rate limited to 60
 * requests per minute, so it is polled far less often than the pairs endpoint.
 */
export async function fetchBoostedPairs(limit = 30): Promise<Pair[]> {
  const boosts = await getJson<BoostEntry[]>(`${BASE}/token-boosts/top/v1`);

  const wanted = boosts
    .filter((entry) => toChainId(entry.chainId))
    .slice(0, limit);

  // Group by chain so each chain costs one request rather than one per token.
  const byChain = new Map<ChainId, string[]>();
  for (const entry of wanted) {
    const chain = toChainId(entry.chainId)!;
    const bucket = byChain.get(chain) ?? [];
    // The multi-token endpoint accepts at most 30 addresses per call.
    if (bucket.length < 30) bucket.push(entry.tokenAddress);
    byChain.set(chain, bucket);
  }

  const results = await Promise.allSettled(
    [...byChain.entries()].map(([chain, addresses]) =>
      getJson<WirePair[]>(`${BASE}/tokens/v1/${chain}/${addresses.join(',')}`),
    ),
  );

  const pairs: Pair[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') pairs.push(...mapMany(result.value));
  }

  // One pool per token — the deepest, which is the one worth quoting.
  const best = new Map<string, Pair>();
  for (const pair of pairs) {
    const key = `${pair.chain}:${pair.baseToken.address.toLowerCase()}`;
    const incumbent = best.get(key);
    if (!incumbent || pair.liquidityUsd > incumbent.liquidityUsd) best.set(key, pair);
  }

  return [...best.values()];
}
