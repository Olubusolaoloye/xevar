import { useState } from 'react';
import { Rows2, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from '@/data/types';
import { activeFilterCount } from '@/data/query';
import { useScreenerStore } from '@/store/useScreenerStore';
import { useScreenerResults } from '@/hooks/useScreenerQuery';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FilterRail } from '@/components/screener/FilterRail';
import { PairTable } from '@/components/screener/PairTable';
import { PresetTabs } from '@/components/screener/PresetTabs';
import { TrendingBar } from '@/components/screener/TrendingBar';

const TIMEFRAME_OPTIONS = TIMEFRAMES.map((tf) => ({
  value: tf,
  label: TIMEFRAME_LABEL[tf],
  title: `Show change, volume and transactions over ${TIMEFRAME_LABEL[tf]}`,
}));

/**
 * The screener.
 *
 * Layout is a fixed filter rail beside a scrolling board on desktop, collapsing
 * to a full-height drawer below `xl`. The toolbar is sticky so sorting and
 * timeframe stay reachable no matter how far down the board you are.
 */
export function Screener() {
  const { query, results } = useScreenerResults();
  const search = useScreenerStore((s) => s.search);
  const setSearch = useScreenerStore((s) => s.setSearch);
  const timeframe = useScreenerStore((s) => s.timeframe);
  const setTimeframe = useScreenerStore((s) => s.setTimeframe);
  const density = useScreenerStore((s) => s.density);
  const setDensity = useScreenerStore((s) => s.setDensity);
  const resetFilters = useScreenerStore((s) => s.resetFilters);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterCount = activeFilterCount(query);

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Screener</h1>
      <TrendingBar />

      <div className="flex min-h-0 flex-1">
        {/* Desktop filter rail */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[248px] shrink-0 overflow-y-auto border-r border-line bg-surface xl:block">
          <FilterRail query={query} />
        </aside>

        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="sticky top-14 z-30 border-b border-line bg-canvas/90 backdrop-blur-xl">
            <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by token, pair or address…"
                icon={<Search className="h-3.5 w-3.5" />}
                suffix={
                  search ? (
                    <button
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="transition-colors hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : undefined
                }
                className="max-w-xs"
              />

              <Button
                variant="outline"
                size="md"
                onClick={() => setDrawerOpen(true)}
                className="xl:hidden"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {filterCount > 0 && <Badge tone="brand">{filterCount}</Badge>}
              </Button>

              <div className="ml-auto flex items-center gap-2">
                <p className="tnum hidden font-mono text-xs text-ink-low sm:block">
                  {results.length} pairs
                </p>

                <SegmentedControl<Timeframe>
                  options={TIMEFRAME_OPTIONS}
                  value={timeframe}
                  onChange={setTimeframe}
                  size="sm"
                />

                <button
                  onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
                  title={density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
                  aria-label={density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
                  className="hidden h-7 w-7 items-center justify-center rounded-sm border border-line bg-sunken text-ink-low transition-colors hover:text-ink lg:inline-flex"
                >
                  {density === 'compact' ? (
                    <Rows3 className="h-3.5 w-3.5" />
                  ) : (
                    <Rows2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="border-t border-line-soft px-3 py-1.5 sm:px-4">
              <PresetTabs />
            </div>
          </div>

          <PairTable
            pairs={results}
            timeframe={timeframe}
            emptyAction={
              filterCount > 0 ? (
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-100 xl:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              'absolute inset-y-0 right-0 w-[min(320px,88vw)] overflow-y-auto',
              'border-l border-line-strong bg-surface shadow-popover',
            )}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
              <span className="font-display text-sm font-semibold text-ink">Filters</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                className="rounded-sm p-1 text-ink-low hover:bg-raised hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <FilterRail query={query} />

            <div className="sticky bottom-0 border-t border-line bg-surface p-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setDrawerOpen(false)}
              >
                Show {results.length} pairs
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
