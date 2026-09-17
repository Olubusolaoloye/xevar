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
  { value: 'tokens' as SizeMode, label: 'Tokens' },
  { value: 'usd' as SizeMode, label: 'Spent' },
];

/** How the entry is expressed: the price paid, or the cap it was bought at. */
type EntryMode = 'price' | 'marketCap';

const ENTRY_OPTIONS = [
  { value: 'price' as EntryMode, label: 'Price' },
  { value: 'marketCap' as EntryMode, label: 'Market cap' },
];

/**
 * Supply implied by the provider's own figures.
 *
 * Market cap divided by price. It is a restatement of the cap rather than an
 * independent supply number, which is exactly what makes it the right
 * conversion here: an entry given as "I bought at a 120k cap" has to land on
 * the same scale the cap is quoted on, whatever that scale really is.
 *
 * Null when either figure is missing, because a supply of zero or infinity
 * would silently turn a real entry into a meaningless one.
 */
function impliedSupply(pair: Pair): number | null {
  if (!Number.isFinite(pair.marketCap) || pair.marketCap <= 0) return null;
  if (!Number.isFinite(pair.priceUsd) || pair.priceUsd <= 0) return null;
  return pair.marketCap / pair.priceUsd;
}

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
  const [sizeMode, setSizeMode] = useState<SizeMode>('tokens');
  const [size, setSize] = useState('');
  const [entryMode, setEntryMode] = useState<EntryMode>('price');
  const [entryPrice, setEntryPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supply = impliedSupply(pair);

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
    const entered = Number.parseFloat(entryPrice) || 0;

    /* A cap is converted to a per-token price through the implied supply, so
       everything downstream — the blend, the P&L, the stored entry — still
       works in one unit. Storing the cap instead would mean every consumer
       had to know which of two things `entryPriceUsd` held. */
    const priceValue =
      entryMode === 'marketCap'
        ? supply && supply > 0
          ? entered / rate / supply
          : 0
        : entered / rate;

    if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
      setError('Enter how much you bought.');
      return;
    }
    if (entryMode === 'marketCap' && !supply) {
      setError('No market cap is reported for this token, so a cap entry cannot be converted.');
      return;
    }
    if (priceValue <= 0) {
      setError(
        entryMode === 'marketCap'
          ? 'Enter the market cap you bought at.'
          : 'Enter the price you paid per token.',
      );
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
              placeholder={entryMode === 'marketCap' ? '120000' : 'entry price'}
              suffix={<span className="text-xs">{symbol}</span>}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-mid">Bought at</span>
            <SegmentedControl<EntryMode>
              options={ENTRY_OPTIONS}
              value={entryMode}
              onChange={(next) => {
                setEntryMode(next);
                // The number means something different now; keeping it would
                // read a price as a cap or the other way round.
                setEntryPrice('');
                setError(null);
              }}
              size="sm"
            />
          </div>

          {entryMode === 'marketCap' && !supply && (
            <p className="rounded-sm border border-warn/25 bg-warn/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-warn">
              This token has no market cap reported, so there is nothing to
              convert a cap entry against. Use the price instead.
            </p>
          )}

          {error && <p className="text-xs text-down">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() =>
                setEntryPrice(
                  String(entryMode === 'marketCap' ? pair.marketCap * rate : pair.priceUsd * rate),
                )
              }
              disabled={entryMode === 'marketCap' && !supply}
              className="text-[11px] text-ink-low underline-offset-2 transition-colors hover:text-brand-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {entryMode === 'marketCap' ? 'Use current cap' : 'Use current price'}
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
