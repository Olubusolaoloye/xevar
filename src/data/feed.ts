/**
 * The market feed.
 *
 * DexScreener is the single source of price. Every figure listed is the
 * real on-chain pool state for a pair the user chose to track.
 *
 * There used to be a Binance websocket overlaying centralised-exchange prices
 * on top. It has been removed, and deliberately so:
 *
 *   - A DEX pair's price *is* its pool price. Replacing it with a CEX quote for
 *     a same-named asset reports a number that does not exist in that pool.
 *   - The symbol match was worse than imprecise. It stripped a leading "W"
 *     from every ticker to turn WETH into ETH, which also turned WKC into KC —
 *     so a token could be repriced from an entirely unrelated listing that
 *     happened to share the shortened symbol.
 *
 * Sub-second ticks are not worth a wrong price.
 *
 * Every request goes through the stale-while-revalidate cache, so a slow
 * response, a rate limit, or a few seconds of lost connectivity keeps the last
 * good numbers on screen instead of emptying the board.
 */

import { extendSparkline } from '@/data/sparkline';
import { listingPresentation } from '@/data/listingStatus';
import { cached } from './cache';
import { fetchTokenPairs, fetchTokensByAddress, searchPairs } from './sources/dexscreener';
import { useAdminStore } from '@/store/useAdminStore';
import { useListingStore, type Listing } from '@/store/useListingStore';
import type { FeedStatus, Pair } from './types';

/** Values younger than this are served straight from cache. */
const FRESH_MS = 5_000;
/** Beyond this the cached board is too old to keep showing. */
const MAX_STALE_MS = 10 * 60_000;

/** The multi-token endpoint accepts at most this many addresses per call. */
const ADDRESS_BATCH = 30;

/** Pick the pool worth quoting: the pinned one, else the deepest. */
function choosePool(candidates: Pair[], token: Listing): Pair | null {
  if (candidates.length === 0) return null;

  if (token.pairAddress) {
    const pinned = candidates.find(
      (pair) => pair.pairAddress.toLowerCase() === token.pairAddress!.toLowerCase(),
    );
    if (pinned) return pinned;
  }

  return candidates.reduce((best, pair) =>
    pair.liquidityUsd > best.liquidityUsd ? pair : best,
  );
}

type PairsHandler = (pairs: Pair[]) => void;
type StatusHandler = (status: FeedStatus, detail?: { ageMs: number }) => void;

export class MarketFeed {
  private pairs: Pair[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private onVisibility: (() => void) | null = null;
  private everLoaded = false;
  /** Rolling observed prices per pair id, used to build real sparklines. */
  private history = new Map<string, number[]>();

  private onPairs: PairsHandler;
  private onStatus: StatusHandler;

  constructor(onPairs: PairsHandler, onStatus: StatusHandler) {
    this.onPairs = onPairs;
    this.onStatus = onStatus;
  }

  snapshot(): Pair[] {
    return this.pairs;
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.onStatus('connecting');
    void this.load();
    this.schedulePoll();

    // A hidden tab should not keep polling a rate-limited public API, but
    // coming back to a stale board is worse — so refresh immediately on
    // return rather than waiting out the next interval.
    this.onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void this.load(true);
        this.schedulePoll();
      } else if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop() {
    this.started = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.onVisibility) {
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.onVisibility = null;
    }
  }

  /** (Re)arm the poll at the interval currently configured in admin. */
  private schedulePoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    const seconds = useAdminStore.getState().pollSeconds;
    this.pollTimer = setInterval(() => void this.load(), seconds * 1000);
  }

  /** Force an immediate reload, ignoring the cache's freshness window. */
  refresh() {
    void this.load(true);
  }

  /** Pull a fresh board, falling back to the cache when the request fails. */
  private async load(immediate = false) {
    try {
      const { value, stale, ageMs } = await cached(
        'board',
        () => this.loadBoard(),
        { freshMs: immediate ? 0 : FRESH_MS, maxStaleMs: MAX_STALE_MS },
      );

      this.pruneHistory(value);
      this.pairs = value.map((pair) => this.withSparkline(pair));
      this.everLoaded = true;
      this.onPairs(this.pairs);
      this.onStatus(stale ? 'stale' : 'live', { ageMs });
    } catch {
      // Nothing cached and the request failed.
      if (this.everLoaded) {
        this.onStatus('offline');
      } else {
        this.reportUnavailable();
      }
    }
  }

  /**
   * Assemble the board from the listings.
   *
   * Only tokens the user has chosen appear. That is the whole point of a
   * curated board — a search-assembled one returns whatever happens to match a
   * ticker, which on a DEX is frequently an impostor with the same symbol.
   *
   * Tokens pinned to a contract address are fetched by address, which cannot
   * resolve to the wrong asset. Tokens with only a ticker are searched for and
   * the deepest pool on the requested chain is taken — a best effort, flagged
   * as unverified in the UI so it is never mistaken for a confirmed match.
   */
  private async loadBoard(): Promise<Pair[]> {
    const tokens = [...useListingStore.getState().tokens].sort(
      (a, b) => a.order - b.order,
    );
    if (tokens.length === 0) return [];

    const pinned = tokens.filter((t) => t.address);
    const unpinned = tokens.filter((t) => !t.address);

    // Group pinned tokens by chain so each chain costs one request.
    const byChain = new Map<Pair['chain'], string[]>();
    for (const token of pinned) {
      const bucket = byChain.get(token.chain) ?? [];
      if (bucket.length < ADDRESS_BATCH) bucket.push(token.address!);
      byChain.set(token.chain, bucket);
    }

    const requests: Array<Promise<{ token?: Listing; pairs: Pair[] }>> = [];

    for (const [chain, addresses] of byChain) {
      requests.push(
        fetchTokensByAddress(chain, addresses).then((pairs) => ({ pairs })),
      );
    }

    for (const token of unpinned) {
      requests.push(
        searchPairs(token.symbol).then((pairs) => ({
          token,
          // A ticker is not unique across chains, so the chain narrows it.
          pairs: pairs.filter(
            (pair) =>
              pair.chain === token.chain &&
              pair.baseToken.symbol.toUpperCase() === token.symbol.toUpperCase(),
          ),
        })),
      );
    }

    // `allSettled`: one unreachable token must not empty the whole board.
    const results = await Promise.allSettled(requests);

    // If every request failed, this is a feed outage — not a board with no
    // matches. Returning an empty array here would resolve successfully and be
    // reported as "Live" with nothing on screen, which states the opposite of
    // the truth. Throwing lets the caller fall back to cache and say "offline".
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    if (requests.length > 0 && succeeded === 0) {
      throw new Error('Every market request failed');
    }

    const pooled: Pair[] = [];
    const searched = new Map<string, Pair[]>();

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      if (result.value.token) {
        searched.set(result.value.token.id, result.value.pairs);
      } else {
        pooled.push(...result.value.pairs);
      }
    }

    const board: Pair[] = [];

    for (const token of tokens) {
      const candidates = token.address
        ? pooled.filter(
            (pair) =>
              pair.chain === token.chain &&
              pair.baseToken.address.toLowerCase() === token.address!.toLowerCase(),
          )
        : (searched.get(token.id) ?? []);

      const chosen = choosePool(candidates, token);
      if (!chosen) continue;

      /* Submitted presentation wins over provider metadata, field by field,
         so a blank override never wipes out something the provider did
         supply — but only once the listing is approved.

         Everything in `shown` is null until then. That is the whole gate: a
         contract address buys you market data, which is a fact about a public
         pool; a logo, a banner, a description and outbound links are claims by
         whoever submitted them, and they wait for a confirmed payment and a
         human review. */
      const shown = listingPresentation(token);

      board.push({
        ...chosen,
        baseToken: shown.label
          ? { ...chosen.baseToken, name: shown.label }
          : chosen.baseToken,
        imageUrl: shown.logoUrl ?? chosen.imageUrl,
        coverUrl: shown.coverUrl ?? undefined,
        blurb: shown.blurb ?? undefined,
        featured: Boolean(token.featured),
        socials: {
          website: shown.website ?? chosen.socials.website,
          twitter: shown.twitter ?? chosen.socials.twitter,
          telegram: shown.telegram ?? chosen.socials.telegram,
        },
        tracked: {
          tokenId: token.id,
          pinned: Boolean(token.address),
          verified: Boolean(token.verified),
          status: token.status ?? 'tracking',
        },
      });
    }

    // Featured listings lead the board regardless of the active sort.
    return [
      ...board.filter((p) => p.featured),
      ...board.filter((p) => !p.featured),
    ];
  }

  /**
   * Nothing usable came back.
   *
   * The board is left empty rather than filled with generated tokens. Showing
   * invented prices beside a user's real listings is exactly the
   * confusion this product must not create — the UI says the feed is
   * unavailable instead.
   */
  private reportUnavailable() {
    this.onPairs(this.pairs);
    this.onStatus(this.everLoaded ? 'stale' : 'offline');
  }

  /**
   * Attach a sparkline.
   *
   * DexScreener returns no price history, and fetching candles per row would
   * blow through GeckoTerminal's 30/min limit instantly. So the series is the
   * price implied by the 24h change, followed by every price this session has
   * actually observed — honest about direction and magnitude, if not shape.
   *
   * The construction rules, and the bugs behind them, live in ./sparkline.
   */
  private withSparkline(pair: Pair): Pair {
    const { observed, sparkline } = extendSparkline(
      this.history.get(pair.id) ?? [],
      pair.priceUsd,
      pair.change.h24,
    );
    this.history.set(pair.id, observed);
    return { ...pair, sparkline };
  }

  /**
   * Forget history for pairs no longer on the board.
   *
   * Without this the map grows for the life of the session every time a
   * listing is removed or renamed, holding price arrays nothing will read.
   */
  private pruneHistory(pairs: Pair[]) {
    if (this.history.size <= pairs.length) return;
    const live = new Set(pairs.map((p) => p.id));
    for (const id of this.history.keys()) {
      if (!live.has(id)) this.history.delete(id);
    }
  }

}
