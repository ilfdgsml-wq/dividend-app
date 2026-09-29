import type { Rng } from '../src/logic/index.ts'

/** 暗号学的に安全な乱数（サイコロ・略奪・山札のシャッフル用） */
export const cryptoRng: Rng = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
