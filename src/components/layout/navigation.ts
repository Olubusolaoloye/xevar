import {
  Bell,
  LayoutGrid,
  Radar,
  Star,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shown in the command palette and the rail tooltip. */
  hint: string;
  /** Exact match only — otherwise `/` would match every route. */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: '/', icon: LayoutGrid, hint: 'Market pulse and trending pairs', end: true },
  { label: 'Screener', path: '/screener', icon: Radar, hint: 'Filter every pair across every chain' },
  { label: 'Watchlist', path: '/watchlist', icon: Star, hint: 'Pairs you are tracking' },
  { label: 'Portfolio', path: '/portfolio', icon: Wallet, hint: 'Wallet holdings and performance' },
  { label: 'Alerts', path: '/alerts', icon: Bell, hint: 'Price and liquidity triggers' },
];

/**
 * Routes that exist but are deliberately absent from the navigation.
 *
 * Admin is reached by URL and sits behind a passphrase — it is an operator
 * screen, not somewhere a visitor browsing the market should land.
 */
export const HIDDEN_ROUTES = ['/admin'] as const;
