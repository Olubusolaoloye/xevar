import { create } from 'zustand';

export interface Wallet {
  id: string;
  address: string;
  name: string;
  totalValue: number;
  chains: string[];
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  price: number;
  value: number;
  change: number;
  chain: string;
  icon: string;
}

export interface PortfolioHistory {
  date: string;
  value: number;
}

export interface Alert {
  id: string;
  type: 'price' | 'wallet';
  message: string;
  active: boolean;
}

export interface Insight {
  id: string;
  type: 'warning' | 'info' | 'idea';
  title: string;
  description: string;
  explanation: string;
}

export interface MarketCoin {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  icon: string;
  about: string;
  circulatingSupply: number;
  maxSupply: number | null;
}

interface AppState {
  wallets: Wallet[];
  tokens: Token[];
  history: PortfolioHistory[];
  alerts: Alert[];
  insights: Insight[];
  markets: MarketCoin[];
  theme: 'light' | 'dark';
  currency: 'USD' | 'NGN';
  addWallet: (wallet: Wallet) => void;
  removeWallet: (id: string) => void;
  toggleAlert: (id: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setCurrency: (currency: 'USD' | 'NGN') => void;
  addMarket: (market: MarketCoin) => void;
  updatePrices: (prices: Record<string, { price: number, change24h: number, volume24h?: number }>) => void;
}

const mockWallets: Wallet[] = [
  { id: '1', address: '0x71C...976F', name: 'Main Wallet', totalValue: 12450.23, chains: ['Ethereum', 'Polygon'] },
  { id: '2', address: '0x89D...214A', name: 'DeFi Wallet', totalValue: 3420.10, chains: ['Arbitrum', 'Optimism'] },
];

const mockTokens: Token[] = [
  { id: '1', symbol: 'ETH', name: 'Ethereum', balance: 2.5, price: 3200, value: 8000, change: 2.3, chain: 'Ethereum', icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032' },
  { id: '2', symbol: 'BTC', name: 'Bitcoin', balance: 0.05, price: 64000, value: 3200, change: -1.2, chain: 'Bitcoin', icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032' },
  { id: '3', symbol: 'SOL', name: 'Solana', balance: 45, price: 145, value: 6525, change: 5.8, chain: 'Solana', icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=032' },
  { id: '4', symbol: 'USDC', name: 'USD Coin', balance: 1250.23, price: 1, value: 1250.23, change: 0.01, chain: 'Ethereum', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=032' },
  { id: '5', symbol: 'ARB', name: 'Arbitrum', balance: 1200, price: 1.15, value: 1380, change: -3.4, chain: 'Arbitrum', icon: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=032' },
];

const mockHistory: PortfolioHistory[] = Array.from({ length: 30 }).map((_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  value: 10000 + Math.random() * 3000 + i * 100,
}));

const mockAlerts: Alert[] = [
  { id: '1', type: 'price', message: 'ETH drops below $3,000', active: true },
  { id: '2', type: 'wallet', message: 'Large transfer from Main Wallet', active: false },
  { id: '3', type: 'price', message: 'SOL increases by 10%', active: true },
];

const mockInsights: Insight[] = [
  { id: '1', type: 'warning', title: 'High Volatility Risk', description: '72% of your assets are highly volatile.', explanation: 'A large portion of your portfolio is concentrated in high-beta assets like SOL and ARB. Consider rebalancing into stablecoins to reduce downside risk.' },
  { id: '2', type: 'info', title: 'Staking Opportunity', description: 'You have 2.5 ETH sitting idle.', explanation: 'You can earn up to 4% APY by staking your Ethereum on Lido or Rocket Pool.' },
  { id: '3', type: 'idea', title: 'Diversify into L2s', description: 'Your portfolio is heavily Ethereum-based.', explanation: 'Exploring Layer 2 ecosystems like Base or Optimism might expose you to new growth opportunities with lower transaction fees.' },
];

const mockMarkets: MarketCoin[] = [
  { id: 'bitcoin', rank: 1, name: 'Bitcoin', symbol: 'BTC', price: 64230.50, change24h: 2.4, marketCap: 1200.5, volume24h: 34.5, icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032', about: 'Bitcoin is a decentralized cryptocurrency originally described in a 2008 whitepaper by a person, or group of people, using the alias Satoshi Nakamoto.', circulatingSupply: 19600000, maxSupply: 21000000 },
  { id: 'ethereum', rank: 2, name: 'Ethereum', symbol: 'ETH', price: 3450.20, change24h: 5.1, marketCap: 415.2, volume24h: 18.2, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032', about: 'Ethereum is a decentralized open-source blockchain system that features its own cryptocurrency, Ether. ETH works as a platform for numerous other cryptocurrencies, as well as for the execution of decentralized smart contracts.', circulatingSupply: 120000000, maxSupply: null },
  { id: 'tether', rank: 3, name: 'Tether', symbol: 'USDT', price: 1.00, change24h: 0.01, marketCap: 110.5, volume24h: 45.1, icon: 'https://cryptologos.cc/logos/tether-usdt-logo.svg?v=032', about: 'Tether (USDT) is a stablecoin, a type of cryptocurrency which aims to keep cryptocurrency valuations stable.', circulatingSupply: 110500000000, maxSupply: null },
  { id: 'bnb', rank: 4, name: 'BNB', symbol: 'BNB', price: 580.40, change24h: -1.2, marketCap: 85.4, volume24h: 2.1, icon: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032', about: 'BNB was launched through an initial coin offering in 2017, 11 days before the Binance cryptocurrency exchange went online.', circulatingSupply: 149500000, maxSupply: 200000000 },
  { id: 'solana', rank: 5, name: 'Solana', symbol: 'SOL', price: 145.60, change24h: 8.5, marketCap: 65.2, volume24h: 5.4, icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=032', about: 'Solana is a highly functional open source project that banks on blockchain technology\'s permissionless nature to provide decentralized finance (DeFi) solutions.', circulatingSupply: 443000000, maxSupply: null },
  { id: 'usdc', rank: 6, name: 'USDC', symbol: 'USDC', price: 1.00, change24h: 0.0, marketCap: 32.1, volume24h: 4.2, icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=032', about: 'USDC is a fully collateralized US dollar stablecoin. USDC is the bridge between dollars and trading on cryptocurrency exchanges.', circulatingSupply: 32100000000, maxSupply: null },
  { id: 'xrp', rank: 7, name: 'XRP', symbol: 'XRP', price: 0.62, change24h: 1.5, marketCap: 34.5, volume24h: 1.8, icon: 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=032', about: 'XRP is the cryptocurrency used by the Ripple payment network. Built for enterprise use, XRP aims to be a fast, cost-efficient cryptocurrency for cross-border payments.', circulatingSupply: 54800000000, maxSupply: 100000000000 },
  { id: 'dogecoin', rank: 8, name: 'Dogecoin', symbol: 'DOGE', price: 0.15, change24h: -4.2, marketCap: 21.4, volume24h: 3.2, icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.svg?v=032', about: 'Dogecoin (DOGE) is based on the popular "doge" Internet meme and features a Shiba Inu on its logo. The open-source digital currency was created by Billy Markus from Portland, Oregon and Jackson Palmer from Sydney, Australia.', circulatingSupply: 143000000000, maxSupply: null },
];

export const useStore = create<AppState>((set) => ({
  wallets: mockWallets,
  tokens: mockTokens,
  history: mockHistory,
  alerts: mockAlerts,
  insights: mockInsights,
  markets: mockMarkets,
  theme: 'dark',
  currency: 'USD',
  addWallet: (wallet) => set((state) => ({ wallets: [...state.wallets, wallet] })),
  removeWallet: (id) => set((state) => ({ wallets: state.wallets.filter((w) => w.id !== id) })),
  toggleAlert: (id) => set((state) => ({
    alerts: state.alerts.map((a) => a.id === id ? { ...a, active: !a.active } : a)
  })),
  setTheme: (theme) => set({ theme }),
  setCurrency: (currency) => set({ currency }),
  addMarket: (market) => set((state) => ({ markets: [...state.markets, market] })),
  updatePrices: (prices) => set((state) => ({
    markets: state.markets.map(m => {
      const data = prices[`${m.symbol}USDT`];
      if (data) {
        return { ...m, price: data.price, change24h: data.change24h, volume24h: data.volume24h ? data.volume24h / 1000000000 : m.volume24h };
      }
      return m;
    }),
    tokens: state.tokens.map(t => {
      // For USDC/USDT, keep price at 1
      if (t.symbol === 'USDC' || t.symbol === 'USDT') return { ...t, price: 1, value: t.balance };
      const data = prices[`${t.symbol}USDT`];
      if (data) {
        return { ...t, price: data.price, change: data.change24h, value: t.balance * data.price };
      }
      return t;
    })
  })),
}));
