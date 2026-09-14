import { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent, formatQuantity } from '@/lib/format';
import { blendPositions } from '@/lib/pnl';
import { useCurrency } from '@/hooks/useCurrency';
import { usePositionsStore } from '@/store/usePositionsStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';
import { PriceText } from '@/components/ui/PriceText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sparkline } from '@/components/ui/Sparkline';
import type { Pair } from '@/data/types';

type SizeMode = 'tokens' | 'usd';

const SIZE_OPTIONS = [
  { value: 'usd' as SizeMode, label: 'Spent' },
  { value: 'tokens' as SizeMode, label: 'Tokens' },
];

/**
 * The position card.
 *
 * Records what the user actually bought and marks it to market. Entries are
 * self-reported and stored in this browser only — PanScreener is read-only and
 * cannot see anyone's wallet, so a position has to be told to it.
 *
 * Size can be given either as tokens held or as money spent, because people
 * remember "I put in $500", not "I hold 1,612,903.22 tokens".
 */
export function PnlCard({ pair }: { pair: Pair }) {
  const { compact: money, symbol, rate } = useCurrency();
  const entries = usePositionsStore((s) => s.entries);
  const add = usePositionsStore((s) => s.add);
  const remove = usePositionsStore((s) => s.remove);

  const [open, setOpen] = useState(false);
  const [sizeMode, setSizeMode] = useState<SizeMode>('usd');
  const [size, setSize] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(
    () => entries.filter((entry) => entry.pairId === pair.id),
    [entries, pair.id],
  );

  const blended = useMemo(
    () => (mine.length > 0 ? blendPositions(mine, pair.priceUsd) : null),
    [mine, pair.priceUsd],
  );

  const submit = () => {
    const sizeValue = Number.parseFloat(size);
    const priceValue = (Number.parseFloat(entryPrice) || 0) / rate;

    if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
      setError('Enter how much you bought.');
      return;
    }
    if (priceValue <= 0) {
      setError('Enter the price you paid per token.');
      return;
    }

    // Money spent converts to tokens at the entry price, which is the only
    // figure the P&L maths actually needs.
    const amount = sizeMode === 'tokens' ? sizeValue : sizeValue / rate / priceValue;

    add({
      pairId: pair.id,
      pairLabel: `${pair.baseToken.symbol} / ${pair.quoteToken.symbol}`,
      chain: pair.chain,
      symbol: pair.baseToken.symbol,
      amount,
      entryPriceUsd: priceValue,
    });

    setSize('');
    setEntryPrice('');
    setError(null);
    setOpen(false);
  };

  const up = (blended?.pnlUsd ?? 0) >= 0;

  return (
    <div>
      <PanelHeader
        title="Your position"
        subtitle={mine.length > 0 ? `${mine.length} entr${mine.length === 1 ? 'y' : 'ies'}` : 'Not tracked'}
        icon={<Wallet className="h-4 w-4" />}
        action={
          <Button size="sm" variant={open ? 'ghost' : 'outline'} onClick={() => setOpen(!open)}>
            {open ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {open ? 'Cancel' : 'Add'}
          </Button>
        }
      />

      {/* Entry form */}
      {open && (
        <div className="space-y-3 border-b border-line bg-sunken/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-mid">How much?</span>
            <SegmentedControl<SizeMode>
              options={SIZE_OPTIONS}
              value={sizeMode}
              onChange={setSizeMode}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id={`pnl-size-${pair.id}`}
              value={size}
              onChange={(event) => {
                setSize(event.target.value);
                setError(null);
              }}
              inputMode="decimal"
              placeholder={sizeMode === 'usd' ? '500' : '1000000'}
              suffix={
                <span className="text-xs">
                  {sizeMode === 'usd' ? symbol : pair.baseToken.symbol.slice(0, 4)}
                </span>
              }
            />
            <Input
              id={`pnl-entry-${pair.id}`}
              value={entryPrice}
              onChange={(event) => {
                setEntryPrice(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
              inputMode="decimal"
              placeholder="entry price"
              suffix={<span className="text-xs">{symbol}</span>}
            />
          </div>

          {error && <p className="text-xs text-down">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setEntryPrice(String(pair.priceUsd * rate))}
              className="text-[11px] text-ink-low underline-offset-2 transition-colors hover:text-brand-500 hover:underline"
            >
              Use current price
            </button>
            <Button size="sm" variant="primary" onClick={submit}>
              Add entry
            </Button>
          </div>
        </div>
      )}

      {/* Marked to market */}
      {blended ? (
        <>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
                  Value
                </p>
                <p className="tnum mt-0.5 font-mono text-2xl font-bold text-ink">
                  {money(blended.valueUsd)}
                </p>
                <p
                  className={cn(
                    'tnum mt-1 font-mono text-sm font-semibold',
                    up ? 'text-up' : 'text-down',
                  )}
                >
                  {up ? '+' : '−'}
                  {money(Math.abs(blended.pnlUsd))} ({formatPercent(blended.pnlPct)})
                </p>
              </div>

              <div className="shrink-0 text-right">
                <Sparkline
                  data={pair.sparkline}
                  width={84}
                  height={30}
                  tone={up ? 'up' : 'down'}
                  className="ml-auto"
                />
                <p className="tnum mt-1 font-mono text-[11px] text-ink-low">
                  {blended.multiple.toFixed(2)}×
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
              <div className="bg-surface px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-low">Holding</p>
                <p className="tnum mt-0.5 truncate font-mono text-xs text-ink-mid">
                  {formatQuantity(blended.amount)}
                </p>
              </div>
              <div className="bg-surface px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-low">Avg entry</p>
                <PriceText
                  usd={blended.averageEntryUsd}
                  className="mt-0.5 block text-xs text-ink-mid"
                />
              </div>
              <div className="bg-surface px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-low">Cost</p>
                <p className="tnum mt-0.5 truncate font-mono text-xs text-ink-mid">
                  {money(blended.costUsd)}
                </p>
              </div>
            </div>
          </div>

          {/* Individual entries, so a mistyped one can be removed */}
          <ul className="divide-y divide-line-soft border-t border-line">
            {mine.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="tnum block font-mono text-[11px] text-ink-mid">
                    {formatQuantity(entry.amount)} {entry.symbol}
                  </span>
                  <span className="block text-[11px] text-ink-dim">
                    at{' '}
                    <PriceText usd={entry.entryPriceUsd} className="text-[11px] text-ink-low" />
                  </span>
                </span>

                <span
                  className={cn(
                    'tnum shrink-0 font-mono text-[11px]',
                    entry.amount * (pair.priceUsd - entry.entryPriceUsd) >= 0
                      ? 'text-up'
                      : 'text-down',
                  )}
                >
                  {formatPercent(((pair.priceUsd - entry.entryPriceUsd) / entry.entryPriceUsd) * 100)}
                </span>

                <button
                  onClick={() => remove(entry.id)}
                  aria-label="Remove entry"
                  className="shrink-0 rounded-sm p-1 text-ink-dim transition-colors hover:bg-down/10 hover:text-down"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        !open && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-ink-low">
              Track what you bought and see it marked to market.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2.5"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Add a position
            </Button>
          </div>
        )
      )}

      <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-ink-dim">
        Entries are yours alone, stored in this browser. PanScreener is
        read-only and cannot see your wallet.
      </p>
    </div>
  );
}
