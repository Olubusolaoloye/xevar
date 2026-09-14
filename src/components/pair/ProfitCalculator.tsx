import { useMemo, useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact, formatPercent, formatQuantity } from '@/lib/format';
import { evaluatePosition, projectAtMarketCap, projectTargets } from '@/lib/pnl';
import { useCurrency } from '@/hooks/useCurrency';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PriceText } from '@/components/ui/PriceText';
import type { Pair } from '@/data/types';

type EntryMode = 'price' | 'mcap';

const MODE_OPTIONS = [
  { value: 'price' as EntryMode, label: 'By price' },
  { value: 'mcap' as EntryMode, label: 'By mcap' },
];

/**
 * The what-if calculator.
 *
 * Answers the two questions people actually bring to a token page: "what would
 * my money be worth if I'd bought earlier", and "what is it worth if this
 * runs". Entry can be given as a price or as a market cap, because below a
 * cent a price is impossible to reason about while a market cap is not —
 * $0.0000031 means nothing on its own, "$4M mcap" means everything.
 */
export function ProfitCalculator({ pair }: { pair: Pair }) {
  const { compact: money, symbol, rate } = useCurrency();

  const [mode, setMode] = useState<EntryMode>('mcap');
  const [investment, setInvestment] = useState('1000');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryMcap, setEntryMcap] = useState('');
  const [targetMcap, setTargetMcap] = useState('');

  // Inputs are entered in the display currency; the maths is all in USD.
  const investmentUsd = (Number.parseFloat(investment) || 0) / rate;

  /**
   * Resolve the entry price from whichever mode is active. In mcap mode the
   * price is scaled by the ratio of entry mcap to current mcap, which holds for
   * a fixed supply.
   */
  const entryPriceUsd = useMemo(() => {
    if (mode === 'price') {
      return (Number.parseFloat(entryPrice) || 0) / rate;
    }
    const mcap = (Number.parseFloat(entryMcap) || 0) / rate;
    if (mcap <= 0 || pair.marketCap <= 0) return 0;
    return pair.priceUsd * (mcap / pair.marketCap);
  }, [mode, entryPrice, entryMcap, rate, pair.marketCap, pair.priceUsd]);

  const ready = investmentUsd > 0 && entryPriceUsd > 0;

  const position = useMemo(() => {
    if (!ready) return null;
    return evaluatePosition({
      amount: investmentUsd / entryPriceUsd,
      entryPriceUsd,
      currentPriceUsd: pair.priceUsd,
    });
  }, [ready, investmentUsd, entryPriceUsd, pair.priceUsd]);

  const projectionInput = {
    investmentUsd,
    entryPriceUsd,
    currentPriceUsd: pair.priceUsd,
    currentMarketCapUsd: pair.marketCap,
  };

  const targets = useMemo(
    () => (ready ? projectTargets(projectionInput) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, investmentUsd, entryPriceUsd, pair.priceUsd, pair.marketCap],
  );

  const customTarget = useMemo(() => {
    const value = (Number.parseFloat(targetMcap) || 0) / rate;
    if (!ready || value <= 0) return null;
    return projectAtMarketCap(projectionInput, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, targetMcap, rate, investmentUsd, entryPriceUsd, pair.priceUsd, pair.marketCap]);

  return (
    <div>
      <PanelHeader
        title="Profit calculator"
        subtitle={`If you'd bought ${pair.baseToken.symbol}`}
        icon={<Calculator className="h-4 w-4" />}
      />

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-ink-mid">Entry given as</span>
          <SegmentedControl<EntryMode>
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            size="sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="calc-investment" className="mb-1.5 block text-xs font-medium text-ink-mid">
              Investment
            </label>
            <Input
              id="calc-investment"
              value={investment}
              onChange={(event) => setInvestment(event.target.value)}
              inputMode="decimal"
              placeholder="1000"
              suffix={<span className="text-xs">{symbol}</span>}
            />
          </div>

          {mode === 'price' ? (
            <div>
              <label htmlFor="calc-entry-price" className="mb-1.5 block text-xs font-medium text-ink-mid">
                Entry price
              </label>
              <Input
                id="calc-entry-price"
                value={entryPrice}
                onChange={(event) => setEntryPrice(event.target.value)}
                inputMode="decimal"
                placeholder="0.00000031"
                suffix={<span className="text-xs">{symbol}</span>}
              />
            </div>
          ) : (
            <div>
              <label htmlFor="calc-entry-mcap" className="mb-1.5 block text-xs font-medium text-ink-mid">
                Entry market cap
              </label>
              <Input
                id="calc-entry-mcap"
                value={entryMcap}
                onChange={(event) => setEntryMcap(event.target.value)}
                inputMode="decimal"
                placeholder={String(Math.round(pair.marketCap / 4) || 100000)}
                suffix={<span className="text-xs">{symbol}</span>}
              />
            </div>
          )}
        </div>

        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-dim">
          Now:
          <span className="font-mono text-ink-low">{money(pair.marketCap)} mcap</span>
          ·
          <PriceText usd={pair.priceUsd} className="text-[11px] text-ink-low" />
        </p>

        {/* Result of the entry the user described */}
        {position && (
          <div
            className={cn(
              'rounded-md border px-3.5 py-3',
              position.pnlUsd >= 0
                ? 'border-up/25 bg-up/8'
                : 'border-down/25 bg-down/8',
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
                Worth today
              </span>
              <span className="tnum font-mono text-xl font-bold text-ink">
                {money(position.valueUsd)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span
                className={cn(
                  'tnum font-mono text-sm font-semibold',
                  position.pnlUsd >= 0 ? 'text-up' : 'text-down',
                )}
              >
                {position.pnlUsd >= 0 ? '+' : '−'}
                {money(Math.abs(position.pnlUsd))} ({formatPercent(position.pnlPct)})
              </span>
              <span className="tnum font-mono text-xs text-ink-low">
                {position.multiple.toFixed(2)}× · {formatQuantity(position.valueUsd / pair.priceUsd)}{' '}
                {pair.baseToken.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Forward projection */}
        {targets.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
              <TrendingUp className="h-3 w-3" />
              If it runs from here
            </p>

            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full">
                <thead>
                  <tr className="bg-sunken/60">
                    {['', 'Price', 'Mcap', 'Value'].map((label) => (
                      <th
                        key={label}
                        className={cn(
                          'px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-low',
                          label === '' ? 'text-left' : 'text-right',
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targets.map((row) => (
                    <tr key={row.label} className="border-t border-line-soft">
                      <td className="px-2.5 py-1.5">
                        <span className="rounded-xs bg-brand-500/12 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-500">
                          {row.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <PriceText usd={row.priceUsd} className="text-[11px] text-ink-mid" />
                      </td>
                      <td className="tnum px-2.5 py-1.5 text-right font-mono text-[11px] text-ink-mid">
                        {money(row.marketCapUsd)}
                      </td>
                      <td className="tnum px-2.5 py-1.5 text-right font-mono text-[11px] font-semibold text-ink">
                        {money(row.valueUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Explicit market-cap target */}
        {ready && (
          <div>
            <label htmlFor="calc-target" className="mb-1.5 block text-xs font-medium text-ink-mid">
              Or a specific market cap
            </label>
            <Input
              id="calc-target"
              value={targetMcap}
              onChange={(event) => setTargetMcap(event.target.value)}
              inputMode="decimal"
              placeholder="100000000"
              suffix={<span className="text-xs">{symbol}</span>}
            />

            {customTarget && (
              <p className="mt-2 text-xs text-ink-mid">
                At{' '}
                <span className="font-mono text-ink">
                  {formatCompact(customTarget.marketCapUsd / rate, symbol)}
                </span>{' '}
                your {money(investmentUsd)} is worth{' '}
                <span className="font-mono font-semibold text-ink">
                  {money(customTarget.valueUsd)}
                </span>{' '}
                <span
                  className={customTarget.pnlUsd >= 0 ? 'text-up' : 'text-down'}
                >
                  ({formatPercent(customTarget.pnlPct)})
                </span>
              </p>
            )}
          </div>
        )}

        {!ready && (
          <p className="text-[11px] leading-relaxed text-ink-dim">
            Enter an investment and an entry {mode === 'price' ? 'price' : 'market cap'} to
            see the result.
          </p>
        )}

        <p className="border-t border-line pt-2.5 text-[11px] leading-relaxed text-ink-dim">
          Projections assume a fixed supply and no fees, tax or slippage. They
          are arithmetic, not a forecast.
        </p>
      </div>
    </div>
  );
}
