import { useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompact, formatPercent, formatPrice } from '@/lib/format';
import {
  downloadCard,
  openXComposer,
  renderCard,
  type CardContent,
} from '@/lib/shareCard';
import { CHAINS } from '@/data/chains';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/Button';
import { PanelHeader } from '@/components/ui/Panel';
import type { Pair } from '@/data/types';

const MULTIPLES = [10, 25, 50, 100] as const;

type CardKind = 'dream' | 'change';

/**
 * Shareable cards for a token.
 *
 * Two kinds, because they answer different questions: a forward-looking "what
 * if this runs" card, and a factual 24-hour move card.
 *
 * The dream card is explicitly labelled a projection and carries a disclaimer
 * in the image itself. A card showing a made-up future number with no such
 * mark, circulating detached from its context, is how people end up treating
 * arithmetic as a forecast.
 */
export function ShareCards({ pair }: { pair: Pair }) {
  const { symbol, rate, compact: money } = useCurrency();

  const [investment, setInvestment] = useState('1000');
  const [multiple, setMultiple] = useState<number>(10);
  const [busy, setBusy] = useState<CardKind | null>(null);
  const [done, setDone] = useState<CardKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const investmentUsd = (Number.parseFloat(investment) || 0) / rate;
  const projectedUsd = investmentUsd * multiple;

  const build = (kind: CardKind): CardContent => {
    const base = {
      tokenSymbol: pair.baseToken.symbol,
      tokenName: pair.baseToken.name,
      chainLabel: CHAINS[pair.chain].name,
      logoUrl: pair.imageUrl,
    };

    if (kind === 'dream') {
      return {
        ...base,
        eyebrow: `If ${pair.baseToken.symbol} runs ${multiple}×`,
        headline: formatCompact(projectedUsd * rate, symbol),
        headlineTone: 'brand',
        stats: [
          { label: 'Invested', value: formatCompact(investmentUsd * rate, symbol) },
          { label: 'Multiple', value: `${multiple}×` },
          { label: 'At price', value: formatPrice(pair.priceUsd * multiple * rate, symbol) },
          { label: 'At mcap', value: formatCompact(pair.marketCap * multiple * rate, symbol) },
        ],
        footnote: 'Projection, not a forecast · not financial advice',
      };
    }

    const up = pair.change.h24 >= 0;
    return {
      ...base,
      eyebrow: 'Last 24 hours',
      headline: formatPercent(pair.change.h24),
      headlineTone: up ? 'up' : 'down',
      stats: [
        { label: 'Price', value: formatPrice(pair.priceUsd * rate, symbol) },
        { label: 'Volume', value: formatCompact(pair.volume.h24 * rate, symbol) },
        { label: 'Liquidity', value: formatCompact(pair.liquidityUsd * rate, symbol) },
        { label: 'Mcap', value: formatCompact(pair.marketCap * rate, symbol) },
      ],
      footnote: `${pair.dex} · panscreener`,
    };
  };

  const generate = async (kind: CardKind, share: boolean) => {
    setBusy(kind);
    setError(null);
    try {
      const blob = await renderCard(build(kind));
      downloadCard(
        blob,
        `panscreener-${pair.baseToken.symbol.toLowerCase()}-${kind}.png`,
      );
      setDone(kind);
      setTimeout(() => setDone(null), 4000);

      if (share) {
        openXComposer(
          kind === 'dream'
            ? `$${pair.baseToken.symbol} at ${multiple}× 📈 — charted on PanScreener`
            : `$${pair.baseToken.symbol} ${formatPercent(pair.change.h24)} in 24h — charted on PanScreener`,
        );
      }
    } catch {
      setError('The card could not be generated in this browser.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PanelHeader
        title="Share a card"
        subtitle="Download a PNG for X or Telegram"
        icon={<ImageIcon className="h-4 w-4" />}
      />

      <div className="space-y-3 p-4">
        {/* Dream card */}
        <div className="rounded-md border border-line bg-sunken px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
            Dream P&amp;L
          </p>

          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="card-invest" className="text-[11px] text-ink-mid">
              If I put in
            </label>
            <input
              id="card-invest"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              inputMode="decimal"
              className="h-8 w-24 rounded-md border border-line bg-surface px-2 font-mono text-xs text-ink focus:border-brand-500/50 focus:outline-none"
            />
            <span className="text-[11px] text-ink-dim">{symbol}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {MULTIPLES.map((m) => (
              <button
                key={m}
                onClick={() => setMultiple(m)}
                aria-pressed={multiple === m}
                className={cn(
                  'rounded-sm border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  multiple === m
                    ? 'border-brand-500/40 bg-brand-500/12 text-brand-500'
                    : 'border-line bg-surface text-ink-low hover:border-line-strong hover:text-ink-mid',
                )}
              >
                {m}×
              </button>
            ))}
          </div>

          <p className="tnum mt-2.5 font-mono text-lg font-bold text-ink">
            {money(projectedUsd)}
          </p>
          <p className="text-[11px] text-ink-dim">
            at {money(pair.marketCap * multiple)} market cap
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={busy !== null || investmentUsd <= 0}
              onClick={() => void generate('dream', false)}
            >
              {busy === 'dream' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {done === 'dream' ? 'Saved' : 'Download'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || investmentUsd <= 0}
              onClick={() => void generate('dream', true)}
            >
              <Share2 className="h-3 w-3" />
              Post to X
            </Button>
          </div>
        </div>

        {/* 24h change card */}
        <div className="rounded-md border border-line bg-sunken px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
            24-hour move
          </p>
          <p
            className={cn(
              'tnum mt-1 font-mono text-lg font-bold',
              pair.change.h24 >= 0 ? 'text-up' : 'text-down',
            )}
          >
            {formatPercent(pair.change.h24)}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void generate('change', false)}
            >
              {busy === 'change' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {done === 'change' ? 'Saved' : 'Download'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void generate('change', true)}
            >
              <Share2 className="h-3 w-3" />
              Post to X
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-down">{error}</p>}

        <p className="border-t border-line pt-2.5 text-[11px] leading-relaxed text-ink-dim">
          “Post to X” saves the PNG and opens the composer — attach the saved
          image there. No website can put a file into X's composer for you.
        </p>
      </div>
    </div>
  );
}
