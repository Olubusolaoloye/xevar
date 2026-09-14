import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Droplets,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCompact, formatCount } from '@/lib/format';
import { marketSummary } from '@/data/query';
import { useCurrency } from '@/hooks/useCurrency';
import { useMarketStore } from '@/store/useMarketStore';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Stat } from '@/components/ui/Stat';
import { MiniPairList } from '@/components/screener/MiniPairList';
import { PairTable } from '@/components/screener/PairTable';
import { TrendingBar } from '@/components/screener/TrendingBar';
import { AdCarousel } from '@/components/marketing/AdCarousel';

/**
 * The market pulse strip.
 *
 * Breadth — the share of the board that is green — is the one number that
 * characterises a whole market in a glance, so it gets its own visual meter
 * rather than being another figure in a row.
 */
function MarketPulse() {
  const pairs = useMarketStore((s) => s.pairs);
  const { compact: money } = useCurrency();
  const summary = useMemo(() => marketSummary(pairs), [pairs]);

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
      <div className="bg-surface p-4">
        <Stat
          label="24h volume"
          value={money(summary.volume24h)}
          detail={`${formatCount(summary.pairCount)} pairs tracked`}
          icon={<Activity className="h-3 w-3" />}
        />
      </div>

      <div className="bg-surface p-4">
        <Stat
          label="Total liquidity"
          value={money(summary.liquidity)}
          detail="Pooled across 8 networks"
          icon={<Droplets className="h-3 w-3" />}
        />
      </div>

      <div className="bg-surface p-4">
        <Stat
          label="24h transactions"
          value={formatCompact(summary.txns24h)}
          detail={`${formatCount(summary.gainers)} up · ${formatCount(summary.losers)} down`}
          icon={<Flame className="h-3 w-3" />}
        />
      </div>

      <div className="bg-surface p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
          Market breadth
        </p>
        <p className="tnum mt-1 font-mono text-base font-semibold text-ink">
          {summary.breadth.toFixed(0)}% green
        </p>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-down/30">
          <div
            className="bg-up transition-[width] duration-700 ease-[var(--ease-out-quint)]"
            style={{ width: `${summary.breadth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function Overview() {
  const pairs = useMarketStore((s) => s.pairs);

  /**
   * The board is a curated list now, not a market-wide firehose, so there is no
   * liquidity floor here: the user picked these tokens deliberately and
   * filtering their own choices off their own overview would be wrong.
   *
   * The split into gainers / losers / newest only says something when there are
   * enough tokens to rank. Below that it is three panels repeating the same
   * rows, so a small board collapses to one list instead.
   */
  const { gainers, losers, fresh, topVolume, compact } = useMemo(() => {
    const byChange = [...pairs].sort((a, b) => b.change.h24 - a.change.h24);

    return {
      compact: pairs.length < 6,
      gainers: byChange.filter((p) => p.change.h24 > 0).slice(0, 6),
      losers: [...byChange].reverse().filter((p) => p.change.h24 < 0).slice(0, 6),
      fresh: [...pairs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
      topVolume: [...pairs].sort((a, b) => b.volume.h24 - a.volume.h24).slice(0, 12),
    };
  }, [pairs]);

  return (
    <div>
      <AdCarousel />
      <TrendingBar />

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <MarketPulse />

        {!compact && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel>
              <PanelHeader
                title="Top gainers"
                subtitle="24 hours"
                icon={<TrendingUp className="h-4 w-4 text-up" />}
              />
              <MiniPairList pairs={gainers} emptyMessage="Nothing is up today." />
            </Panel>

            <Panel>
              <PanelHeader
                title="Top losers"
                subtitle="24 hours"
                icon={<TrendingDown className="h-4 w-4 text-down" />}
              />
              <MiniPairList pairs={losers} emptyMessage="Nothing is down today." />
            </Panel>

            <Panel>
              <PanelHeader
                title="New pairs"
                subtitle="Recently created"
                icon={<Sparkles className="h-4 w-4 text-brand-500" />}
              />
              <MiniPairList pairs={fresh} showAge timeframe="h1" />
            </Panel>
          </div>
        )}

        <Panel className="overflow-hidden">
          <PanelHeader
            title={compact ? 'Tracked tokens' : 'Highest volume'}
            subtitle={
              compact
                ? 'Everything currently on your board'
                : 'Across every tracked network'
            }
            icon={<Activity className="h-4 w-4" />}
            action={
              <Link to={compact ? '/admin' : '/screener'}>
                <Button size="sm" variant="ghost">
                  {compact ? 'Manage tokens' : 'Full screener'}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            }
          />
          <PairTable
            pairs={topVolume}
            timeframe="h24"
            pageSize={12}
            emptyTitle="No tokens on the board yet"
            emptyDescription="Add the tokens you want to follow and their live prices will appear here."
            emptyAction={
              <Link to="/admin">
                <Button size="sm" variant="primary">
                  Add tokens
                </Button>
              </Link>
            }
          />
        </Panel>
      </div>
    </div>
  );
}
