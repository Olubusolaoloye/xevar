import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createRng } from '@/lib/seed';
import { CHAINS, CHAIN_IDS } from '@/data/chains';
import { generatePairs } from '@/data/sources/mock';
import type { Alert, ChainId, Holding, PortfolioPoint, Wallet } from '@/data/types';

/* -------------------------------------------------------------------------- */
/* Seed portfolio                                                             */
/* -------------------------------------------------------------------------- */

const seedWallets: Wallet[] = [
  {
    id: 'w1',
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    label: 'Main',
    chains: ['ethereum', 'base', 'arbitrum'],
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 214,
  },
  {
    id: 'w2',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    label: 'Solana trading',
    chains: ['solana'],
    addedAt: Date.now() - 1000 * 60 * 60 * 24 * 61,
  },
];

const seedHoldingSpecs: Array<{
  walletId: string;
  chain: ChainId;
  name: string;
  symbol: string;
  balance: number;
  priceUsd: number;
  change24h: number;
  costBasis: number;
}> = [
  { walletId: 'w1', chain: 'ethereum', name: 'Ethereum', symbol: 'ETH', balance: 4.62, priceUsd: 3180, change24h: 2.4, costBasis: 2410 },
  { walletId: 'w1', chain: 'ethereum', name: 'USD Coin', symbol: 'USDC', balance: 18450.22, priceUsd: 1, change24h: 0.01, costBasis: 1 },
  { walletId: 'w1', chain: 'base', name: 'Aerodrome', symbol: 'AERO', balance: 12400, priceUsd: 0.94, change24h: 7.8, costBasis: 0.61 },
  { walletId: 'w1', chain: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', balance: 9800, priceUsd: 0.86, change24h: -3.1, costBasis: 1.24 },
  { walletId: 'w1', chain: 'ethereum', name: 'Chainlink', symbol: 'LINK', balance: 620, priceUsd: 14.8, change24h: 1.2, costBasis: 11.9 },
  { walletId: 'w2', chain: 'solana', name: 'Solana', symbol: 'SOL', balance: 186.4, priceUsd: 146.2, change24h: 5.2, costBasis: 88.4 },
  { walletId: 'w2', chain: 'solana', name: 'Jupiter', symbol: 'JUP', balance: 24800, priceUsd: 0.88, change24h: -1.6, costBasis: 0.54 },
  { walletId: 'w2', chain: 'solana', name: 'Jito', symbol: 'JTO', balance: 3100, priceUsd: 2.16, change24h: 4.4, costBasis: 2.62 },
];

const seedHoldings: Holding[] = seedHoldingSpecs.map((spec, i) => ({
  id: `h${i + 1}`,
  walletId: spec.walletId,
  chain: spec.chain,
  token: {
    address: CHAINS[spec.chain].addressStyle === 'evm' ? `0x${'a'.repeat(40)}` : 'So11111111111111111111111111111111111111112',
    name: spec.name,
    symbol: spec.symbol,
  },
  balance: spec.balance,
  priceUsd: spec.priceUsd,
  valueUsd: spec.balance * spec.priceUsd,
  change24h: spec.change24h,
  costBasis: spec.costBasis,
}));

/**
 * 90 days of portfolio value, generated backwards from the true current total
 * so the chart's final point matches the headline figure exactly.
 */
function buildHistory(currentValue: number): PortfolioPoint[] {
  const rng = createRng('panscreener::portfolio::history');
  const days = 90;
  const values: number[] = [currentValue];

  for (let i = 1; i < days; i++) {
    // Walk back with a gentle downward drift, so the series trends up in time.
    values.push(values[i - 1] * (1 - rng.float(-0.035, 0.042)));
  }
  values.reverse();

  const dayMs = 86_400_000;
  const start = Date.now() - days * dayMs;
  return values.map((valueUsd, i) => ({ time: start + i * dayMs, valueUsd }));
}

/**
 * Seed alerts, bound to pairs that actually exist on the generated board.
 *
 * Hardcoding pair ids here would be brittle — the generator assigns each pair a
 * chain at random, so its ids are not predictable by hand, and an alert
 * pointing at a non-existent pair silently renders with no current value.
 * Deriving them from the board guarantees they always resolve.
 */
function buildSeedAlerts(): Alert[] {
  const deepest = [...generatePairs()]
    .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
    .slice(0, 3);

  const specs: Array<{
    metric: Alert['metric'];
    comparator: Alert['comparator'];
    /** Threshold as a multiple of the pair's current value. */
    factor: number;
    enabled: boolean;
    ageDays: number;
    triggered?: boolean;
  }> = [
    { metric: 'price', comparator: 'below', factor: 0.88, enabled: true, ageDays: 3 },
    { metric: 'change24h', comparator: 'above', factor: 1, enabled: true, ageDays: 9, triggered: true },
    { metric: 'liquidity', comparator: 'below', factor: 0.7, enabled: false, ageDays: 21 },
  ];

  return deepest.map((pair, i) => {
    const spec = specs[i];
    const threshold =
      spec.metric === 'price'
        ? pair.priceUsd * spec.factor
        : spec.metric === 'liquidity'
          ? pair.liquidityUsd * spec.factor
          : 10;

    return {
      id: `a${i + 1}`,
      pairId: pair.id,
      pairLabel: `${pair.baseToken.symbol} / ${pair.quoteToken.symbol}`,
      chain: pair.chain,
      metric: spec.metric,
      comparator: spec.comparator,
      threshold,
      enabled: spec.enabled,
      createdAt: Date.now() - 86_400_000 * spec.ageDays,
      triggeredAt: spec.triggered ? Date.now() - 3_600_000 * 5 : undefined,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

interface PortfolioState {
  wallets: Wallet[];
  holdings: Holding[];
  history: PortfolioPoint[];
  alerts: Alert[];

  addWallet: (address: string, label: string) => { ok: boolean; error?: string };
  removeWallet: (id: string) => void;
  renameWallet: (id: string, label: string) => void;

  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  toggleAlert: (id: string) => void;
  removeAlert: (id: string) => void;
}

/** Which chains an address could plausibly belong to, from its shape alone. */
export function detectChains(address: string): ChainId[] {
  const trimmed = address.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return CHAIN_IDS.filter((id) => CHAINS[id].addressStyle === 'evm');
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return ['solana'];
  }
  return [];
}

const seedTotal = seedHoldings.reduce((sum, h) => sum + h.valueUsd, 0);

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      wallets: seedWallets,
      holdings: seedHoldings,
      history: buildHistory(seedTotal),
      alerts: buildSeedAlerts(),

      addWallet: (address, label) => {
        const trimmed = address.trim();
        const chains = detectChains(trimmed);

        if (!trimmed) return { ok: false, error: 'Enter a wallet address.' };
        if (chains.length === 0) {
          return { ok: false, error: 'That does not look like an EVM or Solana address.' };
        }

        let duplicate = false;
        set((state) => {
          duplicate = state.wallets.some(
            (w) => w.address.toLowerCase() === trimmed.toLowerCase(),
          );
          if (duplicate) return state;
          return {
            wallets: [
              ...state.wallets,
              {
                id: `w${Date.now().toString(36)}`,
                address: trimmed,
                label: label.trim() || 'Untitled wallet',
                chains,
                addedAt: Date.now(),
              },
            ],
          };
        });

        return duplicate
          ? { ok: false, error: 'That wallet is already being tracked.' }
          : { ok: true };
      },

      removeWallet: (id) =>
        set((state) => ({
          wallets: state.wallets.filter((w) => w.id !== id),
          // Holdings belong to a wallet; dropping one must drop its tokens too.
          holdings: state.holdings.filter((h) => h.walletId !== id),
        })),

      renameWallet: (id, label) =>
        set((state) => ({
          wallets: state.wallets.map((w) => (w.id === id ? { ...w, label } : w)),
        })),

      addAlert: (alert) =>
        set((state) => ({
          alerts: [
            { ...alert, id: `a${Date.now().toString(36)}`, createdAt: Date.now() },
            ...state.alerts,
          ],
        })),

      toggleAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled } : a,
          ),
        })),

      removeAlert: (id) =>
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
    }),
    {
      name: 'panscreener.portfolio',
      partialize: (state) => ({
        wallets: state.wallets,
        holdings: state.holdings,
        alerts: state.alerts,
      }),
    },
  ),
);
