import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { useMarketStore } from '@/store/useMarketStore';
import type { FeedStatus } from '@/data/types';

const COPY: Record<FeedStatus, { label: string; detail: string; dot: string; text: string }> = {
  connecting: {
    label: 'Connecting',
    detail: 'Opening the live market stream…',
    dot: 'bg-warn',
    text: 'text-warn',
  },
  live: {
    label: 'Live',
    detail: 'Streaming real-time prices. Long-tail pairs are simulated.',
    dot: 'bg-brand-500 pulse-ring',
    text: 'text-brand-500',
  },
  reconnecting: {
    label: 'Reconnecting',
    detail: 'The stream dropped. Retrying with backoff.',
    dot: 'bg-warn',
    text: 'text-warn',
  },
  offline: {
    label: 'Offline',
    detail: 'No live stream available. Showing the last known board.',
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
  const copy = COPY[status];

  return (
    <Tooltip content={copy.detail} side="bottom">
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
      </span>
    </Tooltip>
  );
}
