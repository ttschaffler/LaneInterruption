/**
 * Tiny deterministic PRNG (mulberry32) so the synthetic dataset is stable
 * across reloads — important for a demo where the drill-down numbers should
 * not change every refresh.
 */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    /** Float in [min, max]. */
    float: (min: number, max: number) => next() * (max - min) + min,
    /** Pick a random element. */
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    /** True with probability p. */
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof makeRng>;
