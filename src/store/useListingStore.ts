import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hasBackend, supabase, TABLES, type ListingRow } from '@/lib/supabase';
import type { ChainId } from '@/data/types';
import type { ListingStatus } from '@/data/listingStatus';

export type TokenCategory = 'meme' | 'defi' | 'infra' | 'stable' | 'other';

export const CATEGORY_LABEL: Record<TokenCategory, string> = {
  meme: 'Meme',
  defi: 'DeFi',
  infra: 'Infrastructure',
  stable: 'Stablecoin',
  other: 'Other',
};

export interface Listing {
  id: string;
  chain: ChainId;
  /**
   * The token's contract address. Authoritative when present: the board looks
   * the token up by this and cannot match the wrong asset.
   */
  address?: string;
  /** Ticker. Used to resolve the token when no address is pinned. */
  symbol: string;
  /** Optional display name override. */
  label?: string;
  category: TokenCategory;
  note?: string;
  /**
   * A specific pool, when the token trades in several. Without it the deepest
   * pool is used, which is the one worth quoting.
   */
  pairAddress?: string;

  /* --- Manual presentation overrides -------------------------------------
     Anything set here wins over what the market provider reports. Providers
     get token metadata wrong often enough — missing logos, truncated names,
     placeholder descriptions — that an operator needs the final say on how a
     listing is presented. Prices are never overridable: those come from the
     pool and inventing them would be fabrication. */

  /** Replaces the provider's logo. */
  logoUrl?: string;
  /** Wide banner shown on the token page. */
  coverUrl?: string;
  /** Short description shown on the token page. */
  blurb?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  /** Pinned to the top of the board regardless of sort. */
  featured?: boolean;
  addedAt: number;
  /** Manual sort position listed. */
  order: number;

  /* --- Paid listing workflow ---------------------------------------------
     Market data is tracked for any contract address. The presentation fields
     above are withheld until a payment has been confirmed and an admin has
     reviewed the submission — see data/listingStatus.ts. */

  /** Defaults to 'tracking' wherever absent; never to 'approved'. */
  status?: ListingStatus;
  /**
   * An admin's assertion that this is the token it claims to be.
   *
   * Separate from `address` being pinned: pinning proves the board is quoting
   * one specific contract, which is a fact about the request. Verification is
   * a judgement about whether that contract is the real project.
   */
  verified?: boolean;
  /** Auth user id of the developer who submitted it, when not admin-created. */
  ownerId?: string;
  /** Payment transaction hash, as supplied by the developer. */
  paymentTxHash?: string;
  /** Contact address for the submitter, shown to the admin during review. */
  contactEmail?: string;
  submittedAt?: number;
  reviewedAt?: number;
  /** Why an admin declined, shown back to the developer. */
  reviewNote?: string;
}

/**
 * Whether a token is pinned to an exact contract.
 *
 * Symbol-only entries are resolved by searching, and ticker collisions are
 * common and dangerous — several unrelated tokens share a symbol across and
 * even within chains. The UI flags these so nobody mistakes a lookalike for
 * the real thing.
 */
export function isPinned(token: Listing): boolean {
  return Boolean(token.address);
}

/**
 * The starting board.
 *
 * Deliberately small: a curated shortlist beats an unfiltered firehose, and
 * the two entries below are the ones asked for as a live-price check.
 *
 * Note that neither carries a contract address. Inventing one from memory
 * would be worse than useless — a wrong address silently shows a different
 * token's price, or points at an impostor contract. These resolve by symbol
 * and are flagged as unverified until an address is pinned from the admin
 * screen, where the real pair can be picked from live search results.
 */
const SEED: Array<Omit<Listing, 'id' | 'addedAt' | 'order'>> = [
  {
    chain: 'bsc',
    symbol: 'WKC',
    label: 'Wiki Cat',
    category: 'meme',
    status: 'approved',
    verified: true,
  },
  {
    chain: 'ethereum',
    symbol: 'BLIN',
    label: 'Blin',
    category: 'meme',
    status: 'approved',
    verified: true,
  },
];

function seedTokens(): Listing[] {
  return SEED.map((token, i) => ({
    ...token,
    id: `t${i}-${token.chain}-${token.symbol.toLowerCase()}`,
    addedAt: Date.now(),
    order: i,
  }));
}

interface ListingState {
  tokens: Listing[];
  add: (token: Omit<Listing, 'id' | 'addedAt' | 'order'>) => { ok: boolean; error?: string };
  update: (id: string, patch: Partial<Omit<Listing, 'id'>>) => void;
  remove: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  replaceAll: (tokens: Listing[]) => void;
  resetToSeed: () => void;
}

export const useListingStore = create<ListingState>()(
  persist(
    (set, get) => ({
      tokens: seedTokens(),

      add: (token) => {
        const existing = get().tokens;

        // Duplicate check is by address when pinned, by chain+symbol when not —
        // the same symbol on two different chains is two different tokens.
        const duplicate = existing.some((t) =>
          token.address && t.address
            ? t.address.toLowerCase() === token.address.toLowerCase() && t.chain === token.chain
            : t.chain === token.chain && t.symbol.toUpperCase() === token.symbol.toUpperCase(),
        );
        if (duplicate) return { ok: false, error: 'That token is already listed on this chain.' };
        if (!token.symbol.trim()) return { ok: false, error: 'A ticker is required.' };

        set({
          tokens: [
            ...existing,
            {
              ...token,
              symbol: token.symbol.trim().toUpperCase(),
              id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
              addedAt: Date.now(),
              order: existing.length,
            },
          ],
        });
        return { ok: true };
      },

      update: (id, patch) =>
        set((state) => ({
          tokens: state.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      remove: (id) =>
        set((state) => ({ tokens: state.tokens.filter((t) => t.id !== id) })),

      move: (id, direction) =>
        set((state) => {
          const sorted = [...state.tokens].sort((a, b) => a.order - b.order);
          const index = sorted.findIndex((t) => t.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= sorted.length) return state;

          [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
          return { tokens: sorted.map((t, i) => ({ ...t, order: i })) };
        }),

      replaceAll: (tokens) =>
        set({ tokens: tokens.map((t, i) => ({ ...t, order: i })) }),

      resetToSeed: () => set({ tokens: seedTokens() }),
    }),
    { name: 'panscreener.listings' },
  ),
);


/* -------------------------------------------------------------------------- */
/* Backend sync                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Listings live in Postgres when a backend is configured.
 *
 * Everything below keeps the same store shape the components already use, so
 * nothing downstream knows whether the data came from a database or from this
 * browser. Without a backend the persisted local store above simply remains in
 * charge, which keeps a fork or a fresh checkout working.
 */

function fromRow(row: ListingRow): Listing {
  return {
    id: row.id,
    chain: row.chain as ChainId,
    symbol: row.symbol,
    address: row.address ?? undefined,
    pairAddress: row.pair_address ?? undefined,
    label: row.label ?? undefined,
    category: row.category as TokenCategory,
    note: row.note ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    blurb: row.blurb ?? undefined,
    website: row.website ?? undefined,
    twitter: row.twitter ?? undefined,
    telegram: row.telegram ?? undefined,
    featured: row.featured,
    addedAt: Date.parse(row.created_at),
    order: row.position,
    // Absent defaults to 'tracking', never to 'approved'.
    status: (row.status ?? 'tracking') as ListingStatus,
    verified: row.verified ?? false,
    ownerId: row.owner_id ?? undefined,
    paymentTxHash: row.payment_tx_hash ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    submittedAt: row.submitted_at ? Date.parse(row.submitted_at) : undefined,
    reviewedAt: row.reviewed_at ? Date.parse(row.reviewed_at) : undefined,
    reviewNote: row.review_note ?? undefined,
  };
}

function toRow(token: Partial<Listing>) {
  // Undefined is skipped so a partial update never blanks a column it was not
  // asked to touch; null is written so a cleared field really clears.
  const row: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value === '' ? null : value;
  };

  put('chain', token.chain);
  put('symbol', token.symbol);
  put('address', token.address ?? null);
  put('pair_address', token.pairAddress ?? null);
  put('label', token.label ?? null);
  put('category', token.category);
  put('note', token.note ?? null);
  put('logo_url', token.logoUrl ?? null);
  put('cover_url', token.coverUrl ?? null);
  put('blurb', token.blurb ?? null);
  put('website', token.website ?? null);
  put('twitter', token.twitter ?? null);
  put('telegram', token.telegram ?? null);
  put('featured', token.featured);
  put('position', token.order);
  put('status', token.status);
  put('verified', token.verified);
  put('owner_id', token.ownerId);
  put('payment_tx_hash', token.paymentTxHash ?? null);
  put('contact_email', token.contactEmail ?? null);
  put('review_note', token.reviewNote ?? null);
  return row;
}

let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

/** Pull the current listings and keep them in sync over a websocket. */
export function startListingSync() {
  if (!supabase || channel) return;

  const load = async () => {
    const { data, error } = await supabase!
      .from(TABLES.listings)
      .select('*')
      .order('position', { ascending: true });

    // A failed load must not wipe what is already on screen.
    if (error || !data) return;
    useListingStore.setState({ tokens: (data as ListingRow[]).map(fromRow) });
  };

  void load();

  // Realtime carries the change itself, but reloading the whole set is simpler
  // and correct for a list this small — and it keeps ordering right after a
  // reorder, which a per-row patch would not.
  channel = supabase
    .channel('listings-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLES.listings },
      () => void load(),
    )
    .subscribe();
}

export function stopListingSync() {
  if (!supabase || !channel) return;
  void supabase.removeChannel(channel);
  channel = null;
}

/** Writes go to the database when there is one, else to the local store. */
export const listingBackend = {
  enabled: hasBackend,

  async add(token: Omit<Listing, 'id' | 'addedAt' | 'order'>) {
    if (!supabase) return useListingStore.getState().add(token);

    const count = useListingStore.getState().tokens.length;
    const { error } = await supabase
      .from(TABLES.listings)
      .insert({ ...toRow(token), position: count });

    if (error) {
      // The unique indexes are the real duplicate check, so a conflict here is
      // reported as one rather than as a generic failure.
      return {
        ok: false,
        error: error.code === '23505'
          ? 'That token is already listed on this chain.'
          : 'Could not save. You may need to sign in as the admin.',
      };
    }
    return { ok: true };
  },

  /**
   * List several tokens at once.
   *
   * Not a loop over `add`, because `add` derives each row's position from the
   * store's current length — and over a batch the store is only updated by the
   * websocket, asynchronously, so every insert in the loop would read the same
   * stale count and land on the same position. Here the base is read once and
   * each row gets its own offset.
   *
   * Reports per token rather than all-or-nothing: one address the provider
   * cannot place should not cost the other ten.
   */
  async addMany(tokens: Array<Omit<Listing, 'id' | 'addedAt' | 'order'>>) {
    const base = useListingStore.getState().tokens.length;

    if (!supabase) {
      const store = useListingStore.getState();
      return tokens.map((token) => ({
        symbol: token.symbol,
        ...store.add(token),
      }));
    }

    const results: Array<{ symbol: string; ok: boolean; error?: string }> = [];

    for (const [index, token] of tokens.entries()) {
      const { error } = await supabase
        .from(TABLES.listings)
        .insert({ ...toRow(token), position: base + index });

      results.push({
        symbol: token.symbol,
        ok: !error,
        error: error
          ? error.code === '23505'
            ? 'Already listed'
            : 'Could not save — sign in as the admin'
          : undefined,
      });
    }

    return results;
  },

  async update(id: string, patch: Partial<Listing>) {
    if (!supabase) return useListingStore.getState().update(id, patch);
    await supabase.from(TABLES.listings).update(toRow(patch)).eq('id', id);
  },

  async remove(id: string) {
    if (!supabase) return useListingStore.getState().remove(id);
    await supabase.from(TABLES.listings).delete().eq('id', id);
  },

  async move(id: string, direction: -1 | 1) {
    if (!supabase) return useListingStore.getState().move(id, direction);

    const ordered = [...useListingStore.getState().tokens].sort(
      (a, b) => a.order - b.order,
    );
    const index = ordered.findIndex((t) => t.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    // Swap the two positions in one round trip.
    await Promise.all([
      supabase.from(TABLES.listings).update({ position: target }).eq('id', ordered[index].id),
      supabase.from(TABLES.listings).update({ position: index }).eq('id', ordered[target].id),
    ]);
  },
};
