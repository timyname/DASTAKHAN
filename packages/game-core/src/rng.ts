/**
 * Seeded deterministic RNG (mulberry32). The whole generator state is one uint32,
 * stored in GameState.rngState between stable steps. No Math.random anywhere.
 */
export class Rng {
  private s: number;

  constructor(state: number) {
    this.s = state >>> 0;
  }

  /** Current uint32 state (persist this in GameState.rngState). */
  get state(): number {
    return this.s;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Uniform pick: items[Math.floor(next() * items.length)]. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[Math.floor(this.next() * items.length)];
  }
}

/** Normalizes a numeric seed to the initial uint32 RNG state. */
export function seedToState(seed: number): number {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error(`Invalid seed: ${String(seed)}`);
  }
  return seed >>> 0;
}
