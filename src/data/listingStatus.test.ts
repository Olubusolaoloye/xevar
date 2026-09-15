import { describe, expect, it } from 'vitest';
import {
  isEnriched,
  isTransactionHash,
  LISTING_PAYMENT_ADDRESS,
  LISTING_FEE_USD,
  listingPresentation,
  type PresentableListing,
} from './listingStatus';

/** A submission with every presentation field filled in. */
const FULL: PresentableListing = {
  status: 'approved',
  logoUrl: 'https://example.com/logo.png',
  coverUrl: 'https://example.com/cover.png',
  blurb: 'A token.',
  website: 'https://example.com',
  twitter: 'https://twitter.com/example',
  telegram: 'https://t.me/example',
  label: 'Example Token',
};

describe('listingPresentation', () => {
  it('shows everything once approved', () => {
    const shown = listingPresentation(FULL);
    expect(shown.blurb).toBe('A token.');
    expect(shown.coverUrl).toBe('https://example.com/cover.png');
    expect(shown.website).toBe('https://example.com');
  });

  for (const status of ['tracking', 'pending', 'rejected'] as const) {
    it(`withholds everything while ${status}`, () => {
      const shown = listingPresentation({ ...FULL, status });
      expect(Object.values(shown).every((field) => field === null)).toBe(true);
    });
  }

  it('treats a missing status as tracking, not as approved', () => {
    // The important default. A row written before this workflow existed — or
    // by a client that simply omits the field — must not be able to publish a
    // banner and outbound links by leaving it out.
    const { status: _omitted, ...noStatus } = FULL;
    const shown = listingPresentation(noStatus);
    expect(Object.values(shown).every((field) => field === null)).toBe(true);
  });

  it('withholds everything for an unknown listing', () => {
    expect(Object.values(listingPresentation(undefined)).every((f) => f === null)).toBe(true);
  });

  it('normalises blank overrides to null so they do not blank the provider', () => {
    const shown = listingPresentation({
      status: 'approved',
      blurb: '   ',
      website: '',
      label: 'Real Name',
    });
    expect(shown.blurb).toBeNull();
    expect(shown.website).toBeNull();
    expect(shown.label).toBe('Real Name');
  });
});

describe('isEnriched', () => {
  it('is true only for an approved listing carrying something', () => {
    expect(isEnriched(FULL)).toBe(true);
    expect(isEnriched({ ...FULL, status: 'pending' })).toBe(false);
    expect(isEnriched({ status: 'approved' })).toBe(false);
  });
});

describe('isTransactionHash', () => {
  it('accepts a 32-byte hex hash', () => {
    expect(isTransactionHash(`0x${'a'.repeat(64)}`)).toBe(true);
    expect(isTransactionHash(`  0x${'F0'.repeat(32)}  `)).toBe(true);
  });

  it('rejects anything that is not one', () => {
    expect(isTransactionHash('')).toBe(false);
    expect(isTransactionHash('0x123')).toBe(false);
    expect(isTransactionHash('a'.repeat(64))).toBe(false); // no 0x
    expect(isTransactionHash(`0x${'g'.repeat(64)}`)).toBe(false); // not hex
    expect(isTransactionHash(`0x${'a'.repeat(65)}`)).toBe(false); // too long
  });
});

describe('payment constants', () => {
  it('pins the fee and the destination address', () => {
    // Pinned in a test on purpose: a payment address that drifts sends
    // someone's money somewhere nobody controls.
    expect(LISTING_FEE_USD).toBe(50);
    expect(LISTING_PAYMENT_ADDRESS).toBe(
      '0x82E191513adea82F3B217e10CBFACdaBB29b2376',
    );
  });
});
