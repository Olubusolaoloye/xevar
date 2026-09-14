import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatClock, formatQuantity, truncateAddress } from '@/lib/format';
import { PriceText } from '@/components/ui/PriceText';
import { useCurrency } from '@/hooks/useCurrency';
import { usePairTrades } from '@/hooks/usePairChart';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CHAINS } from '@/data/chains';
import type { Pair, Trade } from '@/data/types';

/**
 * The live trade tape.
 *
 * New fills enter at the top with a coloured wash and push the list down —
 * the visual grammar every trading desk already reads fluently. Capped at 60
 * rows so an unbounded list can never grow the DOM without limit.
 */
export function TradeTape({ pair }: { pair: Pair }) {
  const { compact: money } = useCurrency();
  const { data: trades, loading } = usePairTrades(pair);

  // Highlight fills that are new since the previous poll, so the eye catches
  // what actually just happened rather than re-flashing the whole tape.
  const knownIds = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (trades.length === 0) return;

    const incoming = new Set(trades.map((trade) => trade.id));
    // The first load is not "new" — everything would flash at once.
    if (knownIds.current.size === 0) {
      knownIds.current = incoming;
      return;
    }

    const fresh = new Set<string>();
    for (const id of incoming) {
      if (!knownIds.current.has(id)) fresh.add(id);
    }
    knownIds.current = incoming;
    if (fresh.size === 0) return;

    setFreshIds(fresh);
    const timer = setTimeout(() => setFreshIds(new Set()), 1200);
    return () => clearTimeout(timer);
  }, [trades]);

  if (loading && trades.length === 0) {
    return (
      <div className="space-y-1.5 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <EmptyState
        title="No recent trades"
        description="This pool has not printed a fill recently, or the trade feed does not cover it."
      />
    );
  }

  const explorer = CHAINS[pair.chain].explorer;

  return (
    <div className="max-h-[420px] overflow-y-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-sunken/95 backdrop-blur">
          <tr className="border-b border-line">
            {['Time', 'Side', 'Price', `Amount`, 'Value', 'Maker'].map((label, i) => (
              <th
                key={label}
                className={cn(
                  'whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-low',
                  i === 0 || i === 1 ? 'text-left' : 'text-right',
                  // Amount and maker are the first to go on narrow panels.
                  i === 3 && 'hidden sm:table-cell',
                  i === 5 && 'hidden md:table-cell',
                )}
              >
                {label === 'Amount' ? `Amount (${pair.baseToken.symbol})` : label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {trades.map((trade) => {
            const buy = trade.side === 'buy';
            return (
              <tr
                key={trade.id}
                className={cn(
                  'border-b border-line-soft text-xs transition-colors',
                  freshIds.has(trade.id) && (buy ? 'tick-up' : 'tick-down'),
                )}
              >
                <td className="tnum whitespace-nowrap px-3 py-1.5 font-mono text-ink-low">
                  {formatClock(trade.timestamp)}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5 font-semibold uppercase',
                    buy ? 'text-up' : 'text-down',
                  )}
                >
                  {trade.side}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                  <PriceText
                    usd={trade.priceUsd}
                    className={cn('text-xs', buy ? 'text-up' : 'text-down')}
                  />
                </td>
                <td className="tnum hidden whitespace-nowrap px-3 py-1.5 text-right font-mono text-ink-mid sm:table-cell">
                  {formatQuantity(trade.amount)}
                </td>
                <td className="tnum whitespace-nowrap px-3 py-1.5 text-right font-mono text-ink-mid">
                  {money(trade.valueUsd)}
                </td>
                <td className="hidden px-3 py-1.5 text-right md:table-cell">
                  {trade.maker ? (
                    <a
                      href={`${explorer}/address/${trade.maker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-ink-low transition-colors hover:text-brand-500"
                    >
                      {truncateAddress(trade.maker, 6, 4)}
                    </a>
                  ) : (
                    <span className="text-ink-dim">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
