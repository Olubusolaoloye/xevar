import { create } from 'zustand';
import { MarketFeed } from '@/data/feed';
import { useRegistryStore } from '@/store/useRegistryStore';
import type { FeedStatus, Pair } from '@/data/types';

interface MarketState {
  pairs: Pair[];
  status: FeedStatus;
  /** Epoch ms of the last update pushed by the feed. */
  updatedAt: number;
  start: () => void;
  stop: () => void;
  /** Pull a fresh board immediately, outside the poll schedule. */
  refresh: () => void;
}

/**
 * A single feed instance is shared by the whole application. Mounting the
 * screener, a pair page and the watchlist simultaneously must not open three
 * websockets.
 */
let feed: MarketFeed | null = null;
let subscribers = 0;
let unsubscribeRegistry: (() => void) | null = null;

export const useMarketStore = create<MarketState>((set) => ({
  // Starts empty: the board is whatever the user tracks, and inventing
  // placeholder tokens would put fake prices beside their real ones.
  pairs: [],
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

    // Editing the tracked-token list must change the board straight away
    // rather than waiting out the poll interval.
    unsubscribeRegistry = useRegistryStore.subscribe((state, previous) => {
      if (state.tokens !== previous.tokens) feed?.refresh();
    });
  },

  stop: () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers > 0 || !feed) return;
    unsubscribeRegistry?.();
    unsubscribeRegistry = null;
    feed.stop();
    feed = null;
  },

  refresh: () => feed?.refresh(),
}));

/** Look up a single pair by id. */
export function selectPairById(id: string | undefined) {
  return (state: MarketState): Pair | undefined =>
    id ? state.pairs.find((pair) => pair.id === id) : undefined;
}
