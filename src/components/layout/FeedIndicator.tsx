import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { useMarketStore } from '@/store/useMarketStore';
import { useAdminStore } from '@/store/useAdminStore';
import type { FeedStatus } from '@/data/types';

const COPY: Record<FeedStatus, { label: string; detail: string; dot: string; text: string }> = {
  connecting: {
    label: 'Loading',
    detail: 'Fetching live pairs from DexScreener…',
    dot: 'bg-warn',
    text: 'text-warn',
  },
  live: {
    label: 'Live',
    detail: 'Real market data, refreshed every 30 seconds. Majors also stream tick-by-tick.',
    dot: 'bg-brand-500 pulse-ring',
    text: 'text-brand-500',
  },
  stale: {
    label: 'Cached',
    detail:
      'The last refresh failed, so these are the most recent values received rather than live ones. Retrying automatically.',
    dot: 'bg-warn',
    text: 'text-warn',
  },
  offline: {
    label: 'Offline',
    detail: 'No market data available. Showing the last known board.',
    dot: 'bg-ink-dim',
    text: 'text-ink-low',
  },
};

/**
 * Connection state for the market feed.
 *
 * A data product has to be honest about whether its numbers are current.
 * Showing a stale price with no indication that the socket died is worse than
 * showing nothing.
 */
export function FeedIndicator({ className }: { className?: string }) {
  const status = useMarketStore((s) => s.status);
  const updatedAt = useMarketStore((s) => s.updatedAt);
  const pollSeconds = useAdminStore((s) => s.pollSeconds);
  const copy = COPY[status];

  /**
   * Seconds since the last refresh, ticking.
   *
   * Without this there is no way to tell a board that is updating from one
   * that quietly stopped — prices only visibly change when they actually
   * move, which for a thin token can be minutes apart. A counter that resets
   * is proof the feed is alive.
   */
  const [age, setAge] = useState(0);

  useEffect(() => {
    const tick = () => setAge(Math.max(0, Math.round((Date.now() - updatedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [updatedAt]);

  return (
    <Tooltip
      content={`${copy.detail} Last refresh ${age}s ago; polling every ${pollSeconds}s.`}
      side="bottom"
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xs border border-line bg-sunken px-2 py-1',
          'text-[10px] font-semibold uppercase tracking-wider',
          copy.text,
          className,
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', copy.dot)} />
        {copy.label}
        {status === 'live' && (
          <span className="tnum font-mono text-ink-low">{age}s</span>
        )}
      </span>
    </Tooltip>
  );
}
