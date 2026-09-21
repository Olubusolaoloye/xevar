import { describe, expect, it } from 'vitest';
import { tradingViewSymbol } from './TradingViewChart';
import type { Pair } from '@/data/types';

function pair(over: Partial<Pair> = {}): Pair {
  return {
    baseToken: { address: '0xb', name: 'Wiki Cat', symbol: 'WKC' },
    quoteToken: { address: '0xq', name: 'Wrapped BNB', symbol: 'WBNB' },
    pairAddress: '0x804678fa97d91B974ec2af3c843270886528a9E6',
    ...over,
  } as Pair;
}

describe('tradingViewSymbol', () => {
  it('builds base+quote plus the first six hex of the pool, in USD', () => {
    // TradingView's own naming: WKC/WBNB at 0x933477eb… is WKCWBNB_933477.USD
    expect(
      tradingViewSymbol(pair({ pairAddress: '0x933477eba23726cA95A957cB85dBB1957267EF85' })),
    ).toBe('WKCWBNB_933477.USD');
  });

  it('keeps the .USD suffix, so the chart is not priced in the quote asset', () => {
    // Without it the same pool charts in WBNB while every other figure on the
    // page is in dollars — two different numbers for one price.
    expect(tradingViewSymbol(pair())).toMatch(/\.USD$/);
  });

  it('upper-cases the address fragment, which arrives mixed-case', () => {
    expect(
      tradingViewSymbol(pair({ pairAddress: '0xf6dcdce0ac3001B2f67F750bc64ea5beB37B5824' })),
    ).toBe('WKCWBNB_F6DCDC.USD');
  });

  it('refuses a malformed address rather than guessing a symbol', () => {
    // A guessed symbol resolves to somebody else's market, which is worse
    // than drawing no chart at all.
    expect(tradingViewSymbol(pair({ pairAddress: 'not-an-address' }))).toBeNull();
    expect(tradingViewSymbol(pair({ pairAddress: '0x1234' }))).toBeNull();
    expect(tradingViewSymbol(pair({ pairAddress: '' }))).toBeNull();
  });

  it('strips punctuation a ticker should not carry into a symbol', () => {
    expect(
      tradingViewSymbol(
        pair({ baseToken: { address: '0xb', name: 'Dog', symbol: '$DTG-v2' } }),
      ),
    ).toBe('DTGV2WBNB_804678.USD');
  });

  it('refuses when a ticker is punctuation only', () => {
    expect(
      tradingViewSymbol(pair({ baseToken: { address: '0xb', name: '?', symbol: '???' } })),
    ).toBeNull();
  });
});
