/**
 * Seeded market generator.
 *
 * Produces a complete, internally-coherent DEX market: pairs whose liquidity,
 * volume, transaction counts and volatility all relate to one another the way
 * they do on a real chain. A thin token with $9k of liquidity does not get
 * $40M of volume, and a three-hour-old pair is far more volatile than a
 * two-year-old blue chip.
 *
 * Everything derives from one seed string, so the market is byte-identical on
 * every reload — essential for designing against, and for demoing.
 */

import { createRng, type Rng } from '@/lib/seed';
import { CHAINS, CHAIN_IDS, DEXES_BY_CHAIN } from '../chains';
import type {
  Candle,
  ChainId,
  Pair,
  SecuritySignals,
  Trade,
  TxnCounts,
  Windowed,
} from '../types';

const MARKET_SEED = 'panscreener::market::v1';

/* -------------------------------------------------------------------------- */
/* Token vocabulary                                                           */
/* -------------------------------------------------------------------------- */

/** Established assets: deep liquidity, low volatility, long history. */
const BLUE_CHIPS: Array<{ name: string; symbol: string; price: number }> = [
  { name: 'Wrapped Ether', symbol: 'WETH', price: 3180 },
  { name: 'Wrapped Bitcoin', symbol: 'WBTC', price: 64200 },
  { name: 'Solana', symbol: 'SOL', price: 146.2 },
  { name: 'Chainlink', symbol: 'LINK', price: 14.8 },
  { name: 'Uniswap', symbol: 'UNI', price: 7.35 },
  { name: 'Aave', symbol: 'AAVE', price: 92.4 },
  { name: 'Lido DAO', symbol: 'LDO', price: 1.72 },
  { name: 'Arbitrum', symbol: 'ARB', price: 0.86 },
  { name: 'Optimism', symbol: 'OP', price: 1.64 },
  { name: 'Pendle', symbol: 'PENDLE', price: 4.31 },
  { name: 'Ethena', symbol: 'ENA', price: 0.52 },
  { name: 'Jupiter', symbol: 'JUP', price: 0.88 },
  { name: 'Jito', symbol: 'JTO', price: 2.16 },
  { name: 'Render', symbol: 'RENDER', price: 5.42 },
  { name: 'Curve DAO', symbol: 'CRV', price: 0.29 },
  { name: 'Maker', symbol: 'MKR', price: 1840 },
  { name: 'Synthetix', symbol: 'SNX', price: 1.93 },
  { name: 'Frax Share', symbol: 'FXS', price: 2.41 },
];

/** Morpheme pools for synthesising plausible long-tail token names. */
const PREFIXES = [
  'Based', 'Turbo', 'Hyper', 'Giga', 'Quantum', 'Neon', 'Astro', 'Nova',
  'Solar', 'Lunar', 'Cyber', 'Vector', 'Prism', 'Echo', 'Zenith', 'Apex',
  'Omni', 'Delta', 'Helix', 'Orbit', 'Rogue', 'Velvet', 'Iron', 'Golden',
];
const ROOTS = [
  'Doge', 'Pepe', 'Cat', 'Shiba', 'Frog', 'Ape', 'Bull', 'Wolf', 'Fox',
  'Panda', 'Tiger', 'Dragon', 'Phoenix', 'Kraken', 'Yeti', 'Ghost', 'Samurai',
  'Ninja', 'Wizard', 'Knight', 'Titan', 'Atlas', 'Nomad', 'Drift',
];
const SUFFIXES = [
  'Protocol', 'Network', 'Finance', 'Labs', 'AI', 'DAO', 'Chain', 'Swap',
  'Vault', 'Coin', 'Inu', 'Node', 'Core', 'Engine', 'Index',
];

/* -------------------------------------------------------------------------- */
/* Address synthesis                                                          */
/* -------------------------------------------------------------------------- */

const HEX = '0123456789abcdef';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function makeAddress(rng: Rng, chain: ChainId): string {
  if (CHAINS[chain].addressStyle === 'base58') {
    return Array.from({ length: 44 }, () => rng.pick(BASE58.split(''))).join('');
  }
  return `0x${Array.from({ length: 40 }, () => rng.pick(HEX.split(''))).join('')}`;
}

/* -------------------------------------------------------------------------- */
/* Metric synthesis                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Build the four rolling change windows from a single volatility parameter.
 *
 * The windows are *nested*, not independent: the 24h move contains the 6h move,
 * which contains the 1h, which contains the 5m. Generating them independently
 * is the classic tell of fake market data — you get a token up 400% in five
 * minutes but down 2% on the day.
 */
function buildChangeWindows(rng: Rng, volatility: number): Windowed<number> {
  const h24 = rng.float(-1, 1) * volatility * 100;
  const h6 = h24 * rng.float(0.25, 0.85) + rng.float(-1, 1) * volatility * 22;
  const h1 = h6 * rng.float(0.15, 0.6) + rng.float(-1, 1) * volatility * 9;
  const m5 = h1 * rng.float(0.08, 0.4) + rng.float(-1, 1) * volatility * 2.4;
  return {
    m5: Number(m5.toFixed(2)),
    h1: Number(h1.toFixed(2)),
    h6: Number(h6.toFixed(2)),
    h24: Number(h24.toFixed(2)),
  };
}

/**
 * Split 24h volume across the shorter windows. Volume is not uniform through
 * the day, so each window gets its own share of the daily figure plus noise,
 * while staying strictly ordered m5 < h1 < h6 < h24.
 */
function buildVolumeWindows(rng: Rng, volume24h: number): Windowed<number> {
  const h6 = volume24h * rng.float(0.18, 0.48);
  const h1 = h6 * rng.float(0.12, 0.42);
  const m5 = h1 * rng.float(0.04, 0.22);
  return { m5, h1, h6, h24: volume24h };
}

/**
 * Transaction counts, derived from volume and a plausible average trade size.
 * Buy/sell split is skewed by price direction — a token that is up on the day
 * genuinely does print more buys than sells.
 */
function buildTxnWindows(
  rng: Rng,
  volume: Windowed<number>,
  change24h: number,
): Windowed<TxnCounts> {
  const avgTradeUsd = rng.logFloat(45, 2400);
  // 0.5 is an even split; positive momentum pushes the buy share up.
  const buyShare = 0.5 + Math.tanh(change24h / 45) * 0.16 + rng.float(-0.05, 0.05);

  const split = (vol: number): TxnCounts => {
    const total = Math.max(0, Math.round(vol / avgTradeUsd));
    const buys = Math.round(total * buyShare);
    return { buys, sells: Math.max(0, total - buys) };
  };

  return {
    m5: split(volume.m5),
    h1: split(volume.h1),
    h6: split(volume.h6),
    h24: split(volume.h24),
  };
}

/**
 * Generate the row sparkline so that its endpoints agree with the reported 24h
 * change. A sparkline trending down beside a green +18% badge destroys trust in
 * every other number on the page.
 */
function buildSparkline(
  rng: Rng,
  currentPrice: number,
  change24h: number,
  points = 48,
): number[] {
  const startPrice = currentPrice / (1 + change24h / 100);
  const series: number[] = [];
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Ease the drift so the line has shape rather than being a straight ramp.
    const eased = progress * progress * (3 - 2 * progress);
    const trend = startPrice + (currentPrice - startPrice) * eased;
    const noise = 1 + rng.float(-1, 1) * 0.022;
    series.push(trend * noise);
  }
  // Pin the ends so the sparkline literally starts and finishes on the truth.
  series[0] = startPrice;
  series[points - 1] = currentPrice;
  return series;
}

function buildSecurity(rng: Rng, isBlueChip: boolean, ageHours: number): SecuritySignals {
  // Trust signals accrue with age and are near-guaranteed for established assets.
  const maturity = Math.min(1, ageHours / (24 * 30));
  const good = isBlueChip ? 1 : maturity * 0.7 + rng.next() * 0.3;

  const locked = isBlueChip || good > 0.45;
  return {
    liquidityLocked: locked,
    liquidityLockedPct: locked ? rng.float(72, 100) : rng.float(0, 38),
    mintRenounced: isBlueChip || good > 0.5,
    ownershipRenounced: isBlueChip || good > 0.55,
    verifiedContract: isBlueChip || good > 0.35,
    topHolderPct: isBlueChip ? rng.float(8, 24) : rng.float(14, 68),
    sellTaxPct: isBlueChip || good > 0.6 ? 0 : rng.float(0, 9),
    buyTaxPct: isBlueChip || good > 0.6 ? 0 : rng.float(0, 6),
  };
}

/* -------------------------------------------------------------------------- */
/* Pair generation                                                            */
/* -------------------------------------------------------------------------- */

function makePair(rng: Rng, index: number): Pair {
  const chain = rng.pick(CHAIN_IDS);
  const chainMeta = CHAINS[chain];
  const dex = rng.pick(DEXES_BY_CHAIN[chain]);

  // Roughly a fifth of the board is established assets; the rest is long tail.
  const isBlueChip = index < BLUE_CHIPS.length && rng.chance(0.92);

  let name: string;
  let symbol: string;
  let priceUsd: number;
  let ageHours: number;
  let liquidityUsd: number;
  let volatility: number;

  if (isBlueChip) {
    const asset = BLUE_CHIPS[index % BLUE_CHIPS.length];
    name = asset.name;
    symbol = asset.symbol;
    priceUsd = asset.price * rng.float(0.97, 1.03);
    ageHours = rng.float(24 * 180, 24 * 900);
    liquidityUsd = rng.logFloat(2_400_000, 88_000_000);
    volatility = rng.float(0.02, 0.09);
  } else {
    const usePrefix = rng.chance(0.55);
    const useSuffix = rng.chance(0.45);
    const root = rng.pick(ROOTS);
    name = [usePrefix ? rng.pick(PREFIXES) : null, root, useSuffix ? rng.pick(SUFFIXES) : null]
      .filter(Boolean)
      .join(' ');
    symbol = name
      .split(' ')
      .map((word) => word.slice(0, root.length > 4 ? 4 : 3))
      .join('')
      .toUpperCase()
      .slice(0, 7);
    priceUsd = rng.logFloat(0.0000000042, 3.8);
    ageHours = rng.logFloat(0.4, 24 * 400);
    // Liquidity is the strongest predictor of everything else downstream.
    liquidityUsd = rng.logFloat(3_200, 4_800_000);
    // Young, thin tokens swing hardest.
    const youth = Math.max(0, 1 - ageHours / (24 * 30));
    volatility = rng.float(0.08, 0.55) + youth * 0.85;
  }

  const change = buildChangeWindows(rng, volatility);

  // Turnover: thin tokens churn their liquidity many times a day, deep pools
  // far less. This is what makes the volume column believable.
  const turnover = isBlueChip ? rng.float(0.08, 1.6) : rng.logFloat(0.15, 14);
  const volume24h = liquidityUsd * turnover;
  const volume = buildVolumeWindows(rng, volume24h);
  const txns = buildTxnWindows(rng, volume, change.h24);

  // Market cap is anchored to liquidity by a plausible float ratio rather than
  // drawn independently, so the two columns never contradict each other.
  const marketCap = liquidityUsd * (isBlueChip ? rng.float(6, 40) : rng.logFloat(2.2, 60));
  const fdv = marketCap * rng.float(1, isBlueChip ? 1.35 : 3.2);

  const createdAt = Date.now() - ageHours * 3600 * 1000;
  const address = makeAddress(rng, chain);
  const slug = `${chain}-${symbol.toLowerCase()}-${index}`;

  return {
    id: slug,
    chain,
    dex,
    pairAddress: makeAddress(rng, chain),
    baseToken: { address, name, symbol },
    quoteToken: {
      address: makeAddress(rng, chain),
      name: chainMeta.native,
      symbol: rng.chance(0.35) ? 'USDC' : chainMeta.native,
    },
    priceUsd,
    priceNative: priceUsd / (chainMeta.native === 'ETH' ? 3180 : chainMeta.native === 'SOL' ? 146 : 580),
    change,
    volume,
    txns,
    makers24h: Math.round((txns.h24.buys + txns.h24.sells) * rng.float(0.18, 0.62)),
    liquidityUsd,
    fdv,
    marketCap,
    createdAt,
    boosts: rng.chance(0.16) ? rng.int(1, 500) : 0,
    sparkline: buildSparkline(rng, priceUsd, change.h24),
    security: buildSecurity(rng, isBlueChip, ageHours),
    socials: {
      website: rng.chance(0.7) ? `https://${symbol.toLowerCase()}.xyz` : undefined,
      twitter: rng.chance(0.8) ? `https://x.com/${symbol.toLowerCase()}` : undefined,
      telegram: rng.chance(0.5) ? `https://t.me/${symbol.toLowerCase()}` : undefined,
    },
  };
}

/** The full generated board. Computed once, memoised for the session. */
let cachedPairs: Pair[] | null = null;

export function generatePairs(count = 160): Pair[] {
  if (cachedPairs) return cachedPairs;

  const rng = createRng(MARKET_SEED);
  const pairs = Array.from({ length: count }, (_, i) => makePair(rng, i));

  // Trending is a composite of short-term momentum and short-term volume —
  // the same intuition a real screener's trending tab encodes.
  const scored = pairs.map((pair) => ({
    pair,
    score:
      Math.log10(Math.max(1, pair.volume.h1)) * 1.8 +
      pair.change.h1 * 0.08 +
      pair.change.m5 * 0.04 +
      pair.boosts * 0.01,
  }));
  scored.sort((a, b) => b.score - a.score);
  scored.slice(0, 24).forEach((entry, i) => {
    entry.pair.trendingRank = i + 1;
  });

  cachedPairs = pairs;
  return pairs;
}

/* -------------------------------------------------------------------------- */
/* Derived series                                                             */
/* -------------------------------------------------------------------------- */

/**
 * OHLC history for a pair, walked *backwards* from the current price so the
 * final candle closes exactly at the price shown everywhere else in the UI.
 */
export function generateCandles(pair: Pair, bars = 160): Candle[] {
  const rng = createRng(`${pair.id}::candles`);
  const volatility = Math.min(0.2, Math.abs(pair.change.h24) / 100 / 8 + 0.006);

  const closes: number[] = [pair.priceUsd];
  for (let i = 1; i < bars; i++) {
    const drift = 1 - pair.change.h24 / 100 / bars;
    closes.push(closes[i - 1] * drift * (1 + rng.float(-1, 1) * volatility));
  }
  closes.reverse();

  const barMs = 15 * 60 * 1000;
  const start = Date.now() - bars * barMs;

  return closes.map((close, i) => {
    const open = i === 0 ? close * (1 + rng.float(-1, 1) * volatility) : closes[i - 1];
    const spread = Math.abs(close - open) + close * volatility * rng.float(0.2, 1.1);
    return {
      time: start + i * barMs,
      open,
      close,
      high: Math.max(open, close) + spread * rng.float(0, 0.6),
      low: Math.min(open, close) - spread * rng.float(0, 0.6),
      volume: pair.volume.h24 / (bars / 4) * rng.float(0.25, 2.4),
    };
  });
}

/** A plausible recent tape for the pair, newest first. */
export function generateTrades(pair: Pair, count = 40): Trade[] {
  const rng = createRng(`${pair.id}::trades`);
  const buyShare = 0.5 + Math.tanh(pair.change.h1 / 40) * 0.18;
  const avgTradeUsd = Math.max(12, pair.volume.h1 / Math.max(1, pair.txns.h1.buys + pair.txns.h1.sells));

  let timestamp = Date.now();
  return Array.from({ length: count }, (_, i) => {
    // Busier pairs print more often — gap scales inversely with trade count.
    const gapMs = rng.logFloat(900, 90_000) / Math.max(1, Math.log10(pair.volume.h24));
    timestamp -= gapMs;

    const side: 'buy' | 'sell' = rng.chance(buyShare) ? 'buy' : 'sell';
    const valueUsd = avgTradeUsd * rng.logFloat(0.12, 9);
    const priceUsd = pair.priceUsd * (1 + rng.float(-1, 1) * 0.004);

    return {
      id: `${pair.id}-trade-${i}`,
      timestamp,
      side,
      priceUsd,
      amount: valueUsd / priceUsd,
      valueUsd,
      maker: makeAddress(rng, pair.chain),
    };
  });
}
