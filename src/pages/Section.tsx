import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Flame, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatAge } from '@/lib/format';
import { useMarketStore } from '@/store/useMarketStore';
import { useListingStore } from '@/store/useListingStore';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PairTable } from '@/components/screener/PairTable';
import type { Pair } from '@/data/types';

type SectionId = 'new' | 'gainers' | 'losers' | 'trending';

interface SectionSpec {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  /** Ranks the board. Pairs are already filtered to what is listed. */
  rank: (pairs: Pair[], listedAt: Map<string, number>) => Pair[];
}

const SECTIONS: Record<SectionId, SectionSpec> = {
  new: {
    title: 'New listings',
    eyebrow: 'Recently added',
    description: 'Tokens most recently listed on PanScreener, newest first.',
    icon: Sparkles,
    // Ordered by when the token was *listed here*, not when its pool was
    // created on-chain. A long-established token listed this morning is new to
    // this board, which is the thing a reader of this page is asking about.
    rank: (pairs, listedAt) =>
      [...pairs].sort(
        (a, b) =>
          (listedAt.get(b.tracked?.tokenId ?? '') ?? 0) -
          (listedAt.get(a.tracked?.tokenId ?? '') ?? 0),
      ),
  },
  gainers: {
    title: 'Gainers',
    eyebrow: '24 hours',
    description: 'Listed tokens up the most over the last 24 hours.',
    icon: TrendingUp,
    rank: (pairs) =>
      [...pairs].filter((p) => p.change.h24 > 0).sort((a, b) => b.change.h24 - a.change.h24),
  },
  losers: {
    title: 'Losers',
    eyebrow: '24 hours',
    description: 'Listed tokens down the most over the last 24 hours.',
    icon: TrendingDown,
    rank: (pairs) =>
      [...pairs].filter((p) => p.change.h24 < 0).sort((a, b) => a.change.h24 - b.change.h24),
  },
  trending: {
    title: 'Trending',
    eyebrow: 'Last hour',
    description: 'Listed tokens with the most activity over the last hour.',
    icon: Flame,
    // Volume and momentum together: either alone ranks badly. Pure volume just
    // lists the biggest token every time; pure momentum surfaces dust moving on
    // a single trade.
    rank: (pairs) =>
      [...pairs].sort(
        (a, b) =>
          Math.log10(Math.max(1, b.volume.h1)) * 1.8 +
          b.change.h1 * 0.08 -
          (Math.log10(Math.max(1, a.volume.h1)) * 1.8 + a.change.h1 * 0.08),
      ),
  },
};

/** A ranked cut of the listed board, reached from the desktop rail. */
export function Section() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const pairs = useMarketStore((s) => s.pairs);
  const listings = useListingStore((s) => s.tokens);

  const spec = SECTIONS[(sectionId ?? '') as SectionId];

  const listedAt = useMemo(
    () => new Map(listings.map((t) => [t.id, t.addedAt])),
    [listings],
  );

  const ranked = useMemo(
    () => (spec ? spec.rank(pairs, listedAt) : []),
    [spec, pairs, listedAt],
  );

  if (!spec) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="font-display text-sm font-semibold text-ink">Unknown section</p>
        <Link to="/screener" className="mt-3 inline-block">
          <Button size="sm" variant="outline">
            Back to the screener
          </Button>
        </Link>
      </div>
    );
  }

  const newest = sectionId === 'new' ? ranked[0] : undefined;
  const newestListed = newest?.tracked?.tokenId
    ? listedAt.get(newest.tracked.tokenId)
    : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow={spec.eyebrow}
        title={spec.title}
        description={spec.description}
        action={
          <Link to="/screener">
            <Button size="sm" variant="outline">
              Full screener
            </Button>
          </Link>
        }
      />

      {newestListed && (
        <p className="mt-2 text-xs text-ink-low">
          Most recent listing added {formatAge(newestListed)} ago.
        </p>
      )}

      <Panel className="mt-5 overflow-hidden">
        <PairTable
          pairs={ranked}
          timeframe={sectionId === 'trending' ? 'h1' : 'h24'}
          emptyTitle={`Nothing in ${spec.title.toLowerCase()} right now`}
          emptyDescription="Either no listing qualifies, or the market feed has not resolved yet."
          emptyAction={
            <Link to="/admin">
              <Button size="sm" variant="outline">
                Manage listings
              </Button>
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
