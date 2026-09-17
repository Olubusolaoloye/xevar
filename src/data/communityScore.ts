/**
 * Community strength.
 *
 * Turns a token's reviews into one comparable number. The hard part is not the
 * arithmetic, it is that a raw average lies at small sample sizes: a token with
 * a single five-star review would outrank one with forty reviews averaging 4.6,
 * and on a comparison screen that reads as a verdict rather than as noise.
 *
 * So the mean is shrunk toward neutral in proportion to how little evidence
 * there is — the standard prior-weighted average. One five-star review moves
 * the score barely at all; forty of them move it nearly all the way. The count
 * is always shown beside the score, because a shrunk mean still cannot tell you
 * whether three people or three hundred were asked.
 *
 * A person may write about a token once a day, so the same account can hold
 * several reviews of it. Only their most recent one votes — otherwise anybody
 * willing to show up daily could walk a token's score wherever they liked.
 */

export interface Review {
  id: string;
  chain: string;
  address: string;
  userId: string;
  rating: number;
  comment: string | null;
  author: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommunityStrength {
  /** How many people the score is built from — one vote each. */
  count: number;
  /** The plain mean, 1–5. Zero when there are no reviews. */
  average: number;
  /** Prior-weighted mean, 1–5. Zero when there are no reviews. */
  weighted: number;
  /** `weighted` mapped onto 0–100 for display. Zero when there are no reviews. */
  score: number;
  /** How many people gave each star, indexed 1–5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  /** How many reviews carried words as well as a star — every post counts. */
  commentCount: number;
}

/**
 * Where an unrated token sits: the middle of the scale.
 *
 * Not zero. Zero would mean "the community rated this terribly", which is the
 * opposite of "nobody has said anything yet".
 */
export const NEUTRAL_RATING = 3;

/**
 * How much evidence the neutral prior is worth, in reviews.
 *
 * Five is deliberate: the first handful of reviews barely move the score, and
 * by about twenty the prior is contributing under a fifth of the result. Raise
 * it and a well-reviewed token can never catch up; lower it and one friend of
 * the founder decides the number.
 */
export const PRIOR_WEIGHT = 5;

export const EMPTY_STRENGTH: CommunityStrength = {
  count: 0,
  average: 0,
  weighted: 0,
  score: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  commentCount: 0,
};

/**
 * One review per person: whichever they wrote last.
 *
 * This is the client's half of the same rule the database keeps in
 * `ps_token_ratings_current`. Doing it here as well means the panel shows the
 * score it is about to show even before a refetch lands, and means the rule
 * survives a caller that reads the raw review table.
 */
export function latestPerUser(reviews: Review[]): Review[] {
  const newest = new Map<string, Review>();

  for (const review of reviews) {
    const held = newest.get(review.userId);
    if (!held || review.createdAt > held.createdAt) newest.set(review.userId, review);
  }

  return [...newest.values()];
}

export function communityStrength(reviews: Review[]): CommunityStrength {
  if (reviews.length === 0) return EMPTY_STRENGTH;

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  // The star comes from each person's latest post; the comment count comes
  // from all of them. Somebody who has written five times is one voice in the
  // score and five entries in the conversation, which is the distinction the
  // daily limit exists to draw.
  const votes = latestPerUser(reviews);

  let total = 0;
  let commentCount = 0;

  for (const review of votes) {
    // Clamped and rounded rather than trusted: the database constrains this
    // column, but a review can also arrive from a cache written by an older
    // build, and a stray 0 would drag the mean below the scale's own floor.
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
    total += star;
  }

  for (const review of reviews) {
    if (review.comment && review.comment.trim().length > 0) commentCount += 1;
  }

  const count = votes.length;
  const average = total / count;
  const weighted =
    (PRIOR_WEIGHT * NEUTRAL_RATING + total) / (PRIOR_WEIGHT + count);

  return {
    count,
    average,
    weighted,
    // 1–5 onto 0–100, so the floor of the scale is 0 rather than 20.
    score: ((weighted - 1) / 4) * 100,
    distribution,
    commentCount,
  };
}

/** A token's key in the review store. Case-folded, because an address is not. */
export function tokenKey(chain: string, address: string): string {
  return `${chain.toLowerCase()}:${address.toLowerCase()}`;
}

/** How the score reads in words, for a label beside the number. */
export function strengthLabel(strength: CommunityStrength): string {
  if (strength.count === 0) return 'Unrated';
  if (strength.weighted >= 4.3) return 'Strong';
  if (strength.weighted >= 3.6) return 'Positive';
  if (strength.weighted >= 2.9) return 'Mixed';
  if (strength.weighted >= 2.2) return 'Weak';
  return 'Poor';
}
