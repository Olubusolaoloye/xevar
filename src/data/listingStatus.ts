/**
 * Where a listing sits in the paid-listing workflow, and what that permits it
 * to show.
 *
 * The rule this file exists to enforce: market data is free, presentation is
 * not. Anyone can have a token tracked by handing over a contract address —
 * price, liquidity, volume and flow are facts about a public pool and nobody
 * needs to pay to have facts reported. But a logo, a banner, a description and
 * outbound social links are *claims by whoever submitted them*, and those
 * appear only once a payment has been confirmed and an admin has reviewed the
 * submission.
 */

export type ListingStatus =
  /** Contract address only. Market data is tracked; nothing else is shown. */
  | 'tracking'
  /** Details and a payment hash submitted, waiting for an admin. */
  | 'pending'
  /** An admin confirmed the payment. Presentation fields go live. */
  | 'approved'
  /** An admin declined. Falls back to tracking-only, with a reason. */
  | 'rejected';

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  tracking: 'Tracking only',
  pending: 'Awaiting review',
  approved: 'Listed',
  rejected: 'Declined',
};

/** The listing fee, in whole US dollars. */
export const LISTING_FEE_USD = 50;

/**
 * Where the fee is paid.
 *
 * Deliberately a single exported constant: an address that appears in more
 * than one place is an address that can drift in one of them, and a payment
 * address that drifts sends someone's money somewhere nobody controls.
 */
export const LISTING_PAYMENT_ADDRESS =
  '0x82E191513adea82F3B217e10CBFACdaBB29b2376';

/**
 * The subset of a listing that only a paid, approved submission may show.
 *
 * `null` for every field until then — the caller falls back to whatever the
 * market provider reports, which for an unapproved listing is the only thing
 * on screen.
 */
export interface ListingPresentation {
  logoUrl: string | null;
  coverUrl: string | null;
  blurb: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  /** Display name override. */
  label: string | null;
}

const NOTHING: ListingPresentation = {
  logoUrl: null,
  coverUrl: null,
  blurb: null,
  website: null,
  twitter: null,
  telegram: null,
  label: null,
};

export interface PresentableListing {
  status?: ListingStatus;
  logoUrl?: string;
  coverUrl?: string;
  blurb?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  label?: string;
}

/**
 * Decide what a listing is allowed to present.
 *
 * Note the default: a listing with no status at all is treated as `tracking`,
 * not as approved. A row written before this workflow existed, or by a client
 * that does not know about it, must not be able to publish a banner and a set
 * of outbound links by omitting a field.
 */
export function listingPresentation(
  listing: PresentableListing | undefined,
): ListingPresentation {
  if (!listing) return NOTHING;
  if ((listing.status ?? 'tracking') !== 'approved') return NOTHING;

  // Empty strings are normalised to null so a blank override never blanks out
  // what the provider supplied.
  const value = (input: string | undefined) => {
    const trimmed = input?.trim();
    return trimmed ? trimmed : null;
  };

  return {
    logoUrl: value(listing.logoUrl),
    coverUrl: value(listing.coverUrl),
    blurb: value(listing.blurb),
    website: value(listing.website),
    twitter: value(listing.twitter),
    telegram: value(listing.telegram),
    label: value(listing.label),
  };
}

/** Whether a listing is showing anything beyond raw market data. */
export function isEnriched(listing: PresentableListing | undefined): boolean {
  const presentation = listingPresentation(listing);
  return Object.values(presentation).some((field) => field !== null);
}

/** A 0x-prefixed 32-byte transaction hash. */
export function isTransactionHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}
