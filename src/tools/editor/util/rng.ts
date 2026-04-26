export function makeRng(seed: number) {
  let x = seed | 0;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // Normalize to [0,1)
    return ((x >>> 0) & 0xffffffff) / 0x100000000;
  };
}

export function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

