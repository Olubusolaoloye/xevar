import { create } from 'zustand';
import { MarketFeed } from '@/data/feed';
import { generatePairs } from '@/data/sources/mock';
import type { FeedStatus, Pair } from '@/data/types';

interface MarketState {
  pairs: Pair[];
  status: FeedStatus;
  /** Epoch ms of the last update pushed by the feed. */
  updatedAt: number;
  start: () => void;
  stop: () => void;
}

/**
 * A single feed instance is shared by the whole application. Mounting the
 * screener, a pair page and the watchlist simultaneously must not open three
 * websockets.
 */
let feed: MarketFeed | null = null;
let subscribers = 0;

export const useMarketStore = create<MarketState>((set) => ({
  // Seeded board is available synchronously, so the first paint has real
  // content rather than a wall of skeletons.
  pairs: generatePairs(),
  status: 'connecting',
  updatedAt: Date.now(),

  start: () => {
    subscribers += 1;
    if (feed) return;

    feed = new MarketFeed(
      (pairs) => set({ pairs, updatedAt: Date.now() }),
      (status) => set({ status }),
    );
    feed.start();
  },

  stop: () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers > 0 || !feed) return;
    feed.stop();
    feed = null;
  },
}));

/** Look up a single pair by id. */
export function selectPairById(id: string | undefined) {
  return (state: MarketState): Pair | undefined =>
    id ? state.pairs.find((pair) => pair.id === id) : undefined;
}
