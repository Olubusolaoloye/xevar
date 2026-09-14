/**
 * Deterministic pseudo-random number generation.
 *
 * The mock data source must produce the *same* market on every reload —
 * otherwise the app flickers into a different universe on each refresh and
 * becomes impossible to design against or demo. These are the standard
 * xmur3 / mulberry32 pair: a string hashed into a 32-bit seed, then a fast
 * uniform generator over it.
 */

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
  /** Pick one element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
  /**
   * Log-uniform float — the right distribution for market quantities such as
   * liquidity or market cap, where the interesting spread is across orders of
   * magnitude rather than across a linear range.
   */
  logFloat(min: number, max: number): number;
}

export function createRng(seedText: string): Rng {
  const next = mulberry32(xmur3(seedText)());
  const rng: Rng = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
    logFloat: (min, max) =>
      Math.exp(Math.log(min) + next() * (Math.log(max) - Math.log(min))),
  };
  return rng;
}
