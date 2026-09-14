import { useState } from 'react';
import { ArrowDown, ArrowUp, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScreenerStore } from '@/store/useScreenerStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tooltip } from '@/components/ui/Tooltip';
import type { Pair, SortKey, Timeframe } from '@/data/types';
import { COLUMNS, HIDE_CLASS } from './columns';
import { PairRow } from './PairRow';
import { PairCard } from './PairCard';

interface PairTableProps {
  pairs: Pair[];
  timeframe: Timeframe;
  /** Rows rendered before the "show more" control appears. */
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

/**
 * The screener board.
 *
 * Renders a dense table from `lg` up and a stacked card list below it — the
 * same data, two presentations, chosen by breakpoint rather than by squeezing
 * one layout into a size it was never designed for.
 *
 * Rows are paged rather than virtualised: a page of 50 keeps the DOM small
 * enough to stay smooth under live updates, without the scroll-position and
 * accessibility complications a virtualiser brings to a sortable table.
 */
export function PairTable({
  pairs,
  timeframe,
  pageSize = 50,
  emptyTitle = 'No pairs match these filters',
  emptyDescription = 'Try widening the liquidity or volume thresholds, or clearing a chain filter.',
  emptyAction,
}: PairTableProps) {
  const sortKey = useScreenerStore((s) => s.sortKey);
  const sortDirection = useScreenerStore((s) => s.sortDirection);
  const setSort = useScreenerStore((s) => s.setSort);
  const density = useScreenerStore((s) => s.density);

  const [visible, setVisible] = useState(pageSize);
  const shown = pairs.slice(0, visible);
  const compact = density === 'compact';

  if (pairs.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-5 w-5" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const renderSortIcon = (key?: SortKey) => {
    if (!key || key !== sortKey) return null;
    const Icon = sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return <Icon className="h-3 w-3" strokeWidth={3} />;
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-sunken/60">
              {COLUMNS.map((column) => {
                const sortable = Boolean(column.sortKey);
                const active = column.sortKey === sortKey;

                const label = column.help ? (
                  <Tooltip content={column.help} side="bottom">
                    <span className="border-b border-dotted border-ink-dim/50">
                      {column.label}
                    </span>
                  </Tooltip>
                ) : (
                  column.label
                );

                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      active
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'whitespace-nowrap px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.width,
                      column.hideBelow && HIDE_CLASS[column.hideBelow],
                      active ? 'text-brand-500' : 'text-ink-low',
                    )}
                  >
                    {sortable ? (
                      <button
                        onClick={() => setSort(column.sortKey!)}
                        className={cn(
                          'inline-flex items-center gap-1 transition-colors hover:text-ink',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {label}
                        {renderSortIcon(column.sortKey)}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {shown.map((pair, index) => (
              <PairRow
                key={pair.id}
                pair={pair}
                rank={index + 1}
                timeframe={timeframe}
                compact={compact}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile and tablet cards */}
      <div className="lg:hidden">
        {shown.map((pair, index) => (
          <PairCard key={pair.id} pair={pair} rank={index + 1} timeframe={timeframe} />
        ))}
      </div>

      {visible < pairs.length && (
        <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-4">
          <p className="text-xs text-ink-low">
            Showing {shown.length} of {pairs.length}
          </p>
          <Button size="sm" onClick={() => setVisible((v) => v + pageSize)}>
            Load {Math.min(pageSize, pairs.length - visible)} more
          </Button>
        </div>
      )}
    </>
  );
}
