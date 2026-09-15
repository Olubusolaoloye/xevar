import { describe, expect, it } from 'vitest';
import { compareValues } from './CompareRow';

describe('compareValues', () => {
  it('marks the higher side when higher is better', () => {
    expect(compareValues(10, 5)).toBe('left');
    expect(compareValues(5, 10)).toBe('right');
  });

  it('marks the lower side when lower is better', () => {
    // FDV/cap and pool age are both read this way.
    expect(compareValues(1.2, 4.0, false)).toBe('left');
  });

  it('abstains when either side has no figure', () => {
    // A metric the provider does not report is not a zero. Treating it as one
    // would hand the comparison to whichever token is better documented.
    expect(compareValues(null, 5)).toBe('none');
    expect(compareValues(5, undefined)).toBe('none');
    expect(compareValues(Number.NaN, 5)).toBe('none');
    expect(compareValues(5, Number.POSITIVE_INFINITY)).toBe('none');
  });

  it('reports a tie rather than picking a side', () => {
    expect(compareValues(7, 7)).toBe('tie');
  });

  it('treats a real zero as a value, not as missing', () => {
    // 0% change is a fact; -3% is worse than it.
    expect(compareValues(0, -3)).toBe('left');
  });
});
