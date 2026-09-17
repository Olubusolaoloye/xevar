/**
 * Alert evaluation, shared verbatim by the browser and the server.
 *
 * This file has no imports, and that is deliberate rather than incidental. The
 * same bytes are deployed into the Supabase edge function that evaluates
 * alerts on a schedule (supabase/functions/alerts-dispatch/rules.ts is this
 * file, copied at deploy time), so it has to run unchanged under both Vite and
 * Deno. Anything imported from `@/` would break the server copy, and any rule
 * written on one side only would mean an alert that fires in the app but not
 * in the notification, or the reverse.
 */

export type AlertMetricName =
  | 'price'
  | 'marketCap'
  | 'change24h'
  | 'liquidity'
  | 'volume24h';

export type AlertComparatorName = 'above' | 'below';

/** The subset of a pair an alert actually reads. */
export interface AlertReadable {
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  change: { h24: number };
  volume: { h24: number };
}

/** Read the value an alert watches off a pair. */
export function readMetricValue(pair: AlertReadable, metric: AlertMetricName): number {
  switch (metric) {
    case 'price':
      return pair.priceUsd;
    case 'marketCap':
      return pair.marketCap;
    case 'change24h':
      return pair.change.h24;
    case 'liquidity':
      return pair.liquidityUsd;
    case 'volume24h':
      return pair.volume.h24;
  }
}

/**
 * Whether the provider actually reported this metric.
 *
 * Only price and market cap treat zero as absent, and the distinction is the
 * point. DexScreener sends 0 when it has neither a market cap nor an FDV, so a
 * "market cap below 5,000,000" alert would fire the instant it saw any token
 * it has no figure for. Liquidity, volume and 24h change are different: zero
 * liquidity is a drained pool and zero volume is a day with no trades, and an
 * alert watching for either is watching for exactly that.
 */
export function metricReported(metric: AlertMetricName, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (metric === 'price' || metric === 'marketCap') return value > 0;
  return true;
}

/** Whether a value satisfies a condition right now. */
export function conditionSatisfied(
  comparator: AlertComparatorName,
  threshold: number,
  value: number,
): boolean {
  return comparator === 'above' ? value > threshold : value < threshold;
}

export type AlertOutcome =
  /** Fire: the condition was not satisfied last time and is now. */
  | { action: 'fire'; value: number; conditionMet: true }
  /** Satisfied, but it already was — stay quiet. */
  | { action: 'hold'; value: number; conditionMet: true }
  /** Not satisfied. Re-arms the alert for next time. */
  | { action: 'clear'; value: number; conditionMet: false }
  /**
   * Nothing usable to compare against, so the previous state is left exactly
   * as it was. Treating unknown as "condition cleared" would re-arm the alert
   * and fire it again the moment the figure came back.
   */
  | { action: 'skip'; reason: 'disabled' | 'no-pair' | 'unreported' };

export interface EvaluableAlert {
  enabled: boolean;
  metric: AlertMetricName;
  comparator: AlertComparatorName;
  threshold: number;
  /** Whether the condition was satisfied at the previous evaluation. */
  conditionMet: boolean;
}

/**
 * Decide what one alert should do against one pair.
 *
 * Edge-triggered: an alert fires on the transition into its condition, then
 * stays quiet until the condition clears and is entered again. Without that, a
 * price sitting one cent above a threshold would fire on every single poll —
 * which on the server means a notification every minute, all night.
 *
 * A disabled alert reports `clear` state through `skip`, and callers re-arm it
 * on enable rather than here, because "was it satisfied while switched off" is
 * not a question this function can answer.
 */
export function evaluateAlert(
  alert: EvaluableAlert,
  pair: AlertReadable | null | undefined,
): AlertOutcome {
  if (!alert.enabled) return { action: 'skip', reason: 'disabled' };
  if (!pair) return { action: 'skip', reason: 'no-pair' };

  const value = readMetricValue(pair, alert.metric);
  if (!metricReported(alert.metric, value)) {
    return { action: 'skip', reason: 'unreported' };
  }

  const satisfied = conditionSatisfied(alert.comparator, alert.threshold, value);
  if (!satisfied) return { action: 'clear', value, conditionMet: false };
  return alert.conditionMet
    ? { action: 'hold', value, conditionMet: true }
    : { action: 'fire', value, conditionMet: true };
}

/** How a threshold for this metric should be written. */
export function metricFormatOf(metric: AlertMetricName): 'percent' | 'price' | 'money' {
  if (metric === 'change24h') return 'percent';
  if (metric === 'price') return 'price';
  return 'money';
}

export const ALERT_METRIC_TEXT: Record<AlertMetricName, string> = {
  price: 'Price',
  marketCap: 'Market cap',
  change24h: '24h change',
  liquidity: 'Liquidity',
  volume24h: '24h volume',
};

/**
 * A sub-cent price written the way the app writes it.
 *
 * A memecoin trades at 0.000000068, and the obvious formatters both fail it:
 * toFixed(2) rounds the whole thing to $0.00, and toPrecision gives
 * "6.800e-8", which is correct, unambiguous, and looks nothing like the
 * product. The board uses a subscript run instead — $0.0₇68, where the 7 counts
 * the zeros after the point — and a notification is the one place the number is
 * read away from the app, so it should not be the one place it is unfamiliar.
 *
 * Lives here, with the rules, because this is the file the server gets a copy
 * of; see lib/format.ts for the richer version the UI renders as real markup.
 */
export function subscriptPrice(value: number, symbol = '$'): string {
  if (!Number.isFinite(value) || value === 0) return `${symbol}0.00`;

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1) {
    const decimals = abs >= 1000 ? 2 : 4;
    return `${sign}${symbol}${abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    })}`;
  }

  const exponent = Math.floor(Math.log10(abs));
  const leadingZeros = Math.abs(exponent) - 1;
  const significant = abs
    .toFixed(Math.min(20, Math.abs(exponent) + 4))
    .slice(2)
    .replace(/^0+/, '')
    .slice(0, 4);

  // Only worth compressing once the zeros actually hurt to read.
  if (leadingZeros >= 4) {
    const subscript = String(leadingZeros).replace(/\d/g, (d) => SUBSCRIPT_DIGITS[Number(d)]);
    return `${sign}${symbol}0.0${subscript}${significant}`;
  }

  return `${sign}${symbol}0.${'0'.repeat(leadingZeros)}${significant}`;
}

const SUBSCRIPT_DIGITS = ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084',
                          '\u2085', '\u2086', '\u2087', '\u2088', '\u2089'];
