import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatClock, formatQuantity, truncateAddress } from '@/lib/format';
import { PriceText } from '@/components/ui/PriceText';
import { useCurrency } from '@/hooks/useCurrency';
import { generateTrades } from '@/data/sources/mock';
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
  const initial = useMemo(() => generateTrades(pair, 40), [pair]);
  const [trades, setTrades] = useState<Trade[]>(initial);
  const [freshId, setFreshId] = useState<string | null>(null);

  // Reset the tape when navigating between pairs.
  useEffect(() => {
    setTrades(initial);
    setFreshId(null);
  }, [initial]);

  // Synthesise new fills on an irregular cadence — a perfectly regular tape
  // reads as fake immediately.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(() => {
        const buyBias = 0.5 + Math.tanh(pair.change.h1 / 40) * 0.18;
        const side: Trade['side'] = Math.random() < buyBias ? 'buy' : 'sell';
        const valueUsd =
          (pair.volume.h1 / Math.max(1, pair.txns.h1.buys + pair.txns.h1.sells)) *
          (0.2 + Math.random() * 6);
        const priceUsd = pair.priceUsd * (1 + (Math.random() - 0.5) * 0.006);

        const trade: Trade = {
          id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          side,
          priceUsd,
          amount: valueUsd / priceUsd,
          valueUsd,
          maker: `0x${Math.random().toString(16).slice(2, 10)}${'0'.repeat(32)}`,
        };

        setTrades((current) => [trade, ...current].slice(0, 60));
        setFreshId(trade.id);
        schedule();
      }, 1200 + Math.random() * 3800);
    };

    schedule();
    return () => clearTimeout(timer);
  }, [pair]);

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
                  trade.id === freshId && (buy ? 'tick-up' : 'tick-down'),
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
                  <a
                    href={`${explorer}/address/${trade.maker}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-ink-low transition-colors hover:text-brand-500"
                  >
                    {truncateAddress(trade.maker, 6, 4)}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
