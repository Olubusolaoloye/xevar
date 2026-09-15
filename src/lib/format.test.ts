import { describe, expect, it } from 'vitest';
import {
  formatAge,
  formatAxisPrice,
  formatCompact,
  formatPercent,
  formatPrice,
  priceParts,
} from './format';

describe('priceParts', () => {
  it('formats ordinary prices without a subscript', () => {
    expect(priceParts(3180).lead).toBe('$3,180.00');
    expect(priceParts(1.2345).zeros).toBe(0);
  });

  it('compresses deep sub-penny prices into a subscript run', () => {
    // $0.00000003257 is unreadable; $0.0₇3257 is comparable at a glance.
    const parts = priceParts(0.00000003257);
    expect(parts.lead).toBe('$0.0');
    expect(parts.zeros).toBe(7);
    expect(parts.digits).toBe('3257');
  });

  it('leaves shallow sub-dollar prices expanded', () => {
    // Only worth compressing once the zeros actually hurt readability.
    expect(priceParts(0.0123).zeros).toBe(0);
    expect(priceParts(0.0123).lead).toContain('0.0123');
  });

  it('handles zero and non-finite input without producing NaN', () => {
    expect(priceParts(0).lead).toBe('$0.00');
    expect(priceParts(Number.NaN).lead).toBe('$0.00');
  });

  it('respects a non-dollar symbol', () => {
    expect(priceParts(1500, '€').lead).toBe('€1,500.00');
  });
});

describe('formatAxisPrice', () => {
  it('keeps sub-penny axis ticks distinguishable', () => {
    // formatCompact would render every one of these as "$0.00".
    expect(formatAxisPrice(3.26e-8)).toBe('$3.26e-8');
    expect(formatAxisPrice(2.61e-8)).not.toBe(formatAxisPrice(3.26e-8));
  });

  it('uses compact notation above a dollar', () => {
    expect(formatAxisPrice(1500)).toBe('$1.50K');
  });
});

describe('formatCompact', () => {
  it('abbreviates by magnitude', () => {
    expect(formatCompact(1_234, '$')).toBe('$1.23K');
    expect(formatCompact(1_234_567, '$')).toBe('$1.23M');
    expect(formatCompact(1_234_567_890, '$')).toBe('$1.23B');
  });

  it('drops decimals once three digits are already shown', () => {
    expect(formatCompact(123_456_789, '$')).toBe('$123M');
  });

  it('preserves the sign', () => {
    expect(formatCompact(-2_500, '$')).toBe('-$2.50K');
  });
});

describe('formatPercent', () => {
  it('always signs a gain so colour is never the only cue', () => {
    expect(formatPercent(12.34)).toBe('+12.3%');
    expect(formatPercent(-3.2)).toBe('-3.20%');
  });

  it('sheds precision as the magnitude grows', () => {
    expect(formatPercent(1234)).toBe('+1234%');
  });
});

describe('formatAge', () => {
  const now = Date.parse('2026-01-10T00:00:00Z');

  it('steps through units as the gap widens', () => {
    expect(formatAge(now - 30_000, now)).toBe('30s');
    expect(formatAge(now - 5 * 60_000, now)).toBe('5m');
    expect(formatAge(now - 3 * 3_600_000, now)).toBe('3h');
    expect(formatAge(now - 5 * 86_400_000, now)).toBe('5d');
    expect(formatAge(now - 60 * 86_400_000, now)).toBe('2mo');
    expect(formatAge(now - 400 * 86_400_000, now)).toBe('1y');
  });

  it('never reports a negative age for a future timestamp', () => {
    expect(formatAge(now + 60_000, now)).toBe('0s');
  });
});

describe('formatPrice', () => {
  /** Read a formatted price back as a number. */
  const parse = (text: string) => Number(text.replace(/[$€£₦,]/g, ''));

  it('round-trips the value it was given', () => {
    // The regression, and the assertion that would have caught it. `lead` is
    // subscript notation: the trailing 0 in "$0.0" is the placeholder the
    // subscript count replaces, not a digit. Expanding by concatenating
    // lead + zeros + digits produced one zero too many, so every sub-penny
    // price read ten times too small — in titles, in screen-reader labels,
    // and on the downloadable share card.
    for (const value of [
      0.00004212, 0.00000003257, 0.000001, 0.0000005, 1.2e-9, 0.0123, 0.00123, 1.2345,
    ]) {
      const parsed = parse(formatPrice(value));
      // Four significant digits are kept, so compare proportionally.
      expect(Math.abs(parsed / value - 1)).toBeLessThan(0.01);
    }
  });

  it('expands a subscript price with exactly the advertised zero count', () => {
    const parts = priceParts(0.00000003257);
    expect(parts.zeros).toBe(7);
    // Seven zeros between the point and the digits — not eight.
    expect(parts.text).toBe('$0.00000003257');
    expect(formatPrice(0.00000003257)).toBe(parts.text);
  });

  it('agrees with the subscript parts it is built from', () => {
    for (const value of [0.00004212, 0.0123, 3180, 0]) {
      expect(formatPrice(value)).toBe(priceParts(value).text);
    }
  });

  it('carries the currency symbol through', () => {
    expect(formatPrice(0.00004212, '€')).toBe('€0.00004212');
    expect(formatPrice(1500, '₦')).toBe('₦1,500.00');
  });

  it('keeps a negative sign ahead of the symbol', () => {
    expect(formatPrice(-0.00004212)).toBe('-$0.00004212');
  });

  it('handles zero and non-finite input', () => {
    expect(formatPrice(0)).toBe('$0.00');
    expect(formatPrice(Number.NaN)).toBe('$0.00');
  });
});
