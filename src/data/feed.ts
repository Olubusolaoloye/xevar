/**
 * The market feed.
 *
 * Composes the real providers into one board:
 *
 *   1. DexScreener supplies the pairs — real price, liquidity, volume, txns
 *      and market cap across every tracked chain. Free, keyless, ~300 req/min.
 *   2. Binance's websocket overlays sub-second prices on the majors, so the
 *      board keeps moving between polls instead of stepping once per interval.
 *   3. The seeded generator is a last resort, used only when the API has never
 *      answered — and the UI says so plainly rather than passing it off as real.
 *
 * Every request goes through the stale-while-revalidate cache, so a slow
 * response, a rate limit, or a few seconds of lost connectivity keeps the last
 * good numbers on screen instead of emptying the board.
 */

import { cached } from './cache';
import { BinanceTickerSource, type Ticker } from './sources/binance';
import { fetchBoostedPairs, searchPairs } from './sources/dexscreener';
import { generatePairs } from './sources/mock';
import type { FeedStatus, Pair } from './types';

/** How often the board is refreshed from DexScreener. */
const POLL_INTERVAL_MS = 30_000;
/** Values younger than this are served straight from cache. */
const FRESH_MS = 20_000;
/** Beyond this the cached board is too old to keep showing. */
const MAX_STALE_MS = 10 * 60_000;

/**
 * DexScreener has no "list every pair" endpoint, so the board is assembled
 * from the boosted/trending feed plus searches for the major quote assets —
 * which is what surfaces the deepest, most-traded pools on each chain.
 */
const SEED_QUERIES = ['SOL', 'WETH', 'USDC', 'WBNB', 'cbBTC', 'ARB'];

type PairsHandler = (pairs: Pair[]) => void;
type StatusHandler = (status: FeedStatus, detail?: { ageMs: number }) => void;

export class MarketFeed {
  private pairs: Pair[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private binance: BinanceTickerSource | null = null;
  private started = false;
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
    void this.refresh();

    this.pollTimer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);

    // Majors only; everything else moves on the poll.
    this.binance = new BinanceTickerSource(
      (tickers) => this.applyTickers(tickers),
      () => {
        // The websocket is an enhancement, not the source of truth — its
        // connection state must not override what the board actually knows.
      },
    );
    this.binance.connect();
  }

  stop() {
    this.started = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.binance?.dispose();
    this.binance = null;
  }

  /** Pull a fresh board, falling back through cache and then to seeded data. */
  private async refresh() {
    try {
      const { value, stale, ageMs } = await cached(
        'board',
        () => this.loadBoard(),
        { freshMs: FRESH_MS, maxStaleMs: MAX_STALE_MS },
      );

      if (value.length === 0) {
        this.fallBackToSeeded();
        return;
      }

      this.pairs = value.map((pair) => this.withSparkline(pair));
      this.everLoaded = true;
      this.onPairs(this.pairs);
      this.onStatus(stale ? 'stale' : 'live', { ageMs });
    } catch {
      // Nothing cached and the request failed.
      if (this.everLoaded) {
        this.onStatus('offline');
      } else {
        this.fallBackToSeeded();
      }
    }
  }

  /** Assemble the board from the boosted feed plus the major-asset searches. */
  private async loadBoard(): Promise<Pair[]> {
    const requests = [
      fetchBoostedPairs(30),
      ...SEED_QUERIES.map((query) => searchPairs(query)),
    ];

    // `allSettled`, not `all`: one failing query must not lose the whole board.
    const results = await Promise.allSettled(requests);

    const seen = new Map<string, Pair>();
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const pair of result.value) {
        const incumbent = seen.get(pair.id);
        if (!incumbent || pair.liquidityUsd > incumbent.liquidityUsd) {
          seen.set(pair.id, pair);
        }
      }
    }

    // Dust pools make the board unusable and are never tradeable.
    return [...seen.values()]
      .filter((pair) => pair.liquidityUsd >= 1_000)
      .sort((a, b) => b.volume.h24 - a.volume.h24);
  }

  private fallBackToSeeded() {
    if (this.pairs.length === 0) this.pairs = generatePairs();
    this.onPairs(this.pairs);
    this.onStatus('seeded');
  }

  /**
   * Attach a sparkline.
   *
   * DexScreener returns no price history, and fetching candles per row would
   * blow through GeckoTerminal's 30/min limit instantly. So the line starts as
   * a two-point interpolation between the price implied by the 24h change and
   * the current price — honest about direction and magnitude, if not shape —
   * and fills in with genuinely observed prices as the feed polls.
   */
  private withSparkline(pair: Pair): Pair {
    const observed = this.history.get(pair.id) ?? [];
    observed.push(pair.priceUsd);
    // Cap the rolling window so a long session cannot grow this without bound.
    if (observed.length > 48) observed.shift();
    this.history.set(pair.id, observed);

    if (observed.length >= 3) return { ...pair, sparkline: observed };

    const opening = pair.priceUsd / (1 + pair.change.h24 / 100);
    return { ...pair, sparkline: [opening, ...observed] };
  }

  /** Overlay live exchange prices on the pairs the exchange actually quotes. */
  private applyTickers(tickers: Map<string, Ticker>) {
    if (this.pairs.length === 0) return;
    let changed = false;

    this.pairs = this.pairs.map((pair) => {
      const ticker = tickers.get(pair.baseToken.symbol.replace(/^W/, '').toUpperCase());
      if (!ticker || ticker.priceUsd === pair.priceUsd) return pair;

      changed = true;
      return { ...pair, priceUsd: ticker.priceUsd };
    });

    if (changed) this.onPairs(this.pairs);
  }
}
