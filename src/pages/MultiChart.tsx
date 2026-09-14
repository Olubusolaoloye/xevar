import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMarketStore } from '@/store/useMarketStore';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriceChart } from '@/components/pair/PriceChart';
import type { Pair } from '@/data/types';

function TokenPicker({
  label,
  pairs,
  value,
  exclude,
  onChange,
}: {
  label: string;
  pairs: Pair[];
  value: string;
  exclude?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`pick-${label}`} className="text-[11px] text-ink-low">
        {label}
      </label>
      <select
        id={`pick-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-line bg-sunken px-2 text-xs text-ink focus:border-brand-500/50 focus:outline-none"
      >
        {pairs
          // The same token in both panes compares nothing.
          .filter((p) => p.id !== exclude)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.baseToken.symbol} / {p.quoteToken.symbol}
            </option>
          ))}
      </select>
    </div>
  );
}

function ChartPane({ pair }: { pair: Pair }) {
  const { compact: money } = useCurrency();

  return (
    <Panel className="min-w-0 overflow-hidden">
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <TokenAvatar
              symbol={pair.baseToken.symbol}
              chain={pair.chain}
              src={pair.imageUrl}
              size="sm"
            />
            {pair.baseToken.symbol}
            <span className="text-ink-dim">/{pair.quoteToken.symbol}</span>
            <ChainChip chain={pair.chain} compact />
          </span>
        }
        subtitle={`${pair.dex} · Liq ${money(pair.liquidityUsd)}`}
        action={
          <Link to={`/pair/${pair.id}`}>
            <Button size="sm" variant="ghost">
              Open
            </Button>
          </Link>
        }
      />

      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
        <PriceText usd={pair.priceUsd} live className="font-display text-lg font-bold text-ink" />
        <ChangeValue value={pair.change.h24} arrow size="md" />
      </div>

      <PriceChart pair={pair} />
    </Panel>
  );
}

/**
 * Side-by-side comparison of two listed tokens.
 *
 * Desktop only, and genuinely so rather than by preference: two charts stacked
 * on a phone is just two charts, which the pair page already gives you. The
 * comparison only exists when both are in view at once.
 */
export function MultiChart() {
  const pairs = useMarketStore((s) => s.pairs);
  const wideEnough = useMediaQuery('(min-width: 1024px)');

  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  // Default to the two deepest listings once the board resolves.
  useEffect(() => {
    if (pairs.length === 0) return;
    const deepest = [...pairs].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    setLeftId((id) => (pairs.some((p) => p.id === id) ? id : (deepest[0]?.id ?? '')));
    setRightId((id) =>
      pairs.some((p) => p.id === id) ? id : (deepest[1]?.id ?? deepest[0]?.id ?? ''),
    );
  }, [pairs]);

  const left = useMemo(() => pairs.find((p) => p.id === leftId), [pairs, leftId]);
  const right = useMemo(() => pairs.find((p) => p.id === rightId), [pairs, rightId]);

  const spread =
    left && right ? left.change.h24 - right.change.h24 : null;

  if (!wideEnough) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={<Monitor className="h-5 w-5" />}
          title="Multi-chart needs a wider screen"
          description="Two charts side by side is the whole point — stacked on a phone it is just two charts, which a pair page already gives you. Open this on a desktop."
          action={
            <Link to="/screener">
              <Button size="sm" variant="outline">
                Back to the screener
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Compare"
        title="Multi-chart"
        description="Two listed tokens, charted together on the same screen."
      />

      {pairs.length < 2 ? (
        <Panel className="mt-5">
          <EmptyState
            icon={<LineChart className="h-5 w-5" />}
            title="Two listings are needed to compare"
            description="List at least two tokens and they can be charted side by side."
            action={
              <Link to="/admin">
                <Button size="sm" variant="primary">
                  Manage listings
                </Button>
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-4 py-2.5">
            <TokenPicker
              label="Left"
              pairs={pairs}
              value={leftId}
              exclude={rightId}
              onChange={setLeftId}
            />
            <TokenPicker
              label="Right"
              pairs={pairs}
              value={rightId}
              exclude={leftId}
              onChange={setRightId}
            />

            {spread !== null && (
              <span className="ml-auto text-xs text-ink-low">
                24h spread{' '}
                <span
                  className={cn(
                    'tnum font-mono font-semibold',
                    spread >= 0 ? 'text-up' : 'text-down',
                  )}
                >
                  {formatPercent(spread)}
                </span>
                <span className="text-ink-dim">
                  {' '}
                  in favour of {spread >= 0 ? left?.baseToken.symbol : right?.baseToken.symbol}
                </span>
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {left && <ChartPane pair={left} />}
            {right && <ChartPane pair={right} />}
          </div>
        </>
      )}
    </div>
  );
}
