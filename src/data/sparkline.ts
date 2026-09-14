/**
 * Sparkline series construction.
 *
 * Pure and separate from the feed so the rules below can be tested directly.
 * Every one of them exists because of a specific way the row charts broke.
 */

/** Most points a series may hold, anchor included. */
export const SPARKLINE_MAX_POINTS = 48;

/**
 * The price 24 hours ago, implied by the current price and the 24h change.
 *
 * Returns null whenever the arithmetic cannot be trusted rather than a number
 * that looks usable. A token reported at -100% makes the divisor zero and the
 * result Infinity, which propagates into NaN path coordinates; the browser
 * then discards the whole path and the chart silently disappears.
 */
export function impliedOpeningPrice(
  priceUsd: number,
  change24hPct: number,
): number | null {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  const factor = 1 + change24hPct / 100;
  // Guard the divisor, not just exact zero: a factor within a rounding error
  // of zero yields an anchor orders of magnitude away from the real price,
  // which squashes every other point flat against the viewBox edge.
  if (!Number.isFinite(factor) || Math.abs(factor) < 0.01) return null;

  const opening = priceUsd / factor;
  return Number.isFinite(opening) && opening > 0 ? opening : null;
}

export interface SparklineResult {
  /** Prices genuinely observed this session, to carry into the next poll. */
  observed: number[];
  /** What the row renders: the 24h anchor, then the observed prices. */
  sparkline: number[];
}

/**
 * Extend a pair's observed price history by one poll.
 *
 * Two rules matter, and both are regressions:
 *
 * 1. The 24h anchor stays for the life of the series. It used to be dropped
 *    once three polls had been observed, on the theory that real samples beat
 *    an interpolation. They do not at this timescale — a token moves a few
 *    hundredths of a percent between 15-second polls, so an observed-only
 *    series had roughly 1/200th the vertical range and drew as a flat line
 *    within a minute of opening the board.
 *
 * 2. A new array every call. The previous version pushed into the stored
 *    array, so every Pair carried the same reference, the memo inside
 *    <Sparkline> never saw its input change, and the line froze at whatever it
 *    first rendered — flat, permanently.
 */
export function extendSparkline(
  previousObserved: readonly number[],
  priceUsd: number,
  change24hPct: number,
): SparklineResult {
  const usable = Number.isFinite(priceUsd) && priceUsd > 0;
  const appended = usable ? [...previousObserved, priceUsd] : [...previousObserved];

  // Cap the rolling window so a long session cannot grow this without bound.
  // One slot is reserved for the anchor.
  const limit = SPARKLINE_MAX_POINTS - 1;
  const observed = appended.length > limit ? appended.slice(-limit) : appended;

  const opening = impliedOpeningPrice(priceUsd, change24hPct);
  return {
    observed,
    sparkline: opening === null ? observed : [opening, ...observed],
  };
}
