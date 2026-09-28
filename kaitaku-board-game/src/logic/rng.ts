import type { Rng } from './types.ts'

/** シード付きの決定的な乱数（テスト・再現用）。mulberry32 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 指定した値を順に返す乱数（テスト用）。尽きたら先頭に戻る */
export function sequenceRng(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** 0 以上 n 未満の整数 */
export function randomInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n))
}

/** Fisher–Yates。新しい配列を返す */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
