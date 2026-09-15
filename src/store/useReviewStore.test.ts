import { describe, expect, it } from 'vitest';
import { selectLoading, selectReviews, useReviewStore } from './useReviewStore';

describe('selectReviews', () => {
  it('returns the same reference for a token with no reviews', () => {
    /* Zustand v5 reads through useSyncExternalStore, which compares the
       selector's result by reference. A `?? []` written inline hands back a
       fresh array every call, React sees a changed snapshot, re-renders, and
       the component spins forever. This is that bug, pinned. */
    const state = useReviewStore.getState();
    const first = selectReviews('bsc', '0xnothing')(state);
    const second = selectReviews('bsc', '0xnothing')(state);

    expect(first).toBe(second);
    expect(first).toEqual([]);
  });

  it('folds case, so one contract is not two tokens', () => {
    useReviewStore.setState({
      byToken: {
        'bsc:0xabc': [
          {
            id: 'r1',
            chain: 'bsc',
            address: '0xabc',
            userId: 'u1',
            rating: 4,
            comment: null,
            author: 'someone',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    });

    expect(selectReviews('BSC', '0xABC')(useReviewStore.getState())).toHaveLength(1);
    useReviewStore.setState({ byToken: {} });
  });

  it('reports a token that is not loading as not loading', () => {
    expect(selectLoading('bsc', '0xnothing')(useReviewStore.getState())).toBe(false);
  });
});
