import { create } from 'zustand';
import { hasBackend, supabase, TABLES, type ReviewRow } from '@/lib/supabase';
import { tokenKey, type Review } from '@/data/communityScore';

/**
 * Community reviews.
 *
 * Reviews live only in Postgres — there is no local fallback and deliberately
 * so. A rating is a claim about what other people think, and a browser-local
 * one would show the reader their own opinion reflected back as consensus.
 * Without a backend the community panel says it is unavailable instead.
 */

interface ReviewState {
  /** Reviews by `chain:address`, newest first. */
  byToken: Record<string, Review[]>;
  /** Tokens currently being fetched, so a panel can say so. */
  loading: Record<string, boolean>;
  error: string | null;
}

export const useReviewStore = create<ReviewState>(() => ({
  byToken: {},
  loading: {},
  error: null,
}));

function fromRow(row: ReviewRow): Review {
  return {
    id: row.id,
    chain: row.chain,
    address: row.address,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    // The view derives this from the reviewer's own email and never exposes
    // the address. A null means the account is gone.
    author: row.author ?? 'someone',
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

/**
 * One shared empty array for every token with no reviews.
 *
 * Not a literal `?? []` in the selector. Zustand v5 reads through
 * `useSyncExternalStore`, which compares the selector's result by reference on
 * every store notification — a fresh `[]` each call is never equal to the last
 * one, so React re-renders, the selector runs again, and the component spins.
 * A frozen module-level constant is the same reference every time.
 */
const NO_REVIEWS: readonly Review[] = Object.freeze([]);

/** Everything known about one token, newest first. */
export function selectReviews(chain: string, address: string) {
  return (state: ReviewState): Review[] =>
    state.byToken[tokenKey(chain, address)] ?? (NO_REVIEWS as Review[]);
}

export function selectLoading(chain: string, address: string) {
  return (state: ReviewState): boolean =>
    Boolean(state.loading[tokenKey(chain, address)]);
}

/* -------------------------------------------------------------------------- */
/* Backend                                                                    */
/* -------------------------------------------------------------------------- */

let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
/** Tokens with a live subscription, so a re-render does not refetch. */
const watching = new Set<string>();

async function fetchToken(chain: string, address: string) {
  if (!supabase) return;
  const key = tokenKey(chain, address);

  useReviewStore.setState((state) => ({
    loading: { ...state.loading, [key]: true },
  }));

  const { data, error } = await supabase
    .from(TABLES.reviewsPublic)
    .select('*')
    .eq('chain', chain.toLowerCase())
    .eq('address', address.toLowerCase())
    .order('created_at', { ascending: false })
    // A comparison panel shows a handful; this is the ceiling on what the
    // score is computed from, not on what anyone may post.
    .limit(200);

  useReviewStore.setState((state) => ({
    // A failed fetch leaves whatever was already there rather than blanking
    // the panel — a momentary network blip should not read as "no reviews".
    byToken: error
      ? state.byToken
      : { ...state.byToken, [key]: ((data ?? []) as ReviewRow[]).map(fromRow) },
    loading: { ...state.loading, [key]: false },
    error: error ? 'Could not load community reviews.' : null,
  }));
}

/**
 * What to tell someone whose review would not save.
 *
 * The daily limit is raised by a trigger, so it arrives as a Postgres error
 * rather than as a status the client can read off a field. Its message is
 * written for the reader and passed through as-is; anything else is reduced to
 * something true but unalarming, because a raw Postgres string in a review box
 * tells the user nothing they can act on.
 */
export const DAILY_LIMIT_MARKER = 'already posted about this token today';

function submitError(message: string): string {
  if (message.toLowerCase().includes(DAILY_LIMIT_MARKER)) {
    return 'You have already posted about this token today. Come back tomorrow, or edit what you wrote.';
  }
  if (message.includes('row-level security')) return 'Sign in to post a review.';
  return 'Could not save your review. Try again.';
}

export const reviewBackend = {
  enabled: hasBackend,

  /**
   * Load reviews for a set of tokens and keep them current.
   *
   * Idempotent per token: calling it again for something already watched
   * refetches nothing, so mounting two comparison panes on the same token
   * costs one request.
   */
  watch(tokens: Array<{ chain: string; address: string }>) {
    if (!supabase) return;

    const fresh = tokens.filter((token) => {
      const key = tokenKey(token.chain, token.address);
      if (watching.has(key)) return false;
      watching.add(key);
      return true;
    });

    for (const token of fresh) void fetchToken(token.chain, token.address);

    if (channel) return;
    // One subscription for the whole table. Filtering it per token would mean
    // a channel per token, and the payload is small enough that refetching the
    // affected token on any change is cheaper than ten subscriptions.
    channel = supabase
      .channel('reviews-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.reviews },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<ReviewRow> | undefined;
          if (!row?.chain || !row?.address) return;
          if (!watching.has(tokenKey(row.chain, row.address))) return;
          void fetchToken(row.chain, row.address);
        },
      )
      .subscribe();
  },

  /**
   * Post the caller's review of one token, or edit the one they wrote today.
   *
   * Two different writes behind one call. With `editId` it updates that row —
   * the post is still theirs and still today's, so revising it is just typing.
   * Without one it inserts, and the database's daily trigger decides whether
   * that is allowed.
   *
   * The limit is not checked here first. A browser check would be a courtesy
   * to honest users and nothing at all to anyone else: the anon key is in the
   * bundle, so the REST endpoint is open to whoever wants it. Postgres is the
   * only place the rule can actually hold, and this reads back what it said.
   */
  async submit(input: {
    chain: string;
    address: string;
    userId: string;
    rating: number;
    comment: string;
    editId?: string | null;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: 'No backend is configured.' };

    const rating = Math.round(input.rating);
    if (rating < 1 || rating > 5) return { ok: false, error: 'Pick one to five stars.' };

    const words = { rating, comment: input.comment.trim() || null };

    // An edit sends only what an edit can change. The chain, the address and
    // the author are what the row *is*, not what it says, and a trigger would
    // put them back anyway — sending them would just be asking the database a
    // question it has already answered.
    const { error } = input.editId
      ? await supabase.from(TABLES.reviews).update(words).eq('id', input.editId)
      : await supabase.from(TABLES.reviews).insert({
          ...words,
          chain: input.chain.toLowerCase(),
          address: input.address.toLowerCase(),
          user_id: input.userId,
        });

    if (error) {
      return { ok: false, error: submitError(error.message) };
    }

    await fetchToken(input.chain, input.address);
    return { ok: true };
  },

  /** Withdraw a review. The database allows this for its author, or an admin. */
  async remove(review: Review): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: 'No backend is configured.' };

    const { error } = await supabase.from(TABLES.reviews).delete().eq('id', review.id);
    if (error) return { ok: false, error: 'Could not remove that review.' };

    await fetchToken(review.chain, review.address);
    return { ok: true };
  },
};

/** Drop every subscription. Used when the app tears the feed down. */
export function stopReviewSync() {
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  watching.clear();
}
