import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge, formatCount } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useScreenerStore } from '@/store/useScreenerStore';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { Sparkline } from '@/components/ui/Sparkline';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import type { Pair, Timeframe } from '@/data/types';

interface PairCardProps {
  pair: Pair;
  rank: number;
  timeframe: Timeframe;
}

/**
 * The phone-sized presentation of a pair.
 *
 * A fourteen-column table cannot be made to work at 380px — squeezing it
 * produces something no one can read. The card keeps the same information
 * hierarchy (identity → price → move → depth) in a stacked form.
 */
function PairCardBase({ pair, rank, timeframe }: PairCardProps) {
  const { compact: money } = useCurrency();
  const watched = useScreenerStore((s) => s.watchlist.includes(pair.id));
  const toggleWatch = useScreenerStore((s) => s.toggleWatch);

  const txns = pair.txns[timeframe];

  return (
    <div className="relative border-b border-line-soft px-3 py-3 transition-colors active:bg-raised/60">
      <Link to={`/pair/${pair.id}`} className="flex items-start gap-3">
        <span className="tnum w-4 shrink-0 pt-2 text-right font-mono text-[10px] text-ink-dim">
          {rank}
        </span>

        <TokenAvatar
          symbol={pair.baseToken.symbol}
          chain={pair.chain}
          src={pair.imageUrl}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">
                {pair.baseToken.symbol}
              </span>
              <span className="shrink-0 text-xs text-ink-dim">
                /{pair.quoteToken.symbol}
              </span>
              {pair.tracked && !pair.tracked.pinned && (
                <ShieldAlert className="h-3 w-3 shrink-0 text-warn" />
              )}
            </span>
            <PriceText
              usd={pair.priceUsd}
              live
              className="shrink-0 text-sm font-semibold text-ink"
            />
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <ChainChip chain={pair.chain} compact />
              <span className="truncate text-[11px] text-ink-low">{pair.dex}</span>
              <span className="shrink-0 text-[11px] text-ink-dim">
                · {formatAge(pair.createdAt)}
              </span>
            </span>
            <ChangeValue value={pair.change.h24} size="sm" chip className="shrink-0" />
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <Sparkline data={pair.sparkline} width={64} height={20} />
            <span className="flex flex-1 items-center justify-between gap-3 text-[11px] text-ink-low">
              <span>
                Liq{' '}
                <span className="tnum font-mono text-ink-mid">
                  {money(pair.liquidityUsd)}
                </span>
              </span>
              <span>
                Vol{' '}
                <span className="tnum font-mono text-ink-mid">
                  {money(pair.volume[timeframe])}
                </span>
              </span>
              <span>
                Txns{' '}
                <span className="tnum font-mono text-ink-mid">
                  {formatCount(txns.buys + txns.sells)}
                </span>
              </span>
            </span>
          </div>
        </div>
      </Link>

      <button
        onClick={() => toggleWatch(pair.id)}
        aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        aria-pressed={watched}
        className={cn(
          'absolute right-2 top-2 rounded-sm p-1.5',
          watched ? 'text-brand-500' : 'text-ink-dim',
        )}
      >
        <Star className="h-3.5 w-3.5" fill={watched ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

export const PairCard = memo(PairCardBase);
