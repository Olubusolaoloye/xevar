import type { SortKey } from '@/data/types';

export interface ColumnDef {
  id: string;
  label: string;
  sortKey?: SortKey;
  /** Tailwind alignment for both header and cell. */
  align: 'left' | 'right' | 'center';
  /** Hide below this breakpoint so narrow screens stay legible. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  width?: string;
  /** Explanatory text shown on hover, for the non-obvious ones. */
  help?: string;
}

/**
 * The screener's column contract.
 *
 * Declared as data rather than markup so the header row, the body cells and the
 * responsive hiding rules can never drift out of sync — a classic failure mode
 * in dense tables where a column is hidden in one place but not the other.
 *
 * Column order follows the question a trader asks top-to-bottom: what is it →
 * what does it cost → how has it moved → how much is trading → how deep is it.
 */
export const COLUMNS: ColumnDef[] = [
  { id: 'rank', label: '#', align: 'right', width: 'w-10' },
  { id: 'token', label: 'Pair', align: 'left' },
  { id: 'price', label: 'Price', sortKey: 'priceUsd', align: 'right' },
  {
    id: 'age',
    label: 'Age',
    sortKey: 'createdAt',
    align: 'right',
    hideBelow: 'xl',
    help: 'Time since the pair was created on-chain.',
  },
  {
    id: 'txns',
    label: 'Txns',
    sortKey: 'txns',
    align: 'right',
    hideBelow: 'xl',
    help: 'Buys and sells in the selected window.',
  },
  {
    id: 'volume',
    label: 'Volume',
    sortKey: 'volume',
    align: 'right',
    hideBelow: 'lg',
    help: 'Traded value in the selected window.',
  },
  {
    id: 'makers',
    label: 'Makers',
    sortKey: 'makers24h',
    align: 'right',
    hideBelow: '2xl',
    help: 'Distinct trading addresses over 24 hours.',
  },
  { id: 'm5', label: '5M', align: 'right', hideBelow: '2xl' },
  { id: 'h1', label: '1H', align: 'right', hideBelow: 'xl' },
  { id: 'h6', label: '6H', align: 'right', hideBelow: '2xl' },
  { id: 'h24', label: '24H', sortKey: 'change', align: 'right' },
  {
    id: 'liquidity',
    label: 'Liquidity',
    sortKey: 'liquidityUsd',
    align: 'right',
    hideBelow: 'md',
    help: 'Total value pooled in the pair. The best single proxy for how much size it can absorb.',
  },
  {
    id: 'mcap',
    label: 'Mcap',
    sortKey: 'marketCap',
    align: 'right',
    hideBelow: 'lg',
  },
  { id: 'chart', label: '', align: 'right', hideBelow: 'xl', width: 'w-[100px]' },
  { id: 'watch', label: '', align: 'center', width: 'w-9' },
];

/** Maps the `hideBelow` key onto the responsive display utilities. */
export const HIDE_CLASS: Record<NonNullable<ColumnDef['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
};
