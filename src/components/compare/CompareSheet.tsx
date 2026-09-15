import { ExternalLink } from 'lucide-react';
import { CHAINS } from '@/data/chains';
import { communityStrength, strengthLabel, type Review } from '@/data/communityScore';
import {
  formatAge,
  formatCompact,
  formatCount,
  formatPercent,
  formatPrice,
  truncateAddress,
} from '@/lib/format';
import { TIMEFRAMES, TIMEFRAME_LABEL, type Pair, type Timeframe } from '@/data/types';
import { cn } from '@/lib/utils';
import { CompareRow, CompareSection, compareValues } from './CompareRow';
import { Stars } from './StarRating';

/** A figure the provider did not report. Never rendered as a zero. */
const NONE = <span className="text-ink-dim">—</span>;

/** `null` where the provider reports nothing, so comparisons can abstain. */
function reported(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function money(value: number) {
  const n = reported(value);
  return n === null ? NONE : formatCompact(n, '$');
}

function ratio(numerator: number, denominator: number): number | null {
  const a = reported(numerator);
  const b = reported(denominator);
  return a === null || b === null ? null : a / b;
}

function ratioText(value: number | null, suffix = '×') {
  return value === null ? NONE : `${value.toFixed(2)}${suffix}`;
}

/**
 * A proportion as a percentage, unsigned.
 *
 * Not `formatPercent`, which prefixes a + or −. Those belong on a change: a
 * pool holding 7% of the cap has not risen by anything, and "+7.0%" says it
 * did.
 */
function percentText(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function changeText(value: number) {
  if (!Number.isFinite(value)) return NONE;
  return (
    <span className={cn(value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink-mid')}>
      {formatPercent(value)}
    </span>
  );
}

function explorerLink(pair: Pair, path: string, label: string) {
  const chain = CHAINS[pair.chain];
  return (
    <a
      href={`${chain.explorer}${path}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-ink-mid underline decoration-line-strong underline-offset-2 hover:text-ink"
    >
      {label}
      <ExternalLink className="h-3 w-3 text-ink-dim" />
    </a>
  );
}

/* -------------------------------------------------------------------------- */

export function DetailsCompare({ left, right }: { left: Pair; right: Pair }) {
  return (
    <CompareSection
      title="Details"
      note="What each token is and where it trades. Facts, not judgements — most of these rows have no better side."
    >
      <CompareRow
        label="Network"
        leftValue={CHAINS[left.chain].name}
        rightValue={CHAINS[right.chain].name}
      />
      <CompareRow label="Exchange" leftValue={left.dex} rightValue={right.dex} />
      <CompareRow
        label="Pair"
        leftValue={`${left.baseToken.symbol}/${left.quoteToken.symbol}`}
        rightValue={`${right.baseToken.symbol}/${right.quoteToken.symbol}`}
      />
      <CompareRow
        label="Pool age"
        hint="How long this pool has existed. A longer record is not a guarantee of anything, but a pool minted this morning has no record at all."
        leftValue={left.createdAt > 0 ? formatAge(left.createdAt) : NONE}
        rightValue={right.createdAt > 0 ? formatAge(right.createdAt) : NONE}
        // Older wins: the timestamp is smaller, so the better side is the lower
        // number.
        winner={compareValues(reported(left.createdAt), reported(right.createdAt), false)}
      />
      <CompareRow
        label="Contract pinned"
        hint="Whether the board quotes one exact contract address rather than resolving the ticker by search. An unpinned entry can match a lookalike sharing the symbol."
        leftValue={left.tracked?.pinned ? 'Yes' : 'No'}
        rightValue={right.tracked?.pinned ? 'Yes' : 'No'}
        winner={compareValues(
          left.tracked?.pinned ? 1 : 0,
          right.tracked?.pinned ? 1 : 0,
        )}
      />
      <CompareRow
        label="Verified"
        hint="An admin's assertion that this contract is the real project. Separate from being pinned, which only says the board is quoting one specific address."
        leftValue={left.tracked?.verified ? 'Yes' : 'No'}
        rightValue={right.tracked?.verified ? 'Yes' : 'No'}
        winner={compareValues(
          left.tracked?.verified ? 1 : 0,
          right.tracked?.verified ? 1 : 0,
        )}
      />
      <CompareRow
        label="Token contract"
        leftValue={explorerLink(
          left,
          `/token/${left.baseToken.address}`,
          truncateAddress(left.baseToken.address),
        )}
        rightValue={explorerLink(
          right,
          `/token/${right.baseToken.address}`,
          truncateAddress(right.baseToken.address),
        )}
      />
      <CompareRow
        label="Holders"
        hint="Linked rather than counted. No free, keyless provider reports a holder figure that can be trusted, and this is exactly the number people read as a distribution check before buying."
        leftValue={explorerLink(left, `/token/${left.baseToken.address}#balances`, 'Explorer')}
        rightValue={explorerLink(right, `/token/${right.baseToken.address}#balances`, 'Explorer')}
      />
    </CompareSection>
  );
}

/* -------------------------------------------------------------------------- */

export function TokenomicsCompare({ left, right }: { left: Pair; right: Pair }) {
  const leftFdvRatio = ratio(left.fdv, left.marketCap);
  const rightFdvRatio = ratio(right.fdv, right.marketCap);
  const leftDepth = ratio(left.liquidityUsd, left.marketCap);
  const rightDepth = ratio(right.liquidityUsd, right.marketCap);

  /* Supply is implied, not reported: market cap divided by price. The market
     provider gives no supply figure, and this division is exactly how the cap
     was computed in the first place — so it is a restatement, accurate to
     whatever the provider's own cap is worth, and not an independent source. */
  const supply = (pair: Pair) => ratio(pair.marketCap, pair.priceUsd);

  return (
    <CompareSection
      title="Tokenomics"
      note="Size, dilution and depth. Supply figures are implied from market cap and price — the market provider reports no supply of its own."
    >
      <CompareRow
        label="Price"
        leftValue={formatPrice(left.priceUsd)}
        rightValue={formatPrice(right.priceUsd)}
      />
      <CompareRow
        label="Market cap"
        hint="Circulating supply at the current price."
        leftValue={money(left.marketCap)}
        rightValue={money(right.marketCap)}
        winner={compareValues(reported(left.marketCap), reported(right.marketCap))}
      />
      <CompareRow
        label="Fully diluted"
        hint="What the cap becomes if every token that can exist does exist, at today's price."
        leftValue={money(left.fdv)}
        rightValue={money(right.fdv)}
      />
      <CompareRow
        label="FDV / cap"
        hint="How much supply is still to come. 1.00× means everything is already circulating; 4.00× means three quarters of the supply has yet to hit the market. Lower is less overhang."
        leftValue={ratioText(leftFdvRatio)}
        rightValue={ratioText(rightFdvRatio)}
        winner={compareValues(leftFdvRatio, rightFdvRatio, false)}
      />
      <CompareRow
        label="Liquidity"
        hint="Dollar depth in the pool. What is actually there to trade against."
        leftValue={money(left.liquidityUsd)}
        rightValue={money(right.liquidityUsd)}
        winner={compareValues(reported(left.liquidityUsd), reported(right.liquidityUsd))}
      />
      <CompareRow
        label="Liquidity / cap"
        hint="Depth relative to size. A large cap sitting on a thin pool moves hard on ordinary size — this is the ratio that says so."
        leftValue={leftDepth === null ? NONE : percentText(leftDepth)}
        rightValue={rightDepth === null ? NONE : percentText(rightDepth)}
        winner={compareValues(leftDepth, rightDepth)}
      />
      <CompareRow
        label="Implied supply"
        hint="Market cap ÷ price. A restatement of the provider's own cap, not an independent supply figure."
        leftValue={supply(left) === null ? NONE : formatCompact(supply(left)!)}
        rightValue={supply(right) === null ? NONE : formatCompact(supply(right)!)}
      />
    </CompareSection>
  );
}

/* -------------------------------------------------------------------------- */

export function GainsCompare({ left, right }: { left: Pair; right: Pair }) {
  const turnover = (pair: Pair) => ratio(pair.volume.h24, pair.liquidityUsd);
  const buyPressure = (pair: Pair) => {
    const { buys, sells } = pair.txns.h24;
    const total = buys + sells;
    return total > 0 ? (buys / total) * 100 : null;
  };

  return (
    <CompareSection
      title="Gains over time"
      note="The same windows side by side. Percentages are the pool's own price change — nothing here is annualised or extrapolated."
    >
      {TIMEFRAMES.map((tf: Timeframe) => (
        <CompareRow
          key={tf}
          label={TIMEFRAME_LABEL[tf]}
          leftValue={changeText(left.change[tf])}
          rightValue={changeText(right.change[tf])}
          winner={compareValues(left.change[tf], right.change[tf])}
        />
      ))}

      <CompareRow
        label="Volume (24h)"
        leftValue={money(left.volume.h24)}
        rightValue={money(right.volume.h24)}
        winner={compareValues(reported(left.volume.h24), reported(right.volume.h24))}
      />
      <CompareRow
        label="Turnover"
        hint="24h volume ÷ liquidity. How many times the pool traded through itself — the honest measure of activity, since raw volume just tracks size."
        leftValue={ratioText(turnover(left))}
        rightValue={ratioText(turnover(right))}
        winner={compareValues(turnover(left), turnover(right))}
      />
      <CompareRow
        label="Buy share (24h)"
        hint="Buys as a share of all trades. Above 50% means more transactions were buys — it says nothing about their size."
        leftValue={buyPressure(left) === null ? NONE : `${buyPressure(left)!.toFixed(0)}%`}
        rightValue={buyPressure(right) === null ? NONE : `${buyPressure(right)!.toFixed(0)}%`}
        winner={compareValues(buyPressure(left), buyPressure(right))}
      />
      <CompareRow
        label="Trades (24h)"
        leftValue={formatCount(left.txns.h24.buys + left.txns.h24.sells)}
        rightValue={formatCount(right.txns.h24.buys + right.txns.h24.sells)}
        winner={compareValues(
          left.txns.h24.buys + left.txns.h24.sells,
          right.txns.h24.buys + right.txns.h24.sells,
        )}
      />
      <CompareRow
        label="Makers (24h)"
        hint="Distinct trading addresses. A high trade count from a handful of wallets is not the same as a busy market."
        leftValue={left.makers24h < 0 ? NONE : formatCount(left.makers24h)}
        rightValue={right.makers24h < 0 ? NONE : formatCount(right.makers24h)}
        winner={compareValues(
          left.makers24h < 0 ? null : left.makers24h,
          right.makers24h < 0 ? null : right.makers24h,
        )}
      />
    </CompareSection>
  );
}

/* -------------------------------------------------------------------------- */

/** How long ago the newest review landed, or null if there are none. */
function newest(reviews: Review[]): string | null {
  if (reviews.length === 0) return null;
  return formatAge(Math.max(...reviews.map((review) => review.createdAt)));
}

export function CommunityCompare({
  leftReviews,
  rightReviews,
}: {
  leftReviews: Review[];
  rightReviews: Review[];
}) {
  const a = communityStrength(leftReviews);
  const b = communityStrength(rightReviews);

  return (
    <CompareSection
      title="Community strength"
      note="Built from readers' ratings. The score is held near neutral until enough people have rated a token, so one glowing review cannot outrank a well-reviewed project."
    >
      <CompareRow
        label="Score"
        hint="A prior-weighted mean on 0–100, not a raw average. Few ratings pull the result toward the middle of the scale."
        leftValue={a.count === 0 ? NONE : a.score.toFixed(0)}
        rightValue={b.count === 0 ? NONE : b.score.toFixed(0)}
        winner={compareValues(a.count === 0 ? null : a.score, b.count === 0 ? null : b.score)}
      />
      <CompareRow
        label="Verdict"
        leftValue={strengthLabel(a)}
        rightValue={strengthLabel(b)}
      />
      <CompareRow
        label="Average"
        hint="The plain mean of every rating, unweighted. Shown beside the score so the adjustment is visible rather than hidden."
        leftValue={a.count === 0 ? NONE : <Stars value={a.average} size={12} />}
        rightValue={b.count === 0 ? NONE : <Stars value={b.average} size={12} />}
      />
      <CompareRow
        label="Ratings"
        leftValue={formatCount(a.count)}
        rightValue={formatCount(b.count)}
        winner={compareValues(a.count || null, b.count || null)}
      />
      <CompareRow
        label="Comments"
        leftValue={formatCount(a.commentCount)}
        rightValue={formatCount(b.commentCount)}
        winner={compareValues(a.commentCount || null, b.commentCount || null)}
      />
      <CompareRow
        label="Last rated"
        hint="When somebody last had an opinion. A strong score from a year ago is a different claim from a strong score from this week."
        leftValue={newest(leftReviews) ?? NONE}
        rightValue={newest(rightReviews) ?? NONE}
      />
    </CompareSection>
  );
}
