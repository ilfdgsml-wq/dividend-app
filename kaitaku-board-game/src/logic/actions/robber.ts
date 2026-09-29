// 7 の捨て札・盗賊の移動・略奪（騎士でも同じ処理を使う）

import { HEX_COUNT, TOPOLOGY } from '../board/topology.ts'
import { randomInt } from '../rng.ts'
import { counts, hasAtLeast, isValidCounts, toCardList, total, transfer } from '../resources.ts'
import type { GameState, HexId, PlayerId, ResourceCounts, ResumePhase, Rng } from '../types.ts'
import { notYourTurn, resumePhase, wrongPhase } from './common.ts'

export function discard(state: GameState, player: PlayerId, resources: ResourceCounts): string | null {
  const phase = state.phase
  if (phase.type !== 'discard') return wrongPhase(state, 'discard')
  const need = phase.pending[player] ?? 0
  if (need <= 0) return 'あなたは捨てる必要がありません'
  if (!isValidCounts(resources)) return '捨てる資源の指定が正しくありません'
  if (total(resources) !== need) return `ちょうど${need}枚選んでください`
  const hand = state.players[player].resources
  if (!hasAtLeast(hand, resources)) return '持っていない資源は捨てられません'

  transfer(hand, state.bank, resources)
  state.log.push({ kind: 'discard', player, count: need })
  const pending = phase.pending.slice()
  pending[player] = 0
  state.phase = pending.some((n) => n > 0) ? { type: 'discard', pending } : { type: 'moveRobber', resume: 'main' }
  return null
}

/** そのタイルに開拓地/都市を持つ、thief 以外のプレイヤー */
export function robberTargets(state: GameState, hex: HexId, thief: PlayerId): PlayerId[] {
  const owners = new Set<PlayerId>()
  for (const v of TOPOLOGY.hexes[hex].vertices) {
    const b = state.buildings[v]
    if (b && b.owner !== thief) owners.add(b.owner)
  }
  return [...owners].sort((a, b) => a - b)
}

export function moveRobber(state: GameState, player: PlayerId, hex: HexId, rng: Rng): string | null {
  const phase = state.phase
  if (phase.type !== 'moveRobber') return wrongPhase(state, 'moveRobber')
  const err = notYourTurn(state, player)
  if (err) return err
  if (!Number.isInteger(hex) || hex < 0 || hex >= HEX_COUNT) return 'タイルの指定が正しくありません'
  if (hex === state.robber) return '盗賊は今と別のタイルに移動してください'

  state.robber = hex
  state.log.push({ kind: 'robber', player, hex })
  const candidates = robberTargets(state, hex, player)
  if (candidates.length === 0) state.phase = resumePhase(phase.resume)
  else if (candidates.length === 1) stealFrom(state, player, candidates[0], rng, phase.resume)
  else state.phase = { type: 'steal', candidates, resume: phase.resume }
  return null
}

export function steal(state: GameState, player: PlayerId, target: PlayerId, rng: Rng): string | null {
  const phase = state.phase
  if (phase.type !== 'steal') return wrongPhase(state, 'steal')
  const err = notYourTurn(state, player)
  if (err) return err
  if (!phase.candidates.includes(target)) return 'そのプレイヤーからは奪えません'
  stealFrom(state, player, target, rng, phase.resume)
  return null
}

/** target の手札からランダムに1枚奪う（0枚なら何も得られない） */
function stealFrom(state: GameState, thief: PlayerId, target: PlayerId, rng: Rng, resume: ResumePhase): void {
  const cards = toCardList(state.players[target].resources)
  const resource = cards.length > 0 ? cards[randomInt(rng, cards.length)] : null
  if (resource) transfer(state.players[target].resources, state.players[thief].resources, counts({ [resource]: 1 }))
  state.log.push({
    kind: 'steal',
    player: thief,
    target,
    stolen: resource !== null,
    resource,
    visibleTo: [thief, target],
  })
  state.phase = resumePhase(resume)
}
