import { useCallback } from 'react';
import { CURRENCY_RATES, CURRENCY_SYMBOL, usePrefsStore } from '@/store/usePrefsStore';
import { formatCompact, formatPrice, priceParts, type PriceParts } from '@/lib/format';

/**
 * Currency-aware formatters.
 *
 * All market data is stored in USD; conversion is a presentation concern and
 * happens only at the edge, here. Components never hold converted numbers,
 * which means switching currency can never corrupt the underlying values.
 */
export function useCurrency() {
  const currency = usePrefsStore((s) => s.currency);
  const rate = CURRENCY_RATES[currency];
  const symbol = CURRENCY_SYMBOL[currency];

  const convert = useCallback((usd: number) => usd * rate, [rate]);

  return {
    currency,
    symbol,
    rate,
    convert,
    /** Full-precision price, split for subscript rendering. */
    price: useCallback(
      (usd: number): PriceParts => priceParts(usd * rate, symbol),
      [rate, symbol],
    ),
    /** Flat price string, for titles and accessible labels. */
    priceText: useCallback((usd: number) => formatPrice(usd * rate, symbol), [rate, symbol]),
    /** Abbreviated magnitude, e.g. liquidity and volume. */
    compact: useCallback((usd: number) => formatCompact(usd * rate, symbol), [rate, symbol]),
  };
}
