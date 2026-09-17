import { describe, expect, it } from 'vitest';
import {
  EMPTY_STRENGTH,
  NEUTRAL_RATING,
  PRIOR_WEIGHT,
  communityStrength,
  strengthLabel,
  tokenKey,
  type Review,
} from './communityScore';

let counter = 0;
function review(rating: number, comment: string | null = null): Review {
  counter += 1;
  return {
    id: `r${counter}`,
    chain: 'bsc',
    address: '0xabc',
    userId: `u${counter}`,
    rating,
    comment,
    author: 'someone',
    createdAt: counter,
    updatedAt: counter,
  };
}

describe('communityStrength', () => {
  it('reports nothing rather than zero for an unrated token', () => {
    // Zero would read as "the community rated this terribly", which is the
    // opposite of "nobody has said anything".
    expect(communityStrength([])).toEqual(EMPTY_STRENGTH);
  });

  it('counts the plain average separately from the weighted one', () => {
    const strength = communityStrength([review(5), review(3)]);
    expect(strength.average).toBe(4);
    expect(strength.weighted).toBeLessThan(strength.average);
  });

  it('stops one glowing review outranking a well-reviewed project', () => {
    const lone = communityStrength([review(5)]);
    const many = communityStrength(Array.from({ length: 40 }, () => review(4)));

    // The raw averages say the opposite — this is the whole reason the score
    // is not a raw average.
    expect(lone.average).toBeGreaterThan(many.average);
    expect(lone.score).toBeLessThan(many.score);
  });

  it('lets a genuinely well-rated token reach the top of the scale', () => {
    const strength = communityStrength(Array.from({ length: 200 }, () => review(5)));
    expect(strength.score).toBeGreaterThan(97);
  });

  it('pulls toward neutral by exactly the prior weight', () => {
    const strength = communityStrength([review(5)]);
    const expected = (PRIOR_WEIGHT * NEUTRAL_RATING + 5) / (PRIOR_WEIGHT + 1);
    expect(strength.weighted).toBeCloseTo(expected, 10);
  });

  it('puts the floor of the scale at zero, not twenty', () => {
    const strength = communityStrength(Array.from({ length: 500 }, () => review(1)));
    expect(strength.score).toBeLessThan(2);
    expect(strength.score).toBeGreaterThanOrEqual(0);
  });

  it('clamps a rating from outside the scale instead of skewing the mean', () => {
    // The column is constrained in Postgres, but a cached row from an older
    // build could still carry a 0, and one would drag the mean under the
    // scale's own floor.
    const strength = communityStrength([review(0), review(9)]);
    expect(strength.distribution[1]).toBe(1);
    expect(strength.distribution[5]).toBe(1);
    expect(strength.average).toBe(3);
  });

  it('counts only reviews that actually carry words', () => {
    const strength = communityStrength([
      review(5, 'solid team'),
      review(4, '   '),
      review(3, null),
    ]);
    expect(strength.count).toBe(3);
    expect(strength.commentCount).toBe(1);
  });

  it('gives one person one vote, however often they post', () => {
    // The daily limit lets somebody write about a token every day. If each
    // post carried a fresh star, showing up daily would be a way to walk the
    // score wherever you liked — so only the latest one votes.
    const strength = communityStrength([
      { ...review(5), userId: 'u', createdAt: 3 },
      { ...review(5), userId: 'u', createdAt: 2 },
      { ...review(5), userId: 'u', createdAt: 1 },
    ]);
    expect(strength.count).toBe(1);
  });

  it('votes with a person’s latest star, not their first', () => {
    const strength = communityStrength([
      { ...review(1), userId: 'u', createdAt: 2 },
      { ...review(5), userId: 'u', createdAt: 1 },
    ]);
    expect(strength.average).toBe(1);
    expect(strength.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('still counts every comment a person wrote', () => {
    // One voice in the score, several entries in the conversation. Collapsing
    // the comments too would quietly delete what somebody said yesterday.
    const strength = communityStrength([
      { ...review(4, 'still holding'), userId: 'u', createdAt: 2 },
      { ...review(2, 'bought the dip'), userId: 'u', createdAt: 1 },
    ]);
    expect(strength.count).toBe(1);
    expect(strength.commentCount).toBe(2);
  });

  it('builds a distribution that adds up to the count', () => {
    const strength = communityStrength([review(5), review(5), review(2), review(1)]);
    expect(strength.distribution).toEqual({ 1: 1, 2: 1, 3: 0, 4: 0, 5: 2 });
    const total = Object.values(strength.distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(strength.count);
  });
});

describe('strengthLabel', () => {
  it('says unrated rather than picking a verdict from no evidence', () => {
    expect(strengthLabel(communityStrength([]))).toBe('Unrated');
  });

  it('will not call a single five-star review strong', () => {
    // One review weighted against the prior lands near neutral, and the label
    // has to agree with the number rather than with the raw average.
    expect(strengthLabel(communityStrength([review(5)]))).toBe('Mixed');
  });

  it('calls a well-reviewed token strong', () => {
    expect(strengthLabel(communityStrength(Array.from({ length: 50 }, () => review(5)))))
      .toBe('Strong');
  });

  it('calls a badly reviewed token poor', () => {
    expect(strengthLabel(communityStrength(Array.from({ length: 50 }, () => review(1)))))
      .toBe('Poor');
  });
});

describe('tokenKey', () => {
  it('folds case, because an address does not carry any', () => {
    expect(tokenKey('BSC', '0xAbCd')).toBe(tokenKey('bsc', '0xabcd'));
  });

  it('keeps different chains apart', () => {
    expect(tokenKey('bsc', '0xabcd')).not.toBe(tokenKey('base', '0xabcd'));
  });
});
