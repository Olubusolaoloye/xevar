/**
 * The curated watchlist ("SMC DAO").
 *
 * A list the operator controls that every visitor sees once, on their
 * watchlist, until they dismiss it. Stored in app settings as {symbol,
 * address} entries — see supabase/003_curated_watchlist.sql.
 *
 * The interesting problem here is the chain.
 *
 * Entries carry a contract address and no network, because the roster arrived
 * as bare addresses and every one of them is a 20-byte EVM address: the same
 * shape on BNB Chain, Ethereum, Base and Arbitrum alike. Picking a network to
 * store alongside each address would mean guessing, and a wrong guess is not a
 * blank row — it is a live price for a different token that happens to occupy
 * that address on the chain we picked. So resolution is delegated to the
 * market provider's cross-chain search, which is the only party that knows.
 *
 * Two sources, in order:
 *
 *   1. The board. If the admin has already listed the token, its pair is
 *      already streaming — reuse it and spend no request.
 *   2. Cross-chain search by address, for everything the board does not carry.
 *
 * Resolved chains are memoised for the session, so a list of eleven tokens
 * costs eleven requests once, not eleven on every poll.
 */

import { searchPairs } from './sources/dexscreener';
import type { Pair } from './types';

/**
 * Strip everything the provider says *about* a token, keeping what the pool
 * says about its price.
 *
 * A curated entry the admin has not listed has been through no review and paid
 * no fee, so it gets exactly what any unlisted contract gets: market data. The
 * logo, banner, description and outbound links are claims by whoever submitted
 * them to the provider, and the board withholds those until an admin has
 * approved the listing — see data/listingStatus.ts. A watchlist row is not a
 * loophole around that rule.
 *
 * Symbol and name stay: those are on-chain token metadata, not a claim.
 */
function stripUnvetted(pair: Pair): Pair {
  return {
    ...pair,
    imageUrl: undefined,
    coverUrl: undefined,
    blurb: undefined,
    socials: {},
  };
}

export interface CuratedEntry {
  /** Display label while the address resolves. Not an identity. */
  symbol: string;
  /** The identity. 0x-prefixed, 20 bytes. */
  address: string;
}

export interface CuratedRow {
  entry: CuratedEntry;
  /** The live pair, once resolved. Null while loading or if nothing matched. */
  pair: Pair | null;
}

/** An entry is only usable if the address is well formed. */
export function isValidEntry(entry: Partial<CuratedEntry>): entry is CuratedEntry {
  return (
    typeof entry.symbol === 'string' &&
    entry.symbol.trim().length > 0 &&
    typeof entry.address === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(entry.address.trim())
  );
}

/** Parse whatever came back from the settings row, discarding malformed rows. */
export function parseCuratedTokens(value: unknown): CuratedEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CuratedEntry[] = [];

  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = {
      symbol: String((raw as CuratedEntry).symbol ?? '').trim(),
      address: String((raw as CuratedEntry).address ?? '').trim(),
    };
    if (!isValidEntry(entry)) continue;

    // The same contract twice is one row, not two.
    const key = entry.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }

  return out;
}

/**
 * Find a board pair quoting this exact contract.
 *
 * Matched on address alone, across every chain on the board: the entry does
 * not name a chain, and the address is what identifies the token.
 */
export function matchOnBoard(address: string, board: Pair[]): Pair | null {
  const wanted = address.toLowerCase();
  const hits = board.filter((pair) => pair.baseToken.address.toLowerCase() === wanted);
  if (hits.length === 0) return null;
  return hits.reduce((best, pair) => (pair.liquidityUsd > best.liquidityUsd ? pair : best));
}

/**
 * Pick the pool worth quoting out of a search response.
 *
 * The search endpoint matches loosely — an address query can return pools that
 * merely mention it, including ones where the address is the *quote* side. So
 * the base token's address has to match exactly, and of what survives, the
 * deepest pool is the honest quote.
 */
export function chooseFromSearch(address: string, results: Pair[]): Pair | null {
  const wanted = address.toLowerCase();
  const exact = results.filter(
    (pair) => pair.baseToken.address.toLowerCase() === wanted,
  );
  if (exact.length === 0) return null;
  return exact.reduce((best, pair) => (pair.liquidityUsd > best.liquidityUsd ? pair : best));
}

/**
 * Session cache of address → resolved pair.
 *
 * Keyed by lowercased address. A null value is cached too: an address the
 * provider does not know is a permanent answer for this session, and retrying
 * it every fifteen seconds would burn the rate limit on a token that is not
 * coming back.
 */
const resolved = new Map<string, Pair | null>();
const inflight = new Map<string, Promise<Pair | null>>();

/** Drop the memo, so the next resolve re-asks the provider. */
export function clearCuratedCache() {
  resolved.clear();
  inflight.clear();
}

/**
 * A resolved curated pair by its id, without triggering a lookup.
 *
 * The token page reads the board, and a curated token the admin has not listed
 * is not on it. Without this, tapping a row on the curated watchlist lands on
 * "pair not found" — which is both wrong and the most obvious thing a visitor
 * will try. Synchronous and cache-only: if the list has not resolved yet there
 * is nothing to show, and the page falls through to its own empty state.
 */
export function peekCuratedPair(id: string): Pair | null {
  for (const pair of resolved.values()) {
    if (pair && pair.id === id) return pair;
  }
  return null;
}

async function resolveOne(address: string): Promise<Pair | null> {
  const key = address.toLowerCase();

  const memo = resolved.get(key);
  if (memo !== undefined) return memo;

  // Two components mounting at once must not fire the same search twice.
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = searchPairs(address)
    .then((results) => {
      const found = chooseFromSearch(address, results);
      const pair = found ? stripUnvetted(found) : null;
      resolved.set(key, pair);
      return pair;
    })
    .catch(() => {
      // A failed request is not an answer — leave it uncached so a recovered
      // connection resolves it rather than showing a permanent blank.
      return null;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/**
 * Resolve the whole list.
 *
 * Board hits cost nothing. Everything else is searched in parallel, and one
 * unreachable token leaves a single blank row rather than emptying the list.
 */
export async function resolveCuratedList(
  entries: CuratedEntry[],
  board: Pair[],
): Promise<CuratedRow[]> {
  const rows = await Promise.all(
    entries.map(async (entry): Promise<CuratedRow> => {
      const onBoard = matchOnBoard(entry.address, board);
      if (onBoard) return { entry, pair: onBoard };
      return { entry, pair: await resolveOne(entry.address) };
    }),
  );
  return rows;
}
