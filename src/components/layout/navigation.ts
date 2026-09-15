import {
  Bell,
  Megaphone,
  Code2,
  Flame,
  LayoutGrid,
  LineChart,
  Radar,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
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
  /** Reachable, but the screen behind it is not built yet. */
  soon?: boolean;
}

/**
 * The primary routes.
 *
 * These appear in both the desktop rail and the mobile tab bar, so the list is
 * kept to what a phone can hold: five items is the practical ceiling before tap
 * targets get too narrow to hit reliably.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: '/', icon: LayoutGrid, hint: 'Market pulse and listings', end: true },
  { label: 'Screener', path: '/screener', icon: Radar, hint: 'Every listed pair' },
  { label: 'Watchlist', path: '/watchlist', icon: Star, hint: 'Pairs you are following' },
  { label: 'Portfolio', path: '/portfolio', icon: Wallet, hint: 'Wallet holdings and performance — coming soon', soon: true },
  { label: 'Alerts', path: '/alerts', icon: Bell, hint: 'Price and liquidity triggers' },
];

/**
 * Secondary sections, desktop only.
 *
 * These are cuts of the same board rather than separate destinations, so they
 * earn a place in a rail that has room for them but not in a five-slot tab bar
 * where they would push out a primary route.
 */
export const SECTION_ITEMS: NavItem[] = [
  { label: 'New listings', path: '/sections/new', icon: Sparkles, hint: 'Most recently listed tokens' },
  { label: 'Gainers', path: '/sections/gainers', icon: TrendingUp, hint: 'Biggest 24-hour gains' },
  { label: 'Losers', path: '/sections/losers', icon: TrendingDown, hint: 'Steepest 24-hour falls' },
  { label: 'Trending', path: '/sections/trending', icon: Flame, hint: 'Most active over the last hour' },
  { label: 'Multi-chart', path: '/multichart', icon: LineChart, hint: 'Compare two tokens side by side' },
  { label: 'Developers', path: '/developer', icon: Code2, hint: 'List your token' },
  { label: 'Advertise', path: '/ads', icon: Megaphone, hint: 'Ad placements — coming soon', soon: true },
];

/**
 * Routes that exist but are deliberately absent from the navigation.
 *
 * Admin is reached by URL and sits behind a passphrase — it is an operator
 * screen, not somewhere a visitor browsing the market should land.
 */
export const HIDDEN_ROUTES = ['/admin'] as const;
