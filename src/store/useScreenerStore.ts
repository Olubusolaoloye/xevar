import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChainId,
  ScreenerFilters,
  SortDirection,
  SortKey,
  Timeframe,
} from '@/data/types';

/** A filter set with nothing applied — also the "reset" target. */
export const EMPTY_FILTERS: ScreenerFilters = {
  chains: [],
  dexes: [],
  search: '',
  minLiquidity: null,
  maxLiquidity: null,
  minVolume24h: null,
  minMarketCap: null,
  maxMarketCap: null,
  maxAgeHours: null,
  minTxns24h: null,
  liquidityLockedOnly: false,
};

/**
 * Curated one-click filter sets. These encode the questions traders actually
 * ask, which is far more useful than making someone assemble six numeric
 * thresholds by hand.
 */
export interface Preset {
  id: string;
  label: string;
  description: string;
  filters: Partial<ScreenerFilters>;
  sortKey: SortKey;
  sortDirection: SortDirection;
  timeframe: Timeframe;
}

export const PRESETS: Preset[] = [
  {
    id: 'trending',
    label: 'Trending',
    description: 'Momentum and volume over the last hour',
    filters: { minLiquidity: 25_000 },
    sortKey: 'trending',
    sortDirection: 'desc',
    timeframe: 'h1',
  },
  {
    id: 'new',
    label: 'New pairs',
    description: 'Launched in the last 24 hours',
    filters: { maxAgeHours: 24, minLiquidity: 5_000 },
    sortKey: 'createdAt',
    sortDirection: 'desc',
    timeframe: 'm5',
  },
  {
    id: 'gainers',
    label: 'Gainers',
    description: 'Biggest 24-hour moves with real liquidity',
    filters: { minLiquidity: 50_000, minVolume24h: 100_000 },
    sortKey: 'change',
    sortDirection: 'desc',
    timeframe: 'h24',
  },
  {
    id: 'losers',
    label: 'Losers',
    description: 'Steepest 24-hour drawdowns',
    filters: { minLiquidity: 50_000, minVolume24h: 100_000 },
    sortKey: 'change',
    sortDirection: 'asc',
    timeframe: 'h24',
  },
  {
    id: 'volume',
    label: 'Top volume',
    description: 'Most traded pairs across every chain',
    filters: {},
    sortKey: 'volume',
    sortDirection: 'desc',
    timeframe: 'h24',
  },
  {
    id: 'safe',
    label: 'Liquidity locked',
    description: 'Deep pools with locked or burned liquidity',
    filters: { liquidityLockedOnly: true, minLiquidity: 250_000 },
    sortKey: 'liquidityUsd',
    sortDirection: 'desc',
    timeframe: 'h24',
  },
];

interface ScreenerState extends ScreenerFilters {
  sortKey: SortKey;
  sortDirection: SortDirection;
  timeframe: Timeframe;
  activePreset: string | null;
  /** Row density — traders scanning hundreds of rows want `compact`. */
  density: 'comfortable' | 'compact';

  watchlist: string[];

  setSearch: (search: string) => void;
  toggleChain: (chain: ChainId) => void;
  toggleDex: (dex: string) => void;
  setFilter: <K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) => void;
  setSort: (key: SortKey) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  applyPreset: (preset: Preset) => void;
  resetFilters: () => void;
  setDensity: (density: 'comfortable' | 'compact') => void;

  toggleWatch: (pairId: string) => void;
  isWatched: (pairId: string) => boolean;
}

export const useScreenerStore = create<ScreenerState>()(
  persist(
    (set, get) => ({
      ...EMPTY_FILTERS,
      sortKey: 'trending',
      sortDirection: 'desc',
      timeframe: 'h24',
      activePreset: 'trending',
      density: 'comfortable',
      watchlist: [],

      setSearch: (search) => set({ search }),

      toggleChain: (chain) =>
        set((state) => ({
          activePreset: null,
          chains: state.chains.includes(chain)
            ? state.chains.filter((c) => c !== chain)
            : [...state.chains, chain],
        })),

      toggleDex: (dex) =>
        set((state) => ({
          activePreset: null,
          dexes: state.dexes.includes(dex)
            ? state.dexes.filter((d) => d !== dex)
            : [...state.dexes, dex],
        })),

      setFilter: (key, value) => set({ [key]: value, activePreset: null } as never),

      /** Clicking the active column flips direction; a new column starts desc. */
      setSort: (key) =>
        set((state) => ({
          activePreset: null,
          sortKey: key,
          sortDirection:
            state.sortKey === key && state.sortDirection === 'desc' ? 'asc' : 'desc',
        })),

      setTimeframe: (timeframe) => set({ timeframe }),

      applyPreset: (preset) =>
        set({
          ...EMPTY_FILTERS,
          ...preset.filters,
          // Search is a user's own text; a preset should never clear it.
          search: get().search,
          sortKey: preset.sortKey,
          sortDirection: preset.sortDirection,
          timeframe: preset.timeframe,
          activePreset: preset.id,
        }),

      resetFilters: () => set({ ...EMPTY_FILTERS, search: get().search, activePreset: null }),

      setDensity: (density) => set({ density }),

      toggleWatch: (pairId) =>
        set((state) => ({
          watchlist: state.watchlist.includes(pairId)
            ? state.watchlist.filter((id) => id !== pairId)
            : [...state.watchlist, pairId],
        })),

      isWatched: (pairId) => get().watchlist.includes(pairId),
    }),
    {
      name: 'panscreener.screener',
      // Only durable preferences survive a reload; transient filter state does
      // not, so every session opens on a clean, predictable board.
      partialize: (state) => ({
        watchlist: state.watchlist,
        density: state.density,
        timeframe: state.timeframe,
      }),
    },
  ),
);
