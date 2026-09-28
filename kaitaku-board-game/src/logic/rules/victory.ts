import { WINNING_POINTS } from '../constants.ts'
import type { GameState, PlayerId } from '../types.ts'

export interface PointBreakdown {
  settlements: number
  cities: number
  longestRoad: number
  largestArmy: number
  victoryCards: number
}

export function pointBreakdown(state: GameState, player: PlayerId): PointBreakdown {
  let settlements = 0
  let cities = 0
  for (const b of state.buildings) {
    if (b?.owner !== player) continue
    if (b.kind === 'settlement') settlements += 1
    else cities += 2
  }
  return {
    settlements,
    cities,
    longestRoad: state.longestRoad.holder === player ? 2 : 0,
    largestArmy: state.largestArmy.holder === player ? 2 : 0,
    victoryCards: state.players[player].devCards.filter((c) => c.type === 'victoryPoint').length,
  }
}

/** includeHidden = 非公開の勝利点カードを含めるか（本人の画面・勝利判定では true） */
export function victoryPoints(state: GameState, player: PlayerId, includeHidden: boolean): number {
  const b = pointBreakdown(state, player)
  return b.settlements + b.cities + b.longestRoad + b.largestArmy + (includeHidden ? b.victoryCards : 0)
}

/** 手番プレイヤーが10点以上なら勝利（他人の手番中は判定しない＝手番が来た時点で判定される） */
export function checkVictory(state: GameState): void {
  if (state.phase.type === 'setup' || state.phase.type === 'gameOver') return
  const p = state.currentPlayer
  const points = victoryPoints(state, p, true)
  if (points >= WINNING_POINTS) {
    state.winner = p
    state.phase = { type: 'gameOver' }
    state.trade = null
    state.log.push({ kind: 'win', player: p, points })
  }
}
