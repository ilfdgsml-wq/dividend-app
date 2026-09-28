// サイコロと資源産出

import { DISCARD_THRESHOLD, TERRAIN_RESOURCE } from '../constants.ts'
import { TOPOLOGY } from '../board/topology.ts'
import { randomInt } from '../rng.ts'
import { addInto, counts, subtractInto, total } from '../resources.ts'
import { RESOURCES, type GameState, type PlayerId, type Resource, type ResourceCounts, type Rng } from '../types.ts'
import { notYourTurn, wrongPhase } from './common.ts'

export interface Production {
  /** PlayerId ごとの受取量（資源不足ルール適用後） */
  gains: ResourceCounts[]
  /** 銀行の在庫が足りず、配布が減った／無くなった資源 */
  shortage: Resource[]
}

/**
 * 出目 roll で各プレイヤーが受け取る資源を計算する（状態は変更しない）。
 * 資源不足ルール：ある資源の受取合計が銀行の残りより多い場合、その資源は誰も受け取らない。
 * ただし受け取るのが1人だけなら、銀行に残っている分だけ渡す。
 */
export function computeProduction(state: GameState, roll: number): Production {
  const gains = state.players.map(() => counts())
  for (const hex of TOPOLOGY.hexes) {
    const tile = state.tiles[hex.id]
    if (tile.number !== roll || hex.id === state.robber) continue
    const r = TERRAIN_RESOURCE[tile.terrain]
    if (!r) continue
    for (const v of hex.vertices) {
      const b = state.buildings[v]
      if (b) gains[b.owner][r] += b.kind === 'city' ? 2 : 1
    }
  }

  const shortage: Resource[] = []
  for (const r of RESOURCES) {
    const demand = gains.reduce((sum, g) => sum + g[r], 0)
    if (demand <= state.bank[r]) continue
    shortage.push(r)
    const recipients = gains.filter((g) => g[r] > 0)
    if (recipients.length === 1) recipients[0][r] = state.bank[r]
    else gains.forEach((g) => (g[r] = 0))
  }
  return { gains, shortage }
}

/** 7 のとき、PlayerId ごとに捨てる枚数（8枚以上なら半分・切り捨て） */
export function discardAmounts(state: GameState): number[] {
  return state.players.map((p) => {
    const n = total(p.resources)
    return n >= DISCARD_THRESHOLD ? Math.floor(n / 2) : 0
  })
}

export function rollDice(state: GameState, player: PlayerId, rng: Rng): string | null {
  const err = notYourTurn(state, player) ?? wrongPhase(state, 'preRoll')
  if (err) return err

  const dice: [number, number] = [randomInt(rng, 6) + 1, randomInt(rng, 6) + 1]
  const roll = dice[0] + dice[1]
  state.lastRoll = dice
  state.log.push({ kind: 'roll', player, dice })

  if (roll === 7) {
    const pending = discardAmounts(state)
    state.phase = pending.some((n) => n > 0) ? { type: 'discard', pending } : { type: 'moveRobber', resume: 'main' }
    return null
  }

  const { gains, shortage } = computeProduction(state, roll)
  gains.forEach((g, p) => {
    addInto(state.players[p].resources, g)
    subtractInto(state.bank, g)
  })
  state.log.push({ kind: 'produce', gains, shortage })
  state.phase = { type: 'main' }
  return null
}
