import { Link } from 'react-router-dom';
import { formatAge } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Pair, Timeframe } from '@/data/types';

interface MiniPairListProps {
  pairs: Pair[];
  timeframe?: Timeframe;
  /** Show pair age instead of liquidity in the supporting line. */
  showAge?: boolean;
  emptyMessage?: string;
}

/**
 * A compact ranked list, for the overview page's side-by-side comparisons.
 *
 * Deliberately not the full table: three of these sitting beside one another
 * answer "what is moving, in both directions, and what is new" at a glance,
 * which the single sorted board cannot do.
 */
export function MiniPairList({
  pairs,
  timeframe = 'h24',
  showAge = false,
  emptyMessage = 'Nothing here yet.',
}: MiniPairListProps) {
  const { compact: money } = useCurrency();

  if (pairs.length === 0) {
    return <EmptyState title={emptyMessage} className="py-10" />;
  }

  return (
    <ul>
      {pairs.map((pair, index) => (
        <li key={pair.id}>
          <Link
            to={`/pair/${pair.id}`}
            className="group flex items-center gap-2.5 border-b border-line-soft px-4 py-2.5 transition-colors last:border-b-0 hover:bg-raised/60"
          >
            <span className="tnum w-4 shrink-0 text-right font-mono text-[10px] text-ink-dim">
              {index + 1}
            </span>

            <TokenAvatar
              symbol={pair.baseToken.symbol}
              chain={pair.chain}
              src={pair.imageUrl}
              size="sm"
            />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-ink transition-colors group-hover:text-brand-500">
                {pair.baseToken.symbol}
              </span>
              <span className="block truncate text-[11px] text-ink-low">
                {showAge ? `${formatAge(pair.createdAt)} old` : money(pair.liquidityUsd)}
                {' · '}
                {pair.dex}
              </span>
            </span>

            <span className="shrink-0 text-right">
              <PriceText
                usd={pair.priceUsd}
                live
                className="block text-xs font-medium text-ink"
              />
              <ChangeValue value={pair.change[timeframe]} size="sm" className="text-[11px]" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
