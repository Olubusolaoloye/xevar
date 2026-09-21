import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'NGN';

/** Display-only conversion rates against USD. */
export const CURRENCY_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1580,
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
};

/**
 * Three states, not two. "system" follows the OS and is the default, which is
 * why it stamps nothing on the root and lets the media query decide.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** Where the pair page's price chart comes from. */
export type ChartSource = 'tradingview' | 'builtin';

interface PrefsState {
  theme: ThemeChoice;
  currency: Currency;
  /** Collapse the desktop navigation rail to icons only. */
  railCollapsed: boolean;
  /** Suppress the live tick flash animation on table rows. */
  reduceFlash: boolean;
  /**
   * Whether this device has dismissed the curated watchlist.
   *
   * Per-device on purpose. The list is meant to greet a first-time visitor,
   * and most of them have no account — tying dismissal to one would mean
   * either showing it forever to signed-out users or asking them to register
   * to make something go away. It is restorable from Settings.
   */
  curatedDismissed: boolean;
  /**
   * Which chart the pair page draws.
   *
   * TradingView by default: it fetches its own history, so it is immune to
   * every way our own chart provider can fail. The built-in chart stays
   * available because TradingView does not carry every micro-cap pool, and a
   * symbol it has never heard of renders its notice, not ours.
   */
  chartSource: ChartSource;
  setChartSource: (source: ChartSource) => void;
  setTheme: (theme: ThemeChoice) => void;
  setCurrency: (currency: Currency) => void;
  toggleRail: () => void;
  setReduceFlash: (value: boolean) => void;
  setCuratedDismissed: (value: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      currency: 'USD',
      railCollapsed: false,
      reduceFlash: false,
      curatedDismissed: false,
      chartSource: 'tradingview',
      setChartSource: (chartSource) => set({ chartSource }),
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      toggleRail: () => set((state) => ({ railCollapsed: !state.railCollapsed })),
      setReduceFlash: (reduceFlash) => set({ reduceFlash }),
      setCuratedDismissed: (curatedDismissed) => set({ curatedDismissed }),
    }),
    { name: 'panscreener.prefs' },
  ),
);
