import { describe, expect, it } from 'vitest';
import { mapPair } from './dexscreener';

/**
 * A representative DexScreener pair payload.
 *
 * This is the highest-risk mapping in the app: if a field name or a type is
 * wrong, the board renders empty or silently wrong on the first real request.
 * Pinning the wire shape here catches that without needing network access.
 *
 * Note the deliberate awkwardness of the real format — prices arrive as
 * strings, several fields are optional, and `txns`/`volume`/`priceChange` are
 * partial records that can be missing individual windows.
 */
const WIRE = {
  chainId: 'solana',
  dexId: 'raydium',
  url: 'https://dexscreener.com/solana/abc',
  pairAddress: 'PAIR123',
  labels: ['v4'],
  baseToken: { address: 'BASE123', name: 'Example Token', symbol: 'EXMPL' },
  quoteToken: { address: 'QUOTE123', name: 'Wrapped SOL', symbol: 'SOL' },
  priceNative: '0.0000001234',
  priceUsd: '0.00002468',
  txns: {
    m5: { buys: 3, sells: 1 },
    h1: { buys: 40, sells: 22 },
    h6: { buys: 210, sells: 180 },
    h24: { buys: 900, sells: 740 },
  },
  volume: { m5: 1200, h1: 18_000, h6: 96_000, h24: 410_000 },
  priceChange: { m5: 1.2, h1: -3.4, h6: 12.5, h24: 48.9 },
  liquidity: { usd: 250_000, base: 1e10, quote: 900 },
  fdv: 24_680_000,
  marketCap: 12_340_000,
  pairCreatedAt: 1_700_000_000_000,
  info: {
    imageUrl: 'https://example.com/logo.png',
    websites: [{ url: 'https://example.com' }],
    socials: [
      { type: 'twitter', handle: 'exampletoken' },
      { type: 'telegram', url: 'https://t.me/exampletoken' },
    ],
  },
  boosts: { active: 12 },
};

describe('mapPair', () => {
  it('maps a full payload onto the domain model', () => {
    const pair = mapPair(WIRE)!;
    expect(pair).not.toBeNull();

    // Price fields arrive as strings and must become numbers.
    expect(pair.priceUsd).toBeCloseTo(0.00002468, 12);
    expect(pair.priceNative).toBeCloseTo(0.0000001234, 12);

    expect(pair.chain).toBe('solana');
    expect(pair.baseToken.symbol).toBe('EXMPL');
    expect(pair.quoteToken.symbol).toBe('SOL');

    // The id must be stable and unique — it is the pair page's URL.
    expect(pair.id).toBe('solana-PAIR123');

    expect(pair.change).toEqual({ m5: 1.2, h1: -3.4, h6: 12.5, h24: 48.9 });
    expect(pair.volume.h24).toBe(410_000);
    expect(pair.txns.h24).toEqual({ buys: 900, sells: 740 });

    expect(pair.liquidityUsd).toBe(250_000);
    expect(pair.marketCap).toBe(12_340_000);
    expect(pair.fdv).toBe(24_680_000);
    expect(pair.createdAt).toBe(1_700_000_000_000);
    expect(pair.boosts).toBe(12);
    expect(pair.imageUrl).toBe('https://example.com/logo.png');
  });

  it('renders the dex id the way a human writes it', () => {
    expect(mapPair(WIRE)!.dex).toBe('Raydium V4');
    // Brand casing must survive: "Pancakeswap" is a misspelling.
    expect(mapPair({ ...WIRE, dexId: 'pancakeswap', labels: ['v3'] })!.dex).toBe(
      'PancakeSwap V3',
    );
    expect(mapPair({ ...WIRE, dexId: 'sushiswap', labels: undefined })!.dex).toBe('SushiSwap');
    expect(mapPair({ ...WIRE, dexId: 'uniswap', labels: undefined })!.dex).toBe('Uniswap');
  });

  it('builds social links from either a handle or a url', () => {
    const pair = mapPair(WIRE)!;
    expect(pair.socials.twitter).toBe('https://x.com/exampletoken');
    expect(pair.socials.telegram).toBe('https://t.me/exampletoken');
    expect(pair.socials.website).toBe('https://example.com');
  });

  it('reports contract safety as unavailable rather than as a failure', () => {
    // The API exposes no safety data. Claiming a token failed every check
    // would be worse than saying nothing.
    expect(mapPair(WIRE)!.security.available).toBe(false);
  });

  it('reports maker count as unknown rather than inventing one', () => {
    expect(mapPair(WIRE)!.makers24h).toBe(-1);
  });

  it('drops pairs on chains the app does not track', () => {
    expect(mapPair({ ...WIRE, chainId: 'fantom' })).toBeNull();
  });

  it('drops pairs with no usable price', () => {
    expect(mapPair({ ...WIRE, priceUsd: undefined })).toBeNull();
    expect(mapPair({ ...WIRE, priceUsd: '0' })).toBeNull();
    expect(mapPair({ ...WIRE, priceUsd: 'not-a-number' })).toBeNull();
  });

  it('survives a payload with every optional field missing', () => {
    const sparse = {
      chainId: 'base',
      dexId: 'aerodrome',
      pairAddress: 'P2',
      baseToken: { address: 'B', name: 'B', symbol: 'B' },
      quoteToken: { address: 'Q', name: 'Q', symbol: 'Q' },
      priceUsd: '1.5',
    };

    const pair = mapPair(sparse)!;
    expect(pair).not.toBeNull();
    expect(pair.priceUsd).toBe(1.5);
    // Missing windows must become zeroes, never undefined — the table does
    // arithmetic on these and NaN would propagate everywhere.
    expect(pair.change).toEqual({ m5: 0, h1: 0, h6: 0, h24: 0 });
    expect(pair.volume).toEqual({ m5: 0, h1: 0, h6: 0, h24: 0 });
    expect(pair.txns.m5).toEqual({ buys: 0, sells: 0 });
    expect(pair.liquidityUsd).toBe(0);
    expect(pair.boosts).toBe(0);
    expect(pair.socials.website).toBeUndefined();
  });

  it('falls back to FDV when market cap is absent', () => {
    const pair = mapPair({ ...WIRE, marketCap: undefined })!;
    expect(pair.marketCap).toBe(24_680_000);
  });
});
