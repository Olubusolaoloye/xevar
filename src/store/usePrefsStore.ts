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

interface PrefsState {
  theme: ThemeChoice;
  currency: Currency;
  /** Collapse the desktop navigation rail to icons only. */
  railCollapsed: boolean;
  /** Suppress the live tick flash animation on table rows. */
  reduceFlash: boolean;
  setTheme: (theme: ThemeChoice) => void;
  setCurrency: (currency: Currency) => void;
  toggleRail: () => void;
  setReduceFlash: (value: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'system',
      currency: 'USD',
      railCollapsed: false,
      reduceFlash: false,
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      toggleRail: () => set((state) => ({ railCollapsed: !state.railCollapsed })),
      setReduceFlash: (reduceFlash) => set({ reduceFlash }),
    }),
    { name: 'panscreener.prefs' },
  ),
);
