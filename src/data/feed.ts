/**
 * The live market feed.
 *
 * Composes the two data sources into one coherent stream:
 *
 *   1. Real Binance prices are applied to any pair whose base symbol is listed
 *      there — the majors on the board genuinely tick with the market.
 *   2. Everything else (the long tail, which has no centralised quote) is
 *      advanced by a bounded random walk, so the whole board feels alive rather
 *      than half-frozen.
 *
 * Adding a real on-chain source later means implementing `MarketSource` and
 * registering it here; no component changes.
 */

import { createRng } from '@/lib/seed';
import { BinanceTickerSource, type Ticker } from './sources/binance';
import { generatePairs } from './sources/mock';
import type { FeedStatus, Pair } from './types';

/** How often the simulated walk advances the long tail. */
const WALK_INTERVAL_MS = 1_500;
/** Fraction of long-tail pairs that move on any given tick. */
const WALK_SHARE = 0.22;

type PairsHandler = (pairs: Pair[]) => void;
type StatusHandler = (status: FeedStatus) => void;

export class MarketFeed {
  private pairs: Pair[];
  private walkTimer: ReturnType<typeof setInterval> | null = null;
  private binance: BinanceTickerSource | null = null;
  private rng = createRng('panscreener::walk');
  private started = false;
  /** Base symbols currently quoted by the exchange; these are never walked. */
  private liveSymbols = new Set<string>();

  private onPairs: PairsHandler;
  private onStatus: StatusHandler;

  constructor(onPairs: PairsHandler, onStatus: StatusHandler) {
    this.onPairs = onPairs;
    this.onStatus = onStatus;
    this.pairs = generatePairs();
  }

  /** The current board. Safe to read before `start()`. */
  snapshot(): Pair[] {
    return this.pairs;
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.binance = new BinanceTickerSource(
      (tickers) => this.applyTickers(tickers),
      (status) => this.onStatus(status),
    );
    this.binance.connect();

    this.walkTimer = setInterval(() => this.walk(), WALK_INTERVAL_MS);
  }

  stop() {
    this.started = false;
    if (this.walkTimer) {
      clearInterval(this.walkTimer);
      this.walkTimer = null;
    }
    this.binance?.dispose();
    this.binance = null;
  }

  /** Overlay real exchange prices onto the pairs that have them. */
  private applyTickers(tickers: Map<string, Ticker>) {
    // Remember which symbols the exchange is quoting, so the simulated walk
    // below knows to leave those pairs alone.
    this.liveSymbols = new Set(tickers.keys());
    let changed = false;

    this.pairs = this.pairs.map((pair) => {
      const key = pair.baseToken.symbol.replace(/^W/, '');
      const ticker = tickers.get(key);
      if (!ticker || ticker.priceUsd === pair.priceUsd) return pair;

      changed = true;
      return {
        ...pair,
        priceUsd: ticker.priceUsd,
        change: { ...pair.change, h24: ticker.change24h },
        // Keep the sparkline's final point honest against the new price.
        sparkline: [...pair.sparkline.slice(1), ticker.priceUsd],
      };
    });

    if (changed) this.onPairs(this.pairs);
  }

  /**
   * Advance a random slice of the long tail.
   *
   * Only pairs *without* a live quote are walked — otherwise a simulated step
   * would fight the real price arriving from the exchange. Step size scales
   * with the pair's own 24h volatility so a stablecoin pair does not jitter
   * like a fresh launch.
   */
  private walk() {
    const walkable: number[] = [];
    this.pairs.forEach((pair, index) => {
      // A pair is walkable unless the exchange is actively quoting it.
      if (!this.liveSymbols.has(pair.baseToken.symbol.replace(/^W/, ''))) {
        walkable.push(index);
      }
    });
    if (walkable.length === 0) return;

    const moved = new Set<number>();

    const target = Math.max(1, Math.floor(walkable.length * WALK_SHARE));
    for (let i = 0; i < target; i++) {
      moved.add(walkable[this.rng.int(0, walkable.length - 1)]);
    }
    if (moved.size === 0) return;

    this.pairs = this.pairs.map((pair, index) => {
      if (!moved.has(index)) return pair;

      const volatility = Math.min(0.06, Math.abs(pair.change.h24) / 100 / 60 + 0.0008);
      const step = this.rng.float(-1, 1) * volatility;
      const priceUsd = Math.max(1e-12, pair.priceUsd * (1 + step));
      const delta = step * 100;

      return {
        ...pair,
        priceUsd,
        change: {
          m5: Number((pair.change.m5 + delta).toFixed(3)),
          h1: Number((pair.change.h1 + delta * 0.5).toFixed(3)),
          h6: Number((pair.change.h6 + delta * 0.2).toFixed(3)),
          h24: Number((pair.change.h24 + delta * 0.1).toFixed(3)),
        },
        sparkline: [...pair.sparkline.slice(1), priceUsd],
      };
    });

    this.onPairs(this.pairs);
  }
}
