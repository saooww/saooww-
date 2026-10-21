let counter = 0;

export function uid(prefix = ""): string {
  counter = (counter + 1) % 1679616;
  return prefix + Date.now().toString(36) + counter.toString(36).padStart(4, "0") + Math.random().toString(36).slice(2, 6);
}

/** Deterministic PRNG for demo data */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
