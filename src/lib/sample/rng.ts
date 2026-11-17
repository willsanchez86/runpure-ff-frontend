/** Deterministic RNG, ported from the Phase 1 prototype's data.js (foundation
 * spec P6): mulberry32 streams seeded per (scope) so any season or player
 * generates identically regardless of fetch order. Pure, no Date/Math.random. */

/** One deterministic random stream. */
export class Rng {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1;
  }
  /** Uniform [0,1). */
  next(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }
  /** Standard normal via Box–Muller. */
  randn(): number {
    let uniformA = 0;
    let uniformB = 0;
    while (!uniformA) uniformA = this.next();
    while (!uniformB) uniformB = this.next();
    return (
      Math.sqrt(-2 * Math.log(uniformA)) * Math.cos(2 * Math.PI * uniformB)
    );
  }
  /** Normal with the given mean and standard deviation. */
  normal(mean: number, stdDev: number): number {
    return mean + stdDev * this.randn();
  }
  /** Poisson draw with the given rate. */
  pois(rate: number): number {
    rate = Math.max(0, rate);
    const threshold = Math.exp(-rate);
    let count = 0;
    let product = 1;
    do {
      count++;
      product *= this.next();
    } while (product > threshold);
    return count - 1;
  }
  /** Binomial draw: successes in `trials` attempts at `probability`. */
  binom(trials: number, probability: number): number {
    let successes = 0;
    for (let trial = 0; trial < trials; trial++) {
      if (this.next() < probability) successes++;
    }
    return successes;
  }
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  /** In-place Fisher–Yates shuffle; returns the array. */
  shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index--) {
      const swapWith = Math.floor(this.next() * (index + 1));
      const held = items[index];
      items[index] = items[swapWith];
      items[swapWith] = held;
    }
    return items;
  }
}

/** Clamp a value into [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** FNV-style 2-int hash for per-(player, season) stream seeds. */
export function hash2(first: number, second: number): number {
  let hash = (2166136261 ^ (first >>> 0)) >>> 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  hash = (hash ^ (second >>> 0)) >>> 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  return hash >>> 0;
}
