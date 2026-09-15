import { create } from 'zustand';
import { hasBackend, supabase, TABLES, type ListingRow } from '@/lib/supabase';
import { isTransactionHash, type ListingStatus } from '@/data/listingStatus';
import type { ChainId } from '@/data/types';
import type { TokenCategory } from '@/store/useListingStore';

/**
 * A developer's own submissions.
 *
 * Kept apart from useListingStore, which holds the public board. The two read
 * the same table but answer different questions: the board asks "what is
 * listed", this asks "what have I submitted and where has it got to".
 *
 * Nothing here is an authorisation boundary. Every rule that matters — you may
 * only touch your own rows, you may not approve or verify yourself, you may
 * not edit a listing after it has been reviewed — lives in row-level security,
 * because this file ships inside a bundle the submitter can edit.
 */

export interface DeveloperSubmission {
  id: string;
  chain: ChainId;
  symbol: string;
  address?: string;
  label?: string;
  category: TokenCategory;
  logoUrl?: string;
  coverUrl?: string;
  blurb?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  contactEmail?: string;
  paymentTxHash?: string;
  status: ListingStatus;
  verified: boolean;
  submittedAt?: number;
  reviewedAt?: number;
  reviewNote?: string;
  createdAt: number;
}

export interface SubmissionDraft {
  chain: ChainId;
  address: string;
  symbol: string;
  label?: string;
  category: TokenCategory;
  logoUrl?: string;
  coverUrl?: string;
  blurb?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  contactEmail?: string;
  paymentTxHash?: string;
}

type Result = { ok: boolean; error?: string };

interface DeveloperState {
  submissions: DeveloperSubmission[];
  loading: boolean;
  error: string | null;

  load: (ownerId: string) => Promise<void>;
  create: (ownerId: string, draft: SubmissionDraft) => Promise<Result>;
  update: (id: string, patch: Partial<SubmissionDraft>) => Promise<Result>;
  /** Move a draft into the review queue. */
  submitForReview: (id: string, txHash: string) => Promise<Result>;
  withdraw: (id: string) => Promise<Result>;
}

function fromRow(row: ListingRow): DeveloperSubmission {
  return {
    id: row.id,
    chain: row.chain as ChainId,
    symbol: row.symbol,
    address: row.address ?? undefined,
    label: row.label ?? undefined,
    category: row.category as TokenCategory,
    logoUrl: row.logo_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    blurb: row.blurb ?? undefined,
    website: row.website ?? undefined,
    twitter: row.twitter ?? undefined,
    telegram: row.telegram ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    paymentTxHash: row.payment_tx_hash ?? undefined,
    status: (row.status ?? 'tracking') as ListingStatus,
    verified: row.verified ?? false,
    submittedAt: row.submitted_at ? Date.parse(row.submitted_at) : undefined,
    reviewedAt: row.reviewed_at ? Date.parse(row.reviewed_at) : undefined,
    reviewNote: row.review_note ?? undefined,
    createdAt: Date.parse(row.created_at),
  };
}

function toRow(draft: Partial<SubmissionDraft>) {
  const row: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value === '' ? null : value;
  };

  put('chain', draft.chain);
  put('symbol', draft.symbol?.trim().toUpperCase());
  put('address', draft.address?.trim());
  put('label', draft.label?.trim());
  put('category', draft.category);
  put('logo_url', draft.logoUrl?.trim());
  put('cover_url', draft.coverUrl?.trim());
  put('blurb', draft.blurb?.trim());
  put('website', draft.website?.trim());
  put('twitter', draft.twitter?.trim());
  put('telegram', draft.telegram?.trim());
  put('contact_email', draft.contactEmail?.trim());
  put('payment_tx_hash', draft.paymentTxHash?.trim());
  return row;
}

const NO_BACKEND: Result = {
  ok: false,
  error: 'No backend is configured, so submissions cannot be saved.',
};

export const useDeveloperStore = create<DeveloperState>((set, get) => ({
  submissions: [],
  loading: false,
  error: null,

  load: async (ownerId) => {
    if (!supabase) {
      set({ submissions: [], loading: false });
      return;
    }
    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from(TABLES.listings)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ loading: false, error: 'Could not load your submissions.' });
      return;
    }
    set({
      submissions: (data as ListingRow[]).map(fromRow),
      loading: false,
      error: null,
    });
  },

  create: async (ownerId, draft) => {
    if (!supabase) return NO_BACKEND;

    if (!draft.address.trim()) {
      return { ok: false, error: 'A contract address is required.' };
    }
    if (!draft.symbol.trim()) {
      return { ok: false, error: 'A ticker is required.' };
    }

    const { error } = await supabase.from(TABLES.listings).insert({
      ...toRow(draft),
      owner_id: ownerId,
      // Starts as tracking: the board quotes the pool immediately, and nothing
      // the submitter wrote is shown until an admin approves it.
      status: 'tracking',
      verified: false,
      featured: false,
    });

    if (error) {
      return {
        ok: false,
        error: error.message.includes('duplicate')
          ? 'That token is already listed.'
          : 'Could not save the submission.',
      };
    }

    await get().load(ownerId);
    return { ok: true };
  },

  update: async (id, patch) => {
    if (!supabase) return NO_BACKEND;

    const { error } = await supabase
      .from(TABLES.listings)
      .update(toRow(patch))
      .eq('id', id);

    if (error) {
      return {
        ok: false,
        error:
          'Could not save. A listing cannot be edited once it has been reviewed.',
      };
    }

    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }));
    return { ok: true };
  },

  submitForReview: async (id, txHash) => {
    if (!supabase) return NO_BACKEND;

    const hash = txHash.trim();
    // Checked here for a quick, clear message; the database enforces the same
    // shape with a constraint, which is the check that actually counts.
    if (!isTransactionHash(hash)) {
      return {
        ok: false,
        error: 'That is not a transaction hash — expected 0x followed by 64 hex characters.',
      };
    }

    const { error } = await supabase
      .from(TABLES.listings)
      .update({ payment_tx_hash: hash, status: 'pending' })
      .eq('id', id);

    if (error) return { ok: false, error: 'Could not submit for review.' };

    set((state) => ({
      submissions: state.submissions.map((s) =>
        s.id === id
          ? { ...s, paymentTxHash: hash, status: 'pending', submittedAt: Date.now() }
          : s,
      ),
    }));
    return { ok: true };
  },

  withdraw: async (id) => {
    if (!supabase) return NO_BACKEND;

    const { error } = await supabase.from(TABLES.listings).delete().eq('id', id);
    if (error) {
      return { ok: false, error: 'Could not withdraw. An approved listing stays up.' };
    }

    set((state) => ({ submissions: state.submissions.filter((s) => s.id !== id) }));
    return { ok: true };
  },
}));

/** Whether the developer portal can do anything useful at all. */
export const developerPortalAvailable = hasBackend;
