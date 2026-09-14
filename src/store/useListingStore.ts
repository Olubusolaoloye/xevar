import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChainId } from '@/data/types';

export type TokenCategory = 'meme' | 'defi' | 'infra' | 'stable' | 'other';

export const CATEGORY_LABEL: Record<TokenCategory, string> = {
  meme: 'Meme',
  defi: 'DeFi',
  infra: 'Infrastructure',
  stable: 'Stablecoin',
  other: 'Other',
};

export interface Listing {
  id: string;
  chain: ChainId;
  /**
   * The token's contract address. Authoritative when present: the board looks
   * the token up by this and cannot match the wrong asset.
   */
  address?: string;
  /** Ticker. Used to resolve the token when no address is pinned. */
  symbol: string;
  /** Optional display name override. */
  label?: string;
  category: TokenCategory;
  note?: string;
  /**
   * A specific pool, when the token trades in several. Without it the deepest
   * pool is used, which is the one worth quoting.
   */
  pairAddress?: string;

  /* --- Manual presentation overrides -------------------------------------
     Anything set here wins over what the market provider reports. Providers
     get token metadata wrong often enough — missing logos, truncated names,
     placeholder descriptions — that an operator needs the final say on how a
     listing is presented. Prices are never overridable: those come from the
     pool and inventing them would be fabrication. */

  /** Replaces the provider's logo. */
  logoUrl?: string;
  /** Wide banner shown on the token page. */
  coverUrl?: string;
  /** Short description shown on the token page. */
  blurb?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  /** Pinned to the top of the board regardless of sort. */
  featured?: boolean;
  addedAt: number;
  /** Manual sort position listed. */
  order: number;
}

/**
 * Whether a token is pinned to an exact contract.
 *
 * Symbol-only entries are resolved by searching, and ticker collisions are
 * common and dangerous — several unrelated tokens share a symbol across and
 * even within chains. The UI flags these so nobody mistakes a lookalike for
 * the real thing.
 */
export function isPinned(token: Listing): boolean {
  return Boolean(token.address);
}

/**
 * The starting board.
 *
 * Deliberately small: a curated shortlist beats an unfiltered firehose, and
 * the two entries below are the ones asked for as a live-price check.
 *
 * Note that neither carries a contract address. Inventing one from memory
 * would be worse than useless — a wrong address silently shows a different
 * token's price, or points at an impostor contract. These resolve by symbol
 * and are flagged as unverified until an address is pinned from the admin
 * screen, where the real pair can be picked from live search results.
 */
const SEED: Array<Omit<Listing, 'id' | 'addedAt' | 'order'>> = [
  { chain: 'bsc', symbol: 'WKC', label: 'Wiki Cat', category: 'meme' },
  { chain: 'ethereum', symbol: 'BLIN', label: 'Blin', category: 'meme' },
];

function seedTokens(): Listing[] {
  return SEED.map((token, i) => ({
    ...token,
    id: `t${i}-${token.chain}-${token.symbol.toLowerCase()}`,
    addedAt: Date.now(),
    order: i,
  }));
}

interface ListingState {
  tokens: Listing[];
  add: (token: Omit<Listing, 'id' | 'addedAt' | 'order'>) => { ok: boolean; error?: string };
  update: (id: string, patch: Partial<Omit<Listing, 'id'>>) => void;
  remove: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  replaceAll: (tokens: Listing[]) => void;
  resetToSeed: () => void;
}

export const useListingStore = create<ListingState>()(
  persist(
    (set, get) => ({
      tokens: seedTokens(),

      add: (token) => {
        const existing = get().tokens;

        // Duplicate check is by address when pinned, by chain+symbol when not —
        // the same symbol on two different chains is two different tokens.
        const duplicate = existing.some((t) =>
          token.address && t.address
            ? t.address.toLowerCase() === token.address.toLowerCase() && t.chain === token.chain
            : t.chain === token.chain && t.symbol.toUpperCase() === token.symbol.toUpperCase(),
        );
        if (duplicate) return { ok: false, error: 'That token is already listed on this chain.' };
        if (!token.symbol.trim()) return { ok: false, error: 'A ticker is required.' };

        set({
          tokens: [
            ...existing,
            {
              ...token,
              symbol: token.symbol.trim().toUpperCase(),
              id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
              addedAt: Date.now(),
              order: existing.length,
            },
          ],
        });
        return { ok: true };
      },

      update: (id, patch) =>
        set((state) => ({
          tokens: state.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      remove: (id) =>
        set((state) => ({ tokens: state.tokens.filter((t) => t.id !== id) })),

      move: (id, direction) =>
        set((state) => {
          const sorted = [...state.tokens].sort((a, b) => a.order - b.order);
          const index = sorted.findIndex((t) => t.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= sorted.length) return state;

          [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
          return { tokens: sorted.map((t, i) => ({ ...t, order: i })) };
        }),

      replaceAll: (tokens) =>
        set({ tokens: tokens.map((t, i) => ({ ...t, order: i })) }),

      resetToSeed: () => set({ tokens: seedTokens() }),
    }),
    { name: 'panscreener.listings' },
  ),
);
