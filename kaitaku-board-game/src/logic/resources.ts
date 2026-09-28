import { counts } from './constants.ts'
import { RESOURCES, type Resource, type ResourceCounts } from './types.ts'

export { counts }

export function total(c: ResourceCounts): number {
  return RESOURCES.reduce((sum, r) => sum + c[r], 0)
}

export function hasAtLeast(have: ResourceCounts, need: ResourceCounts): boolean {
  return RESOURCES.every((r) => have[r] >= need[r])
}

/** have に amount を足す（その場で変更） */
export function addInto(have: ResourceCounts, amount: ResourceCounts): void {
  for (const r of RESOURCES) have[r] += amount[r]
}

/** have から amount を引く（その場で変更） */
export function subtractInto(have: ResourceCounts, amount: ResourceCounts): void {
  for (const r of RESOURCES) have[r] -= amount[r]
}

/** 相手から自分へ資源を移す（その場で変更） */
export function transfer(from: ResourceCounts, to: ResourceCounts, amount: ResourceCounts): void {
  subtractInto(from, amount)
  addInto(to, amount)
}

/** すべて 0 以上の整数か（外部から来た値の検証用） */
export function isValidCounts(c: unknown): c is ResourceCounts {
  if (typeof c !== 'object' || c === null) return false
  const rec = c as Record<string, unknown>
  return RESOURCES.every((r) => Number.isInteger(rec[r]) && (rec[r] as number) >= 0)
}

export function isResource(r: unknown): r is Resource {
  return typeof r === 'string' && (RESOURCES as readonly string[]).includes(r)
}

/** 手札を1枚ずつ並べた配列（ランダムに1枚選ぶとき用） */
export function toCardList(c: ResourceCounts): Resource[] {
  return RESOURCES.flatMap((r) => Array<Resource>(c[r]).fill(r))
}
