import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge } from '@/lib/format';
import { hasBackend } from '@/lib/supabase';
import {
  communityStrength,
  strengthLabel,
  type Review,
} from '@/data/communityScore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  reviewBackend,
  selectLoading,
  selectReviews,
  useReviewStore,
} from '@/store/useReviewStore';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Stars, StarInput } from './StarRating';
import type { Pair } from '@/data/types';

const MAX_COMMENT = 1000;

/** How a token's own reviews break down, as a bar per star. */
function Distribution({ reviews }: { reviews: Review[] }) {
  const strength = communityStrength(reviews);
  if (strength.count === 0) return null;

  return (
    <div className="space-y-1">
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const n = strength.distribution[star];
        const pct = (n / strength.count) * 100;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="tnum w-3 shrink-0 text-right text-[10px] text-ink-dim">
              {star}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-brand-500/70"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="tnum w-5 shrink-0 text-right text-[10px] text-ink-dim">
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewList({
  reviews,
  currentUserId,
  isAdmin,
  onRemove,
}: {
  reviews: Review[];
  currentUserId: string | null;
  isAdmin: boolean;
  onRemove: (review: Review) => void;
}) {
  // Only reviews that carry words. A bare star is already counted in the
  // score; printing "someone rated this 4" as a comment is filler.
  const withWords = reviews.filter((r) => r.comment && r.comment.trim());

  if (withWords.length === 0) {
    return (
      <p className="px-4 py-4 text-[11px] text-ink-dim">
        No written reviews yet. Ratings without a comment still count toward the
        score.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {withWords.map((review) => (
        <li key={review.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Stars value={review.rating} size={12} />
              <span className="truncate text-[11px] font-medium text-ink-mid">
                {review.author}
              </span>
              <span className="shrink-0 text-[11px] text-ink-dim">
                {formatAge(review.createdAt)}
                {review.updatedAt > review.createdAt + 1000 && ' · edited'}
              </span>
            </span>

            {(review.userId === currentUserId || isAdmin) && (
              <button
                type="button"
                onClick={() => onRemove(review)}
                aria-label="Remove this review"
                className="shrink-0 rounded-sm p-1 text-ink-dim transition-colors hover:bg-sunken hover:text-down"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-mid">
            {review.comment}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ReviewForm({ pair, existing }: { pair: Pair; existing: Review | null }) {
  const userId = useAuthStore((s) => s.userId);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // A review posted from another device arrives over realtime. Adopt it, so
  // the form edits what is actually stored rather than a stale draft.
  useEffect(() => {
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? '');
  }, [existing?.id, existing?.rating, existing?.comment]);

  const submit = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);

    const result = await reviewBackend.submit({
      chain: pair.chain,
      address: pair.baseToken.address,
      userId,
      rating,
      comment,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save your review.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-2.5 border-t border-line px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-ink-mid">
          {existing ? 'Your review' : `Rate ${pair.baseToken.symbol}`}
        </p>
        <StarInput value={rating} onChange={setRating} disabled={busy} />
      </div>

      <div>
        <label htmlFor={`review-${pair.id}`} className="sr-only">
          Your comment on {pair.baseToken.symbol}
        </label>
        <textarea
          id={`review-${pair.id}`}
          value={comment}
          maxLength={MAX_COMMENT}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          placeholder="What do you make of this project? (optional)"
          className="w-full resize-y rounded-md border border-line bg-sunken px-2.5 py-2 text-xs text-ink placeholder:text-ink-dim focus:border-brand-500/50 focus:outline-none"
        />
        <p className="mt-0.5 text-right text-[10px] text-ink-dim">
          {comment.length}/{MAX_COMMENT}
        </p>
      </div>

      {error && (
        <p className="rounded-sm border border-down/25 bg-down/10 px-2.5 py-1.5 text-[11px] text-down">
          {error}
        </p>
      )}

      <Button
        size="sm"
        variant={saved ? 'primary' : 'secondary'}
        className="w-full"
        disabled={busy || rating < 1}
        onClick={() => void submit()}
      >
        {saved ? 'Saved' : busy ? 'Saving…' : existing ? 'Update review' : 'Post review'}
      </Button>

      <p className="text-[10px] leading-relaxed text-ink-dim">
        One review per token. Posting again edits this one, so nobody can weight
        the score by rating twice. Your handle is the part of your email before
        the @ — the address itself is never shown.
      </p>
    </div>
  );
}

/**
 * Community strength for one token: the score, the spread, and what people
 * wrote.
 *
 * The score is a prior-weighted mean rather than a raw average — see
 * data/communityScore.ts for why, and for what the prior costs a token with
 * one glowing review.
 */
export function CommunityPanel({ pair }: { pair: Pair }) {
  const email = useAuthStore((s) => s.email);
  const userId = useAuthStore((s) => s.userId);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const reviews = useReviewStore(selectReviews(pair.chain, pair.baseToken.address));
  const loading = useReviewStore(selectLoading(pair.chain, pair.baseToken.address));

  useEffect(() => {
    reviewBackend.watch([{ chain: pair.chain, address: pair.baseToken.address }]);
  }, [pair.chain, pair.baseToken.address]);

  const strength = useMemo(() => communityStrength(reviews), [reviews]);
  const mine = useMemo(
    () => reviews.find((review) => review.userId === userId) ?? null,
    [reviews, userId],
  );

  if (!hasBackend) {
    return (
      <p className="px-4 py-6 text-xs leading-relaxed text-ink-low">
        Community ratings need the backend. Without it this panel would only be
        able to show you your own opinion, which is not a community.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 px-4 py-3.5">
        <div>
          <p
            className={cn(
              'font-display text-3xl font-bold leading-none',
              strength.count === 0 ? 'text-ink-dim' : 'text-ink',
            )}
          >
            {strength.count === 0 ? '—' : strength.score.toFixed(0)}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-dim">
            /100
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink">
            {strengthLabel(strength)}
            {loading && <Loader2 className="h-3 w-3 animate-spin text-ink-dim" />}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Stars value={strength.average} size={13} />
            <span className="tnum text-[11px] text-ink-low">
              {strength.count === 0
                ? 'no ratings'
                : `${strength.average.toFixed(1)} · ${strength.count} rating${strength.count === 1 ? '' : 's'}`}
            </span>
          </div>
          {strength.count > 0 && strength.count < 5 && (
            /* Said plainly rather than hidden behind the formula: the score is
               shrunk toward neutral at this sample size, and a reader comparing
               two tokens deserves to know the number is deliberately cautious
               rather than think the crowd was lukewarm. */
            <p className="mt-1 text-[10px] leading-relaxed text-ink-dim">
              Held near neutral until more people rate it.
            </p>
          )}
        </div>
      </div>

      {strength.count > 0 && (
        <div className="border-t border-line px-4 py-3">
          <Distribution reviews={reviews} />
        </div>
      )}

      <div className="border-t border-line">
        <p className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium text-ink-low">
          <MessageSquare className="h-3 w-3" />
          {strength.commentCount} comment{strength.commentCount === 1 ? '' : 's'}
        </p>
        <ReviewList
          reviews={reviews}
          currentUserId={userId}
          isAdmin={isAdmin}
          onRemove={(review) => void reviewBackend.remove(review)}
        />
      </div>

      {email && userId ? (
        <ReviewForm pair={pair} existing={mine} />
      ) : (
        <div className="border-t border-line p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-low">
            <Users className="h-3 w-3" />
            Sign in to rate {pair.baseToken.symbol} and leave a comment.
          </p>
          <AuthForm
            idPrefix={`rev-${pair.id}`}
            signUpLabel="Create account"
            className="overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}
