// 発展カードの使用（騎士・街道建設・収穫・独占）。勝利点カードは使用操作なしで常に点数に数える。

import { counts, hasAtLeast, isResource, transfer } from '../resources.ts'
import { legalRoadEdges, piecesLeft, roadError } from '../rules/placement.ts'
import { updateLargestArmy } from '../rules/largestArmy.ts'
import { updateLongestRoad } from '../rules/longestRoad.ts'
import type { DevCardType, EdgeId, GameState, PlayerId, Resource, ResumePhase } from '../types.ts'
import { notYourTurn, resumePhase, wrongPhase } from './common.ts'

type PlayableCard = Exclude<DevCardType, 'victoryPoint'>

/** 使えるかどうかの確認（状態は変更しない） */
export function devCardError(state: GameState, player: PlayerId, type: PlayableCard): string | null {
  const err = notYourTurn(state, player) ?? wrongPhase(state, 'preRoll', 'main')
  if (err) return err
  if (state.devCardPlayedThisTurn) return '発展カードは1手番に1枚までです'
  const cards = state.players[player].devCards.filter((c) => c.type === type)
  if (cards.length === 0) return 'そのカードを持っていません'
  if (!cards.some((c) => c.boughtTurn < state.turn)) return '買ったばかりの発展カードはこの手番には使えません'
  return null
}

/** カードを1枚使用済みにして、処理後に戻るフェーズを返す */
function consume(state: GameState, player: PlayerId, type: PlayableCard): ResumePhase {
  const hand = state.players[player].devCards
  hand.splice(
    hand.findIndex((c) => c.type === type && c.boughtTurn < state.turn),
    1,
  )
  state.devCardPlayedThisTurn = true
  state.log.push({ kind: 'playDev', player, card: type })
  return state.phase.type === 'preRoll' ? 'preRoll' : 'main'
}

export function playKnight(state: GameState, player: PlayerId): string | null {
  const err = devCardError(state, player, 'knight')
  if (err) return err
  const resume = consume(state, player, 'knight')
  state.players[player].knightsPlayed += 1
  updateLargestArmy(state, player)
  state.phase = { type: 'moveRobber', resume }
  return null
}

export function playRoadBuilding(state: GameState, player: PlayerId): string | null {
  const err = devCardError(state, player, 'roadBuilding')
  if (err) return err
  const left = piecesLeft(state, player, 'road')
  if (left <= 0) return '道の駒が残っていません'
  if (legalRoadEdges(state, player).length === 0) return '道を置ける場所がありません'
  const resume = consume(state, player, 'roadBuilding')
  state.phase = { type: 'roadBuilding', remaining: Math.min(2, left), resume }
  return null
}

export function placeFreeRoad(state: GameState, player: PlayerId, edge: EdgeId): string | null {
  const phase = state.phase
  if (phase.type !== 'roadBuilding') return wrongPhase(state, 'roadBuilding')
  const err = notYourTurn(state, player) ?? roadError(state, player, edge)
  if (err) return err
  state.roads[edge] = player
  state.log.push({ kind: 'build', player, what: 'road', free: true })
  updateLongestRoad(state)
  const remaining = phase.remaining - 1
  // 置き終わった、または在庫・置き場所が尽きたら終了
  if (remaining <= 0 || legalRoadEdges(state, player).length === 0) state.phase = resumePhase(phase.resume)
  else state.phase = { ...phase, remaining }
  return null
}

export function playYearOfPlenty(state: GameState, player: PlayerId, resources: [Resource, Resource]): string | null {
  const err = devCardError(state, player, 'yearOfPlenty')
  if (err) return err
  if (!Array.isArray(resources) || resources.length !== 2 || !resources.every(isResource)) {
    return '受け取る資源を2つ選んでください'
  }
  const want = counts()
  for (const r of resources) want[r]++
  if (!hasAtLeast(state.bank, want)) return '銀行にその資源が足りません'
  consume(state, player, 'yearOfPlenty')
  transfer(state.bank, state.players[player].resources, want)
  state.log.push({ kind: 'yearOfPlenty', player, resources: [resources[0], resources[1]] })
  return null
}

export function playMonopoly(state: GameState, player: PlayerId, resource: Resource): string | null {
  const err = devCardError(state, player, 'monopoly')
  if (err) return err
  if (!isResource(resource)) return '資源を1種類選んでください'
  consume(state, player, 'monopoly')
  let count = 0
  state.players.forEach((p, i) => {
    if (i === player) return
    count += p.resources[resource]
    transfer(p.resources, state.players[player].resources, counts({ [resource]: p.resources[resource] }))
  })
  state.log.push({ kind: 'monopoly', player, resource, count })
  return null
}
