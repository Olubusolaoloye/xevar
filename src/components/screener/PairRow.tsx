import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge, formatCompact, formatCount } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useScreenerStore } from '@/store/useScreenerStore';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { Sparkline } from '@/components/ui/Sparkline';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import { Tooltip } from '@/components/ui/Tooltip';
import type { Pair, Timeframe } from '@/data/types';
import { HIDE_CLASS } from './columns';

interface PairRowProps {
  pair: Pair;
  rank: number;
  timeframe: Timeframe;
  compact: boolean;
}

/**
 * One row of the screener.
 *
 * Memoised on the fields that actually render: at 160 rows updating on a
 * 1.2-second cadence, re-rendering every row on every tick is the difference
 * between a smooth table and a janky one.
 */
function PairRowBase({ pair, rank, timeframe, compact }: PairRowProps) {
  const { compact: money } = useCurrency();
  const watched = useScreenerStore((s) => s.watchlist.includes(pair.id));
  const toggleWatch = useScreenerStore((s) => s.toggleWatch);

  const txns = pair.txns[timeframe];
  const totalTxns = txns.buys + txns.sells;
  // Buy pressure drives the split bar under the transaction count.
  const buyShare = totalTxns > 0 ? (txns.buys / totalTxns) * 100 : 50;

  const cellPad = compact ? 'px-2 py-1.5' : 'px-2.5 py-2.5';

  return (
    <tr className="group border-b border-line-soft transition-colors hover:bg-raised/60">
      {/* Rank */}
      <td className={cn(cellPad, 'text-right')}>
        <span className="tnum font-mono text-xs text-ink-dim">{rank}</span>
      </td>

      {/* Identity — the whole cell is the link target. */}
      <td className={cn(cellPad, 'min-w-[190px]')}>
        <Link to={`/pair/${pair.id}`} className="flex items-center gap-2.5">
          <TokenAvatar
            symbol={pair.baseToken.symbol}
            chain={pair.chain}
            size={compact ? 'sm' : 'md'}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-brand-500">
                {pair.baseToken.symbol}
              </span>
              <span className="shrink-0 text-xs text-ink-dim">
                /{pair.quoteToken.symbol}
              </span>
              {pair.boosts > 0 && (
                <Tooltip content={`${pair.boosts} boosts`}>
                  <span className="inline-flex items-center gap-0.5 rounded-xs bg-warn/12 px-1 text-[9px] font-bold text-warn">
                    <Zap className="h-2.5 w-2.5" fill="currentColor" />
                    {pair.boosts}
                  </span>
                </Tooltip>
              )}
            </span>
            {!compact && (
              <span className="mt-0.5 flex items-center gap-1.5">
                <ChainChip chain={pair.chain} compact />
                <span className="truncate text-[11px] text-ink-low">{pair.dex}</span>
              </span>
            )}
          </span>
        </Link>
      </td>

      {/* Price */}
      <td className={cn(cellPad, 'text-right')}>
        <PriceText usd={pair.priceUsd} live className="text-sm font-medium text-ink" />
      </td>

      {/* Age */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.xl)}>
        <span className="tnum font-mono text-xs text-ink-mid">
          {formatAge(pair.createdAt)}
        </span>
      </td>

      {/* Transactions, with a buy/sell pressure bar */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.xl)}>
        <Tooltip content={`${formatCount(txns.buys)} buys · ${formatCount(txns.sells)} sells`}>
          <span className="inline-flex flex-col items-end gap-1">
            <span className="tnum font-mono text-xs text-ink-mid">
              {formatCount(totalTxns)}
            </span>
            <span className="flex h-[3px] w-12 overflow-hidden rounded-full bg-down/35">
              <span className="bg-up" style={{ width: `${buyShare}%` }} />
            </span>
          </span>
        </Tooltip>
      </td>

      {/* Volume */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.lg)}>
        <span className="tnum font-mono text-xs text-ink-mid">
          {money(pair.volume[timeframe])}
        </span>
      </td>

      {/* Makers */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS['2xl'])}>
        <span className="tnum font-mono text-xs text-ink-mid">
          {formatCompact(pair.makers24h)}
        </span>
      </td>

      {/* Rolling change windows */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS['2xl'])}>
        <ChangeValue value={pair.change.m5} size="sm" />
      </td>
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.xl)}>
        <ChangeValue value={pair.change.h1} size="sm" />
      </td>
      <td className={cn(cellPad, 'text-right', HIDE_CLASS['2xl'])}>
        <ChangeValue value={pair.change.h6} size="sm" />
      </td>
      <td className={cn(cellPad, 'text-right')}>
        <ChangeValue value={pair.change.h24} size="sm" className="font-semibold" />
      </td>

      {/* Depth */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.md)}>
        <span className="tnum font-mono text-xs text-ink-mid">
          {money(pair.liquidityUsd)}
        </span>
      </td>
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.lg)}>
        <span className="tnum font-mono text-xs text-ink-mid">
          {money(pair.marketCap)}
        </span>
      </td>

      {/* Trend */}
      <td className={cn(cellPad, 'text-right', HIDE_CLASS.xl)}>
        <Sparkline data={pair.sparkline} width={88} height={26} className="ml-auto" />
      </td>

      {/* Watch */}
      <td className={cn(cellPad, 'text-center')}>
        <button
          onClick={() => toggleWatch(pair.id)}
          aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
          aria-pressed={watched}
          className={cn(
            'rounded-sm p-1 transition-all',
            watched
              ? 'text-brand-500'
              : // Hidden until the row is hovered or the control is focused,
                // so 160 grey stars do not compete with the data.
                'text-ink-dim opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
          )}
        >
          <Star className="h-3.5 w-3.5" fill={watched ? 'currentColor' : 'none'} />
        </button>
      </td>
    </tr>
  );
}

export const PairRow = memo(PairRowBase, (prev, next) => {
  return (
    prev.pair.id === next.pair.id &&
    prev.pair.priceUsd === next.pair.priceUsd &&
    prev.pair.change.m5 === next.pair.change.m5 &&
    prev.pair.change.h1 === next.pair.change.h1 &&
    prev.pair.change.h6 === next.pair.change.h6 &&
    prev.pair.change.h24 === next.pair.change.h24 &&
    prev.pair.volume[next.timeframe] === next.pair.volume[next.timeframe] &&
    prev.rank === next.rank &&
    prev.timeframe === next.timeframe &&
    prev.compact === next.compact
  );
});
