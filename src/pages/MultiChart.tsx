import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useMarketStore } from '@/store/useMarketStore';
import { reviewBackend, selectReviews, useReviewStore } from '@/store/useReviewStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthForm } from '@/components/auth/AuthForm';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceText } from '@/components/ui/PriceText';
import { ChangeValue } from '@/components/ui/ChangeValue';
import { TokenAvatar } from '@/components/ui/TokenAvatar';
import { ChainChip } from '@/components/ui/ChainChip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriceChart } from '@/components/pair/PriceChart';
import {
  CommunityCompare,
  DetailsCompare,
  GainsCompare,
  TokenomicsCompare,
} from '@/components/compare/CompareSheet';
import { CommunityPanel } from '@/components/compare/CommunityPanel';
import type { Pair } from '@/data/types';

type Lens = 'charts' | 'details' | 'tokenomics' | 'gains' | 'community';

const LENSES: Array<{ value: Lens; label: string }> = [
  { value: 'charts', label: 'Charts' },
  { value: 'details', label: 'Details' },
  { value: 'tokenomics', label: 'Tokenomics' },
  { value: 'gains', label: 'Gains' },
  { value: 'community', label: 'Community' },
];

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
        className="h-8 min-w-0 rounded-md border border-line bg-sunken px-2 text-xs text-ink focus:border-brand-500/50 focus:outline-none"
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

/** The identity strip that sits above every lens, so the sides never swap. */
function TokenHeading({ pair, align }: { pair: Pair; align: 'left' | 'right' }) {
  const { compact: money } = useCurrency();

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5',
        align === 'right' && 'flex-row-reverse text-right',
      )}
    >
      <TokenAvatar
        symbol={pair.baseToken.symbol}
        chain={pair.chain}
        src={pair.imageUrl}
        size="sm"
      />
      <div className="min-w-0">
        <p
          className={cn(
            'flex items-center gap-1.5 truncate text-sm font-semibold text-ink',
            align === 'right' && 'flex-row-reverse',
          )}
        >
          {pair.baseToken.symbol}
          <ChainChip chain={pair.chain} compact />
        </p>
        <p className="truncate text-[11px] text-ink-low">
          {pair.marketCap > 0 ? money(pair.marketCap) : pair.dex}
        </p>
      </div>
    </div>
  );
}

/**
 * Who is on which side.
 *
 * Repeated above every comparison table. Without it a reader scrolling a
 * column of numbers has to remember which token they put on the left, and the
 * dot marking the better side means nothing.
 */
function IdentityStrip({ left, right }: { left: Pair; right: Pair }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-4 py-3">
      <TokenHeading pair={left} align="left" />
      <span className="px-2 text-[11px] font-medium text-ink-dim">vs</span>
      <TokenHeading pair={right} align="right" />
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
        subtitle={`${pair.dex} · MCap ${pair.marketCap > 0 ? money(pair.marketCap) : '—'}`}
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
 * Charts were the whole page once. They are now one lens of five, because two
 * price lines answer "which moved more" and almost nothing else — a reader
 * deciding between two projects wants what they are, what the supply looks
 * like, how each has moved across every window, and what other people make of
 * them.
 *
 * It works on a phone now too. The stacked-charts objection that kept this
 * desktop-only was about charts specifically; a comparison table reads fine in
 * one column, and refusing to render anything on a phone served nobody.
 */
export function MultiChart() {
  const pairs = useMarketStore((s) => s.pairs);

  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [lens, setLens] = useState<Lens>('charts');

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

  /* Reviews are loaded for whichever two tokens are selected, not for the
     whole board. The community lens is one of five and most visits never open
     it, so fetching every token's reviews up front would be a request per
     listing to render a tab nobody clicked. */
  useEffect(() => {
    const tokens = [left, right]
      .filter((pair): pair is Pair => Boolean(pair))
      .map((pair) => ({ chain: pair.chain, address: pair.baseToken.address }));
    if (tokens.length > 0) reviewBackend.watch(tokens);
  }, [left, right]);

  const leftReviews = useReviewStore(
    selectReviews(left?.chain ?? '', left?.baseToken.address ?? ''),
  );
  const rightReviews = useReviewStore(
    selectReviews(right?.chain ?? '', right?.baseToken.address ?? ''),
  );

  const signedIn = useAuthStore((s) => Boolean(s.userId && s.email));

  const spread = left && right ? left.change.h24 - right.change.h24 : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Compare"
        title="Compare tokens"
        description="Two listed tokens, side by side — charts, details, tokenomics, how each has moved, and what the community makes of them."
      />

      {pairs.length < 2 ? (
        <Panel className="mt-5">
          <EmptyState
            icon={<LineChart className="h-5 w-5" />}
            title="Two listings are needed to compare"
            description="List at least two tokens and they can be compared side by side."
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
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5">
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
              <span className="text-xs text-ink-low sm:ml-auto">
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

          <div className="mt-4 overflow-x-auto">
            <SegmentedControl<Lens>
              options={LENSES}
              value={lens}
              onChange={setLens}
              size="sm"
            />
          </div>

          {left && right && (
            <div className="mt-4">
              {lens === 'charts' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartPane pair={left} />
                  <ChartPane pair={right} />
                </div>
              ) : lens === 'community' ? (
                <div className="space-y-4">
                  <Panel className="overflow-hidden">
                    <IdentityStrip left={left} right={right} />
                    <CommunityCompare
                      leftReviews={leftReviews}
                      rightReviews={rightReviews}
                    />
                  </Panel>

                  {/* One sign-in for the page.

                      Each panel below can ask for an account on its own, which
                      is right on a token page where there is only one. Here
                      there are two panels side by side, and two identical
                      email-and-password forms on one screen read as two
                      different accounts to make. So the panels are told to
                      show the invitation without the form, and the form is
                      rendered once, here. */}
                  {!signedIn && (
                    <Panel className="overflow-hidden">
                      <PanelHeader
                        title="Rate these tokens"
                        subtitle="One account, both panels"
                      />
                      <div className="p-4">
                        <AuthForm
                          idPrefix="compare"
                          signUpLabel="Create account"
                          className="overflow-hidden"
                        />
                      </div>
                    </Panel>
                  )}

                  <div className="grid gap-4 lg:grid-cols-2">
                    {[left, right].map((pair) => (
                      <Panel key={pair.id} className="overflow-hidden">
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
                            </span>
                          }
                          subtitle="Ratings and comments"
                        />
                        <CommunityPanel pair={pair} showAuth={false} />
                      </Panel>
                    ))}
                  </div>
                </div>
              ) : (
                /* Capped rather than full-bleed. The rows put each value
                   beside the centred label, so on a wide screen a full-width
                   panel leaves two empty columns at the edges and pushes the
                   two sides so far apart they stop reading as a pair. The
                   community lens skips the cap because it has two panels
                   beneath it to line up with. */
                <Panel className="mx-auto max-w-4xl overflow-hidden">
                  <IdentityStrip left={left} right={right} />

                  {lens === 'details' && <DetailsCompare left={left} right={right} />}
                  {lens === 'tokenomics' && <TokenomicsCompare left={left} right={right} />}
                  {lens === 'gains' && <GainsCompare left={left} right={right} />}
                </Panel>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
