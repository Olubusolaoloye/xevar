/**
 * Display formatting for market data.
 *
 * Crypto prices span roughly fourteen orders of magnitude — from $0.000000001
 * meme tokens to six-figure BTC — so a single `toFixed` is never correct. Every
 * helper here picks its precision from the magnitude of the value itself.
 */

/* -------------------------------------------------------------------------- */
/* Price                                                                      */
/* -------------------------------------------------------------------------- */

export interface PriceParts {
  /** Everything up to and including the decimal point, e.g. `"$0."` */
  lead: string;
  /**
   * Count of leading zeros after the decimal point, rendered as a subscript.
   * `0` means no subscript is needed.
   */
  zeros: number;
  /** The significant digits, e.g. `"4821"` */
  digits: string;
  /**
   * The same number written out in full, e.g. `"$0.00000004821"`.
   *
   * Carried here rather than rebuilt by the caller. `lead` is subscript
   * notation — its trailing `0` in `"$0.0"` is the placeholder the subscript
   * count replaces, not a digit — so expanding a price by concatenating
   * `lead + zeros + digits` yields one zero too many and a figure ten times
   * too small. That is exactly what used to happen, in every title attribute,
   * every screen-reader label and on the downloadable share card.
   */
  text: string;
}

/**
 * Split a price into renderable parts.
 *
 * Sub-penny tokens are the norm on DEXes, and `$0.00000004821` is unreadable at
 * a glance. The convention screeners settled on is a subscript run-length:
 * `$0.0₇4821`. Returning parts rather than a string lets the caller render that
 * subscript as real markup instead of a lookalike character.
 */
export function priceParts(value: number, symbol = '$'): PriceParts {
  if (!Number.isFinite(value) || value === 0) {
    return { lead: `${symbol}0.00`, zeros: 0, digits: '', text: `${symbol}0.00` };
  }

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  // Large and normal values: fixed decimal places by magnitude.
  if (abs >= 1) {
    const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
    const fixed = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    });
    const flat = `${sign}${symbol}${fixed}`;
    return { lead: flat, zeros: 0, digits: '', text: flat };
  }

  // Sub-dollar: count the zeros between the point and the first real digit.
  const exponent = Math.floor(Math.log10(abs));
  const leadingZeros = Math.abs(exponent) - 1;
  const significant = abs
    .toFixed(Math.min(20, Math.abs(exponent) + 4))
    .slice(2)
    .replace(/^0+/, '')
    .slice(0, 4);

  // Only worth compressing once there are enough zeros to hurt readability.
  if (leadingZeros >= 4) {
    return {
      lead: `${sign}${symbol}0.0`,
      zeros: leadingZeros,
      digits: significant,
      // Note the difference from `lead`: the placeholder zero is not repeated.
      text: `${sign}${symbol}0.${'0'.repeat(leadingZeros)}${significant}`,
    };
  }

  const expanded = `${sign}${symbol}0.${'0'.repeat(leadingZeros)}${significant}`;
  return { lead: expanded, zeros: 0, digits: '', text: expanded };
}

/** Flat-string price, for places that cannot render a subscript (titles, alt). */
export function formatPrice(value: number, symbol = '$'): string {
  return priceParts(value, symbol).text;
}

/* -------------------------------------------------------------------------- */
/* Magnitude                                                                  */
/* -------------------------------------------------------------------------- */

const UNITS = [
  { threshold: 1e12, suffix: 'T' },
  { threshold: 1e9, suffix: 'B' },
  { threshold: 1e6, suffix: 'M' },
  { threshold: 1e3, suffix: 'K' },
] as const;

/** `1234567` → `"1.23M"`. Used for volume, liquidity, market cap, FDV. */
export function formatCompact(value: number, symbol = ''): string {
  if (!Number.isFinite(value)) return `${symbol}—`;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  for (const { threshold, suffix } of UNITS) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${sign}${symbol}${scaled.toFixed(decimals)}${suffix}`;
    }
  }
  return `${sign}${symbol}${abs.toFixed(abs >= 1 ? 0 : 2)}`;
}

/** Plain integer with thousands separators, e.g. transaction counts. */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

/** Token quantity — precision scales down as the balance grows. */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e6) return formatCompact(value);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/**
 * Price formatted for a chart axis.
 *
 * Axis ticks have no room for a subscript run and no markup to render one, so
 * `formatCompact` would flatten every sub-penny tick to `$0.00` — giving a
 * token priced at 3.2e-9 an axis of six identical labels. Below a cent this
 * falls back to exponential notation, which is compact, unambiguous, and
 * actually distinguishes one tick from the next.
 */
export function formatAxisPrice(value: number, symbol = '$'): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return `${symbol}0`;
  if (abs >= 1) return formatCompact(value, symbol);

  const sign = value < 0 ? '-' : '';
  if (abs >= 0.01) return `${sign}${symbol}${abs.toFixed(4)}`;
  // `3.2e-9` — two significant digits is all an axis tick needs.
  return `${sign}${symbol}${abs.toExponential(2).replace('e', 'e')}`;
}

/* -------------------------------------------------------------------------- */
/* Percentage                                                                 */
/* -------------------------------------------------------------------------- */

/** `12.3` → `"+12.3%"`. Always signed — direction is the point. */
export function formatPercent(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const places = decimals ?? (abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${value.toFixed(places)}%`;
}

/** Direction of a change, for choosing a color token. */
export function direction(value: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return 'flat';
  return value > 0 ? 'up' : 'down';
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

/** Compact elapsed time since a timestamp: `"3s"`, `"14m"`, `"6h"`, `"2mo"`. */
export function formatAge(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** Wall-clock time for the trade tape. */
export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* -------------------------------------------------------------------------- */
/* Addresses                                                                  */
/* -------------------------------------------------------------------------- */

/** `0x71C7656EC7...976F` → `"0x71C7…976F"`. */
export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
