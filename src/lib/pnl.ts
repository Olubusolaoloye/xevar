/**
 * Profit and loss maths.
 *
 * Kept as pure functions with no React and no formatting, so the same
 * calculations back the what-if calculator, the saved position cards and the
 * portfolio totals — three surfaces that must never disagree with each other
 * about what a number means.
 */

export interface PositionInput {
  /** Amount of the base token held. */
  amount: number;
  /** Price paid per token, in USD. */
  entryPriceUsd: number;
  /** Current market price per token, in USD. */
  currentPriceUsd: number;
}

export interface PositionResult {
  /** What the position cost. */
  costUsd: number;
  /** What it is worth now. */
  valueUsd: number;
  /** Absolute gain or loss. */
  pnlUsd: number;
  /** Gain or loss as a percentage of cost. */
  pnlPct: number;
  /** Value as a multiple of cost — 2 means a double. */
  multiple: number;
  /** Price at which the position breaks even (its entry). */
  breakEvenUsd: number;
}

export function evaluatePosition({
  amount,
  entryPriceUsd,
  currentPriceUsd,
}: PositionInput): PositionResult {
  const costUsd = amount * entryPriceUsd;
  const valueUsd = amount * currentPriceUsd;
  const pnlUsd = valueUsd - costUsd;

  return {
    costUsd,
    valueUsd,
    pnlUsd,
    // Guard the division: a zero-cost position (an airdrop) has infinite
    // return, which is not a number anyone wants rendered.
    pnlPct: costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0,
    multiple: costUsd > 0 ? valueUsd / costUsd : 0,
    breakEvenUsd: entryPriceUsd,
  };
}

/** Aggregate several entries in the same token into one blended position. */
export function blendPositions(
  entries: Array<{ amount: number; entryPriceUsd: number }>,
  currentPriceUsd: number,
): PositionResult & { amount: number; averageEntryUsd: number } {
  const amount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const costUsd = entries.reduce((sum, entry) => sum + entry.amount * entry.entryPriceUsd, 0);
  // Cost-weighted, not a mean of the entry prices — a 10-token buy and a
  // 1000-token buy do not contribute equally to the average.
  const averageEntryUsd = amount > 0 ? costUsd / amount : 0;

  return {
    ...evaluatePosition({ amount, entryPriceUsd: averageEntryUsd, currentPriceUsd }),
    amount,
    averageEntryUsd,
  };
}

/* -------------------------------------------------------------------------- */
/* What-if projection                                                         */
/* -------------------------------------------------------------------------- */

export interface ProjectionInput {
  /** USD the user is putting in (or already put in). */
  investmentUsd: number;
  /** Price per token at entry. */
  entryPriceUsd: number;
  /** Current market price. */
  currentPriceUsd: number;
  /** Current market cap, used to express targets in market-cap terms. */
  currentMarketCapUsd: number;
}

export interface ProjectionRow {
  /** Label such as "2x" or "$100M mcap". */
  label: string;
  /** Token price at this target. */
  priceUsd: number;
  /** Market cap at this target. */
  marketCapUsd: number;
  /** Position value at this target. */
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
}

/**
 * Project the position's value at a set of market-cap targets.
 *
 * Traders reason in market caps rather than prices — "can this do $100M?" is a
 * question about the whole token, where "can this reach $0.0000031?" is
 * meaningless without knowing the supply. Price and market cap move together
 * for a fixed supply, so scaling one scales the other.
 */
export function projectTargets(
  input: ProjectionInput,
  multiples: number[] = [2, 5, 10, 50, 100],
): ProjectionRow[] {
  const { investmentUsd, entryPriceUsd, currentPriceUsd, currentMarketCapUsd } = input;
  if (entryPriceUsd <= 0 || investmentUsd <= 0) return [];

  const tokens = investmentUsd / entryPriceUsd;

  return multiples.map((multiple) => {
    // Multiples are measured from the price *now*, which is what someone
    // buying today is actually asking about.
    const priceUsd = currentPriceUsd * multiple;
    const valueUsd = tokens * priceUsd;
    const pnlUsd = valueUsd - investmentUsd;

    return {
      label: `${multiple}x`,
      priceUsd,
      marketCapUsd: currentMarketCapUsd * multiple,
      valueUsd,
      pnlUsd,
      pnlPct: (pnlUsd / investmentUsd) * 100,
    };
  });
}

/**
 * Value of an investment at an explicit market-cap target.
 *
 * The inverse question: "what is my bag worth if this hits $250M?"
 */
export function projectAtMarketCap(
  input: ProjectionInput,
  targetMarketCapUsd: number,
): ProjectionRow | null {
  const { investmentUsd, entryPriceUsd, currentPriceUsd, currentMarketCapUsd } = input;
  if (entryPriceUsd <= 0 || investmentUsd <= 0 || currentMarketCapUsd <= 0) return null;

  const tokens = investmentUsd / entryPriceUsd;
  const priceUsd = currentPriceUsd * (targetMarketCapUsd / currentMarketCapUsd);
  const valueUsd = tokens * priceUsd;
  const pnlUsd = valueUsd - investmentUsd;

  return {
    label: 'Target',
    priceUsd,
    marketCapUsd: targetMarketCapUsd,
    valueUsd,
    pnlUsd,
    pnlPct: (pnlUsd / investmentUsd) * 100,
  };
}

/**
 * What an investment made at launch would be worth now.
 *
 * The "if you'd aped in" number, computed from the pair's own all-time low or
 * earliest known price rather than guessed.
 */
export function projectFromEntry(
  investmentUsd: number,
  entryPriceUsd: number,
  currentPriceUsd: number,
): PositionResult | null {
  if (entryPriceUsd <= 0 || investmentUsd <= 0) return null;
  return evaluatePosition({
    amount: investmentUsd / entryPriceUsd,
    entryPriceUsd,
    currentPriceUsd,
  });
}
