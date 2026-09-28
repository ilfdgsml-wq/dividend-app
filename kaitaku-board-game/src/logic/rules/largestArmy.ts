import { LARGEST_ARMY_MIN } from '../constants.ts'
import type { GameState, PlayerId } from '../types.ts'

/** 騎士を使った直後に呼ぶ。3枚以上かつ保持者より多ければ移る（同数では移らない） */
export function updateLargestArmy(state: GameState, player: PlayerId): void {
  const knights = state.players[player].knightsPlayed
  const holder = state.largestArmy.holder
  if (knights < LARGEST_ARMY_MIN || holder === player) return
  if (holder === null || knights > state.players[holder].knightsPlayed) {
    state.largestArmy.holder = player
    state.log.push({ kind: 'largestArmy', player })
  }
}
