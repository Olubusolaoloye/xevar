import { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { truncateAddress } from '@/lib/format';
import { useCuratedWatchlist } from '@/hooks/useCuratedWatchlist';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PairTable } from '@/components/screener/PairTable';
import type { Timeframe } from '@/data/types';

/**
 * The curated watchlist, shown above whatever the visitor has starred.
 *
 * It greets a first-time visitor with something to look at instead of an empty
 * page, and it goes away for good on this device the moment they say so —
 * dismissal asks for confirmation once, because "for good" is the point and an
 * accidental tap on a close button should not spend it.
 */
export function CuratedList({ timeframe }: { timeframe: Timeframe }) {
  const { name, rows, unresolved, loading, visible, dismiss } = useCuratedWatchlist();
  const [confirming, setConfirming] = useState(false);

  if (!visible) return null;

  const pairs = rows.map((row) => row.pair!);

  return (
    <Panel className="mb-4 overflow-hidden" elevation="raised">
      <PanelHeader
        title={name}
        subtitle={
          loading
            ? 'Resolving contracts…'
            : `${pairs.length} token${pairs.length === 1 ? '' : 's'} · curated list`
        }
        icon={<Sparkles className="h-4 w-4 text-brand-500" />}
        action={
          confirming ? (
            <span className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
              <Button size="sm" variant="danger" onClick={dismiss}>
                Remove
              </Button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Remove the ${name} list`}
              title={`Remove the ${name} list from this device`}
              className="rounded-sm p-1 text-ink-low transition-colors hover:bg-sunken hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )
        }
      />

      {confirming && (
        <p className="border-b border-line bg-sunken px-4 py-2.5 text-xs text-ink-mid">
          Removing hides {name} on this device for good. You can bring it back
          from Settings.
        </p>
      )}

      {loading && pairs.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-xs text-ink-low">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Looking up each contract to find which network it trades on…
        </p>
      ) : (
        <PairTable
          pairs={pairs}
          timeframe={timeframe}
          emptyTitle={`${name} is not trading right now`}
          emptyDescription="None of these contracts returned a live pool. They will appear as soon as the market feed can see them."
        />
      )}

      {!loading && unresolved.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[11px] leading-relaxed text-ink-dim">
            No live pool found for{' '}
            {unresolved.map((row, i) => (
              <span key={row.entry.address}>
                {i > 0 && ', '}
                <span className="font-semibold text-ink-low">{row.entry.symbol}</span>{' '}
                <span className="font-mono">{truncateAddress(row.entry.address, 6, 4)}</span>
              </span>
            ))}
            . Either the market provider does not index it yet, or the contract
            has no pool.
          </p>
        </div>
      )}
    </Panel>
  );
}
