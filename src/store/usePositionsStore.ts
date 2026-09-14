import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** One buy, recorded against a pair. */
export interface PositionEntry {
  id: string;
  pairId: string;
  /** Denormalised so the portfolio can render without resolving the pair. */
  pairLabel: string;
  chain: string;
  symbol: string;
  /** Tokens held. */
  amount: number;
  /** Price paid per token, in USD. */
  entryPriceUsd: number;
  addedAt: number;
  note?: string;
}

interface PositionsState {
  entries: PositionEntry[];
  add: (entry: Omit<PositionEntry, 'id' | 'addedAt'>) => void;
  remove: (id: string) => void;
  clearPair: (pairId: string) => void;
  forPair: (pairId: string) => PositionEntry[];
}

/**
 * Positions the user has recorded by hand.
 *
 * Deliberately separate from the wallet-derived holdings in the portfolio
 * store: these are self-reported entries with a cost basis the chain does not
 * know, and conflating the two would let a typo here corrupt real balances.
 */
export const usePositionsStore = create<PositionsState>()(
  persist(
    (set, get) => ({
      entries: [],

      add: (entry) =>
        set((state) => ({
          entries: [
            {
              ...entry,
              id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
              addedAt: Date.now(),
            },
            ...state.entries,
          ],
        })),

      remove: (id) =>
        set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),

      clearPair: (pairId) =>
        set((state) => ({ entries: state.entries.filter((entry) => entry.pairId !== pairId) })),

      forPair: (pairId) => get().entries.filter((entry) => entry.pairId === pairId),
    }),
    { name: 'panscreener.positions' },
  ),
);
