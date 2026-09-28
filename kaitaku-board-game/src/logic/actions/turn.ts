import type { GameState, PlayerId } from '../types.ts'
import { notYourTurn, wrongPhase } from './common.ts'

export function endTurn(state: GameState, player: PlayerId): string | null {
  const err = notYourTurn(state, player) ?? wrongPhase(state, 'main')
  if (err) return err
  state.trade = null
  state.turn += 1
  state.currentPlayer = (player + 1) % state.players.length
  state.phase = { type: 'preRoll' }
  state.devCardPlayedThisTurn = false
  state.lastRoll = null
  state.log.push({ kind: 'turnStart', player: state.currentPlayer, turn: state.turn })
  return null
}
