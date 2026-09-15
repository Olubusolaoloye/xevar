import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chooseFromSearch,
  clearCuratedCache,
  isValidEntry,
  matchOnBoard,
  parseCuratedTokens,
  peekCuratedPair,
  resolveCuratedList,
} from './curatedList';
import type { Pair } from './types';

vi.mock('./sources/dexscreener', () => ({
  searchPairs: vi.fn(),
}));

import { searchPairs } from './sources/dexscreener';
const search = vi.mocked(searchPairs);

const WKC = '0x6Ec90334d89dBdc89E08A133271be3d104128Edb';
const DTG = '0xb1957BDbA889686EbdE631DF970ecE6A7571A1B6';

/** A pair with only the fields the resolver reads. */
function pair(
  chain: Pair['chain'],
  baseAddress: string,
  liquidityUsd: number,
  extra: Partial<Pair> = {},
): Pair {
  return {
    id: `${chain}:${baseAddress}:${liquidityUsd}`,
    chain,
    baseToken: { address: baseAddress, name: 'Token', symbol: 'TKN' },
    liquidityUsd,
    ...extra,
  } as unknown as Pair;
}

beforeEach(() => {
  clearCuratedCache();
  search.mockReset();
});

describe('isValidEntry', () => {
  it('accepts a ticker with a full 20-byte address', () => {
    expect(isValidEntry({ symbol: 'WKC', address: WKC })).toBe(true);
  });

  it('rejects a truncated address', () => {
    expect(isValidEntry({ symbol: 'WKC', address: '0x6Ec90334' })).toBe(false);
  });

  it('rejects an address with no 0x prefix', () => {
    expect(isValidEntry({ symbol: 'WKC', address: WKC.slice(2) })).toBe(false);
  });

  it('rejects an entry with no ticker', () => {
    expect(isValidEntry({ symbol: '  ', address: WKC })).toBe(false);
  });
});

describe('parseCuratedTokens', () => {
  it('returns nothing for a missing column', () => {
    // A project that has not run migration 003 sends back undefined. That has
    // to be an empty list, not a crash on every page load.
    expect(parseCuratedTokens(undefined)).toEqual([]);
    expect(parseCuratedTokens(null)).toEqual([]);
    expect(parseCuratedTokens('SMC DAO')).toEqual([]);
  });

  it('drops malformed rows rather than the whole list', () => {
    const parsed = parseCuratedTokens([
      { symbol: 'WKC', address: WKC },
      { symbol: 'BAD', address: 'not-an-address' },
      null,
      { symbol: 'DTG', address: DTG },
    ]);
    expect(parsed.map((e) => e.symbol)).toEqual(['WKC', 'DTG']);
  });

  it('collapses the same contract listed twice', () => {
    const parsed = parseCuratedTokens([
      { symbol: 'WKC', address: WKC },
      { symbol: 'WIKICAT', address: WKC.toLowerCase() },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].symbol).toBe('WKC');
  });
});

describe('matchOnBoard', () => {
  it('matches regardless of address casing', () => {
    const board = [pair('bsc', WKC.toLowerCase(), 100)];
    expect(matchOnBoard(WKC, board)).toBe(board[0]);
  });

  it('matches across chains, because the entry names none', () => {
    const board = [pair('base', WKC, 100)];
    expect(matchOnBoard(WKC, board)?.chain).toBe('base');
  });

  it('takes the deepest pool when the board carries several', () => {
    const board = [pair('bsc', WKC, 100), pair('bsc', WKC, 900)];
    expect(matchOnBoard(WKC, board)?.liquidityUsd).toBe(900);
  });

  it('returns null when nothing on the board holds that contract', () => {
    expect(matchOnBoard(WKC, [pair('bsc', DTG, 100)])).toBeNull();
  });
});

describe('chooseFromSearch', () => {
  it('ignores a pool where the address is the quote side', () => {
    // Search matches loosely. A pool quoting WKC/DTG comes back for a DTG
    // query too, and quoting its price as DTG's would be a wrong number.
    const results = [pair('bsc', WKC, 5_000)];
    expect(chooseFromSearch(DTG, results)).toBeNull();
  });

  it('takes the deepest exact match', () => {
    const results = [
      pair('bsc', WKC, 1_000),
      pair('bsc', WKC, 80_000),
      pair('ethereum', DTG, 900_000),
    ];
    expect(chooseFromSearch(WKC, results)?.liquidityUsd).toBe(80_000);
  });
});

describe('resolveCuratedList', () => {
  it('uses the board and spends no request when the token is listed', async () => {
    const board = [pair('bsc', WKC, 42)];
    const rows = await resolveCuratedList([{ symbol: 'WKC', address: WKC }], board);

    expect(rows[0].pair).toBe(board[0]);
    expect(search).not.toHaveBeenCalled();
  });

  it('takes the chain from the provider rather than assuming one', async () => {
    search.mockResolvedValue([pair('base', DTG, 10_000)]);
    const rows = await resolveCuratedList([{ symbol: 'DTG', address: DTG }], []);

    expect(rows[0].pair?.chain).toBe('base');
    expect(search).toHaveBeenCalledWith(DTG);
  });

  it('leaves one row blank rather than failing the whole list', async () => {
    search.mockImplementation(async (query: string) =>
      query === WKC ? [pair('bsc', WKC, 10)] : Promise.reject(new Error('down')),
    );

    const rows = await resolveCuratedList(
      [
        { symbol: 'WKC', address: WKC },
        { symbol: 'DTG', address: DTG },
      ],
      [],
    );

    expect(rows[0].pair).not.toBeNull();
    expect(rows[1].pair).toBeNull();
  });

  it('caches a resolved address for the session', async () => {
    search.mockResolvedValue([pair('bsc', WKC, 10)]);
    const entries = [{ symbol: 'WKC', address: WKC }];

    await resolveCuratedList(entries, []);
    await resolveCuratedList(entries, []);

    // Eleven tokens must cost eleven requests once, not eleven per poll.
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('retries an address whose lookup failed, instead of blanking it forever', async () => {
    search.mockRejectedValueOnce(new Error('offline'));
    search.mockResolvedValueOnce([pair('bsc', WKC, 10)]);
    const entries = [{ symbol: 'WKC', address: WKC }];

    expect((await resolveCuratedList(entries, []))[0].pair).toBeNull();
    expect((await resolveCuratedList(entries, []))[0].pair).not.toBeNull();
  });

  it('caches a genuine miss, which is a real answer', async () => {
    search.mockResolvedValue([]);
    const entries = [{ symbol: 'GHOST', address: DTG }];

    await resolveCuratedList(entries, []);
    await resolveCuratedList(entries, []);

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('keeps roster order, not response order', async () => {
    search.mockImplementation(async (query: string) =>
      query === WKC
        ? new Promise((r) => setTimeout(() => r([pair('bsc', WKC, 1)]), 10))
        : [pair('bsc', DTG, 1)],
    );

    const rows = await resolveCuratedList(
      [
        { symbol: 'WKC', address: WKC },
        { symbol: 'DTG', address: DTG },
      ],
      [],
    );

    expect(rows.map((r) => r.entry.symbol)).toEqual(['WKC', 'DTG']);
  });
});

describe('presentation gate', () => {
  it('withholds logo, banner, blurb and links from a token nobody listed', async () => {
    // Same rule as the board: a contract address buys market data, which is a
    // fact about a public pool. Everything else waits for a review.
    search.mockResolvedValue([
      pair('bsc', WKC, 10, {
        imageUrl: 'https://example.invalid/logo.png',
        coverUrl: 'https://example.invalid/banner.png',
        blurb: 'The best token',
        socials: { website: 'https://example.invalid', twitter: 'https://x.invalid' },
      } as Partial<Pair>),
    ]);

    const rows = await resolveCuratedList([{ symbol: 'WKC', address: WKC }], []);
    const resolvedPair = rows[0].pair!;

    expect(resolvedPair.imageUrl).toBeUndefined();
    expect(resolvedPair.coverUrl).toBeUndefined();
    expect(resolvedPair.blurb).toBeUndefined();
    expect(resolvedPair.socials).toEqual({});
    // Market data is untouched.
    expect(resolvedPair.liquidityUsd).toBe(10);
  });

  it('keeps an approved listing exactly as the board presents it', async () => {
    // A board hit has already been through listingPresentation, so its vetted
    // logo and links must survive rather than be stripped a second time.
    const listed = pair('bsc', WKC, 10, {
      imageUrl: 'https://example.invalid/approved.png',
      socials: { website: 'https://example.invalid' },
    } as Partial<Pair>);

    const rows = await resolveCuratedList([{ symbol: 'WKC', address: WKC }], [listed]);
    expect(rows[0].pair).toBe(listed);
  });
});

describe('peekCuratedPair', () => {
  it('finds a resolved pair by id for the token page', async () => {
    search.mockResolvedValue([pair('bsc', WKC, 10)]);
    const rows = await resolveCuratedList([{ symbol: 'WKC', address: WKC }], []);

    expect(peekCuratedPair(rows[0].pair!.id)?.id).toBe(rows[0].pair!.id);
  });

  it('returns null rather than guessing for an unknown id', () => {
    expect(peekCuratedPair('bsc:nope')).toBeNull();
  });
});
