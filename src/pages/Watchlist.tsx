import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from '@/data/types';
import { marketSummary } from '@/data/query';
import { useCurrency } from '@/hooks/useCurrency';
import { useMarketStore } from '@/store/useMarketStore';
import { useScreenerStore } from '@/store/useScreenerStore';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Stat } from '@/components/ui/Stat';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { PairTable } from '@/components/screener/PairTable';

const TIMEFRAME_OPTIONS = TIMEFRAMES.map((tf) => ({
  value: tf,
  label: TIMEFRAME_LABEL[tf],
}));

export function Watchlist() {
  const pairs = useMarketStore((s) => s.pairs);
  const watchlist = useScreenerStore((s) => s.watchlist);
  const timeframe = useScreenerStore((s) => s.timeframe);
  const setTimeframe = useScreenerStore((s) => s.setTimeframe);
  const { compact: money } = useCurrency();

  // Preserve the order the user starred things in, rather than board order.
  const watched = useMemo(
    () =>
      watchlist
        .map((id) => pairs.find((pair) => pair.id === id))
        .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair)),
    [watchlist, pairs],
  );

  const summary = useMemo(() => marketSummary(watched), [watched]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Tracked"
        title="Watchlist"
        description="Pairs you have starred, updating live alongside the rest of the board."
        action={
          watched.length > 0 ? (
            <SegmentedControl<Timeframe>
              options={TIMEFRAME_OPTIONS}
              value={timeframe}
              onChange={setTimeframe}
              size="sm"
            />
          ) : undefined
        }
      />

      {watched.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
          <div className="bg-surface p-4">
            <Stat label="Pairs watched" value={watched.length} />
          </div>
          <div className="bg-surface p-4">
            <Stat label="Combined liquidity" value={money(summary.liquidity)} />
          </div>
          <div className="bg-surface p-4">
            <Stat label="24h volume" value={money(summary.volume24h)} />
          </div>
          <div className="bg-surface p-4">
            <Stat
              label="Breadth"
              value={`${summary.breadth.toFixed(0)}% green`}
              detail={`${summary.gainers} up · ${summary.losers} down`}
            />
          </div>
        </div>
      )}

      <Panel className="mt-4 overflow-hidden">
        <PairTable
          pairs={watched}
          timeframe={timeframe}
          emptyTitle="Your watchlist is empty"
          emptyDescription="Star any pair from the screener and it will appear here, tracked live."
          emptyAction={
            <Link to="/screener">
              <Button variant="primary" size="sm">
                <Star className="h-3.5 w-3.5" />
                Browse the screener
              </Button>
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
