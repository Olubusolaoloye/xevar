import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * A slide in the hero carousel.
 *
 * These are promotional placements, so they carry an explicit `sponsored` flag.
 * Paid content that does not look like paid content is the kind of thing that
 * costs a product its credibility, and in a market app it can mislead someone
 * into a position.
 */
export interface AdSlide {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Optional background image URL. */
  imageUrl?: string;
  sponsored: boolean;
  enabled: boolean;
  order: number;
}

/**
 * External contract-verdict provider.
 *
 * PanScreener does not audit contracts, and the market API exposes no safety
 * data, so verdicts come from a dedicated service. The URL is a template rather
 * than a hardcoded scheme because the provider's exact path format cannot be
 * confirmed from here — getting it wrong would send users to a dead link on
 * every token page.
 *
 * Placeholders: {address} {chain} {symbol} {pairAddress}
 */
export interface VerdictProvider {
  name: string;
  urlTemplate: string;
  enabled: boolean;
}

/**
 * Resolve a provider template for one token.
 *
 * Values are URL-encoded, so an odd symbol cannot break the link or inject
 * extra path segments.
 */
export function buildVerdictUrl(
  provider: VerdictProvider,
  token: { address: string; chain: string; symbol: string; pairAddress: string },
): string {
  return provider.urlTemplate
    .replace(/\{address\}/g, encodeURIComponent(token.address))
    .replace(/\{chain\}/g, encodeURIComponent(token.chain))
    .replace(/\{symbol\}/g, encodeURIComponent(token.symbol))
    .replace(/\{pairAddress\}/g, encodeURIComponent(token.pairAddress));
}

const DEFAULT_PROVIDER: VerdictProvider = {
  name: 'FatDev',
  // A starting guess, not a verified scheme — the admin screen shows a live
  // preview of the resulting link precisely so this can be corrected on sight.
  urlTemplate: 'https://fatdev.org/token/{address}',
  enabled: true,
};

const DEFAULT_SLIDES: AdSlide[] = [
  {
    id: 'slide-default',
    eyebrow: 'Live across 8 networks',
    title: 'Every pair. Every chain. One board.',
    body: 'PanScreener streams live DEX markets into a single instrument — price, depth, flow and risk signals, side by side, updating as they move.',
    ctaLabel: 'Open the screener',
    ctaHref: '/screener',
    sponsored: false,
    enabled: true,
    order: 0,
  },
];

interface AdminState {
  /**
   * SHA-256 of the passphrase. The plaintext is never stored, so reading
   * localStorage does not hand over the passphrase itself.
   */
  passHash: string | null;
  slides: AdSlide[];
  provider: VerdictProvider;
  /** How often the board refreshes, in seconds. */
  pollSeconds: number;

  setPassHash: (hash: string | null) => void;
  addSlide: (slide: Omit<AdSlide, 'id' | 'order'>) => void;
  updateSlide: (id: string, patch: Partial<Omit<AdSlide, 'id'>>) => void;
  removeSlide: (id: string) => void;
  moveSlide: (id: string, direction: -1 | 1) => void;
  setProvider: (patch: Partial<VerdictProvider>) => void;
  setPollSeconds: (seconds: number) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      passHash: null,
      slides: DEFAULT_SLIDES,
      provider: DEFAULT_PROVIDER,
      pollSeconds: 15,

      setPassHash: (passHash) => set({ passHash }),

      addSlide: (slide) =>
        set((state) => ({
          slides: [
            ...state.slides,
            {
              ...slide,
              id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
              order: state.slides.length,
            },
          ],
        })),

      updateSlide: (id, patch) =>
        set((state) => ({
          slides: state.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),

      removeSlide: (id) =>
        set((state) => ({ slides: state.slides.filter((s) => s.id !== id) })),

      moveSlide: (id, direction) =>
        set((state) => {
          const sorted = [...state.slides].sort((a, b) => a.order - b.order);
          const index = sorted.findIndex((s) => s.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= sorted.length) return state;

          [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
          return { slides: sorted.map((s, i) => ({ ...s, order: i })) };
        }),

      setProvider: (patch) =>
        set((state) => ({ provider: { ...state.provider, ...patch } })),

      // Clamped: below 10s a public API starts rate-limiting, above 120s the
      // board stops feeling live.
      setPollSeconds: (seconds) =>
        set({ pollSeconds: Math.min(120, Math.max(10, Math.round(seconds))) }),
    }),
    { name: 'panscreener.admin' },
  ),
);
