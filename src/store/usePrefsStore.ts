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

interface PrefsState {
  currency: Currency;
  /** Collapse the desktop navigation rail to icons only. */
  railCollapsed: boolean;
  /** Suppress the live tick flash animation on table rows. */
  reduceFlash: boolean;
  setCurrency: (currency: Currency) => void;
  toggleRail: () => void;
  setReduceFlash: (value: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      currency: 'USD',
      railCollapsed: false,
      reduceFlash: false,
      setCurrency: (currency) => set({ currency }),
      toggleRail: () => set((state) => ({ railCollapsed: !state.railCollapsed })),
      setReduceFlash: (reduceFlash) => set({ reduceFlash }),
    }),
    { name: 'panscreener.prefs' },
  ),
);
