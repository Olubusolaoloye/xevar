import type { ChainId } from './types';

export interface ChainMeta {
  id: ChainId;
  name: string;
  /** Ticker of the chain's native/quote asset. */
  native: string;
  /** Short form for dense table cells. */
  short: string;
  /** Resolves to the `--color-chain-*` token declared in tokens.css. */
  colorVar: string;
  /** Address shape, used by the mock generator and address validation. */
  addressStyle: 'evm' | 'base58';
  explorer: string;
}

export const CHAINS: Record<ChainId, ChainMeta> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    native: 'ETH',
    short: 'ETH',
    colorVar: 'var(--color-chain-ethereum)',
    addressStyle: 'evm',
    explorer: 'https://etherscan.io',
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    native: 'SOL',
    short: 'SOL',
    colorVar: 'var(--color-chain-solana)',
    addressStyle: 'base58',
    explorer: 'https://solscan.io',
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Chain',
    native: 'BNB',
    short: 'BNB',
    colorVar: 'var(--color-chain-bsc)',
    addressStyle: 'evm',
    explorer: 'https://bscscan.com',
  },
  base: {
    id: 'base',
    name: 'Base',
    native: 'ETH',
    short: 'BASE',
    colorVar: 'var(--color-chain-base)',
    addressStyle: 'evm',
    explorer: 'https://basescan.org',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    native: 'ETH',
    short: 'ARB',
    colorVar: 'var(--color-chain-arbitrum)',
    addressStyle: 'evm',
    explorer: 'https://arbiscan.io',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    native: 'POL',
    short: 'POL',
    colorVar: 'var(--color-chain-polygon)',
    addressStyle: 'evm',
    explorer: 'https://polygonscan.com',
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche',
    native: 'AVAX',
    short: 'AVAX',
    colorVar: 'var(--color-chain-avalanche)',
    addressStyle: 'evm',
    explorer: 'https://snowtrace.io',
  },
  sui: {
    id: 'sui',
    name: 'Sui',
    native: 'SUI',
    short: 'SUI',
    colorVar: 'var(--color-chain-sui)',
    addressStyle: 'evm',
    explorer: 'https://suiscan.xyz',
  },
};

export const CHAIN_IDS = Object.keys(CHAINS) as ChainId[];

export const CHAIN_LIST: ChainMeta[] = CHAIN_IDS.map((id) => CHAINS[id]);

/** Which exchanges are plausible on which chain — keeps mock data coherent. */
export const DEXES_BY_CHAIN: Record<ChainId, string[]> = {
  ethereum: ['Uniswap V3', 'Uniswap V2', 'Curve', 'Balancer', 'SushiSwap'],
  solana: ['Raydium', 'Orca', 'Meteora', 'Pump.fun', 'Lifinity'],
  bsc: ['PancakeSwap V3', 'PancakeSwap V2', 'Biswap', 'THENA'],
  base: ['Aerodrome', 'Uniswap V3', 'BaseSwap', 'SushiSwap'],
  arbitrum: ['Camelot', 'Uniswap V3', 'Ramses', 'TraderJoe'],
  polygon: ['QuickSwap', 'Uniswap V3', 'Balancer'],
  avalanche: ['TraderJoe', 'Pangolin', 'Pharaoh'],
  sui: ['Cetus', 'Turbos', 'Aftermath'],
};

export const ALL_DEXES: string[] = Array.from(
  new Set(Object.values(DEXES_BY_CHAIN).flat()),
).sort();
