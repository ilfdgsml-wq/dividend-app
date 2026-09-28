// 初期配置（スネーク順）

import { TERRAIN_RESOURCE } from '../constants.ts'
import { TOPOLOGY } from '../board/topology.ts'
import { counts, transfer } from '../resources.ts'
import { roadError, settlementError } from '../rules/placement.ts'
import { updateLongestRoad } from '../rules/longestRoad.ts'
import type { EdgeId, GameState, PlayerId, VertexId } from '../types.ts'
import { notYourTurn } from './common.ts'

export function placeSetupSettlement(state: GameState, player: PlayerId, vertex: VertexId): string | null {
  const phase = state.phase
  if (phase.type !== 'setup' || phase.step !== 'settlement') return '今は開拓地を置く番ではありません'
  const err = notYourTurn(state, player) ?? settlementError(state, player, vertex, false)
  if (err) return err

  state.buildings[vertex] = { owner: player, kind: 'settlement' }
  state.log.push({ kind: 'setupSettlement', player, vertex })

  // 2つ目の開拓地：隣接する地形1枚につき1枚ずつ受け取る
  if (phase.round === 2) {
    const gains = counts()
    for (const hex of TOPOLOGY.vertices[vertex].hexes) {
      const r = TERRAIN_RESOURCE[state.tiles[hex].terrain]
      if (r && state.bank[r] > gains[r]) gains[r]++
    }
    transfer(state.bank, state.players[player].resources, gains)
    state.log.push({ kind: 'setupResources', player, gains })
  }

  state.phase = { ...phase, step: 'road', lastSettlement: vertex }
  return null
}

export function placeSetupRoad(state: GameState, player: PlayerId, edge: EdgeId): string | null {
  const phase = state.phase
  if (phase.type !== 'setup' || phase.step !== 'road') return '今は道を置く番ではありません'
  const err = notYourTurn(state, player) ?? roadError(state, player, edge, phase.lastSettlement)
  if (err) return err

  state.roads[edge] = player
  state.log.push({ kind: 'setupRoad', player, edge })
  updateLongestRoad(state)

  const index = phase.index + 1
  if (index >= phase.order.length) {
    // 初期配置おわり → スタートプレイヤーから通常の手番
    state.turn = 1
    state.currentPlayer = state.startPlayer
    state.phase = { type: 'preRoll' }
    state.log.push({ kind: 'turnStart', player: state.currentPlayer, turn: state.turn })
    return null
  }
  state.currentPlayer = phase.order[index]
  state.phase = {
    type: 'setup',
    round: index < state.players.length ? 1 : 2,
    step: 'settlement',
    order: phase.order,
    index,
    lastSettlement: null,
  }
  return null
}
