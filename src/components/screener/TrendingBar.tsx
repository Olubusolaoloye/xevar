import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import type { Pair } from '@/data/types';

function TrendingItem({ pair, rank }: { pair: Pair; rank: number }) {
  return (
    <Link
      to={`/pair/${pair.id}`}
      className="group flex shrink-0 items-center gap-2 border-r border-line px-3.5 py-2 transition-colors hover:bg-raised"
    >
      <span className="tnum font-mono text-[10px] font-bold text-ink-dim">#{rank}</span>
      <TokenAvatar symbol={pair.baseToken.symbol} chain={pair.chain} size="sm" />
      <span className="text-xs font-semibold text-ink transition-colors group-hover:text-brand-500">
        {pair.baseToken.symbol}
      </span>
      <ChangeValue value={pair.change.h1} size="sm" />
    </Link>
  );
}

/**
 * The trending ticker.
 *
 * An infinite marquee built from two identical copies of the list translated by
 * -50% — the seam is invisible because the second copy is byte-identical to the
 * first. It pauses on hover so a ticker can actually be read and clicked, which
 * is the failure most marquees never fix.
 */
export function TrendingBar() {
  const pairs = useMarketStore((s) => s.pairs);

  const trending = useMemo(
    () =>
      pairs
        .filter((pair) => pair.trendingRank)
        .sort((a, b) => (a.trendingRank ?? 0) - (b.trendingRank ?? 0))
        .slice(0, 16),
    [pairs],
  );

  if (trending.length === 0) return null;

  return (
    <div className="marquee-host flex items-stretch overflow-hidden border-y border-line bg-surface">
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-line bg-surface px-3">
        <Flame className="h-3.5 w-3.5 text-warn" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-mid">
          Trending
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="marquee-track flex w-max">
          {/* Two passes: the duplicate is what makes the loop seamless. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex" aria-hidden={copy === 1}>
              {trending.map((pair, index) => (
                <TrendingItem key={`${copy}-${pair.id}`} pair={pair} rank={index + 1} />
              ))}
            </div>
          ))}
        </div>

        {/* Edge fades so items dissolve rather than being hard-clipped. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
      </div>
    </div>
  );
}
