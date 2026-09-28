// 建設（道・開拓地・都市）と発展カードの購入

import { COSTS } from '../constants.ts'
import { hasAtLeast } from '../resources.ts'
import { cityError, roadError, settlementError } from '../rules/placement.ts'
import { updateLongestRoad } from '../rules/longestRoad.ts'
import type { EdgeId, GameState, PlayerId, VertexId } from '../types.ts'
import { notYourTurn, pay, wrongPhase } from './common.ts'

function canAfford(state: GameState, player: PlayerId, cost: (typeof COSTS)[keyof typeof COSTS]): string | null {
  return hasAtLeast(state.players[player].resources, cost) ? null : '資源が足りません'
}

export function buildRoad(state: GameState, player: PlayerId, edge: EdgeId): string | null {
  const err =
    notYourTurn(state, player) ??
    wrongPhase(state, 'main') ??
    canAfford(state, player, COSTS.road) ??
    roadError(state, player, edge)
  if (err) return err
  pay(state, player, COSTS.road)
  state.roads[edge] = player
  state.log.push({ kind: 'build', player, what: 'road' })
  updateLongestRoad(state)
  return null
}

export function buildSettlement(state: GameState, player: PlayerId, vertex: VertexId): string | null {
  const err =
    notYourTurn(state, player) ??
    wrongPhase(state, 'main') ??
    canAfford(state, player, COSTS.settlement) ??
    settlementError(state, player, vertex, true)
  if (err) return err
  pay(state, player, COSTS.settlement)
  state.buildings[vertex] = { owner: player, kind: 'settlement' }
  state.log.push({ kind: 'build', player, what: 'settlement' })
  // 他人の道を分断する可能性があるので全員分を再計算
  updateLongestRoad(state)
  return null
}

export function buildCity(state: GameState, player: PlayerId, vertex: VertexId): string | null {
  const err =
    notYourTurn(state, player) ??
    wrongPhase(state, 'main') ??
    canAfford(state, player, COSTS.city) ??
    cityError(state, player, vertex)
  if (err) return err
  pay(state, player, COSTS.city)
  state.buildings[vertex] = { owner: player, kind: 'city' }
  state.log.push({ kind: 'build', player, what: 'city' })
  return null
}

export function buyDevCard(state: GameState, player: PlayerId): string | null {
  const err =
    notYourTurn(state, player) ??
    wrongPhase(state, 'main') ??
    (state.devDeck.length === 0 ? '発展カードの山札がもうありません' : null) ??
    canAfford(state, player, COSTS.devCard)
  if (err) return err
  pay(state, player, COSTS.devCard)
  const type = state.devDeck.pop()!
  state.players[player].devCards.push({ type, boughtTurn: state.turn })
  state.log.push({ kind: 'buyDev', player })
  return null
}
