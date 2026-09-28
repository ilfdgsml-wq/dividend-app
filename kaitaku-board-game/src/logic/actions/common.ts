import { hasAtLeast, transfer } from '../resources.ts'
import type { GameState, Phase, PlayerId, ResourceCounts, ResumePhase } from '../types.ts'

/** 手番プレイヤー以外の操作を弾く */
export function notYourTurn(state: GameState, player: PlayerId): string | null {
  return player === state.currentPlayer ? null : 'あなたの手番ではありません'
}

const PHASE_LABELS: Record<Phase['type'], string> = {
  setup: '初期配置中',
  preRoll: 'サイコロを振る前',
  discard: '捨て札の選択中',
  moveRobber: '盗賊の移動中',
  steal: '奪う相手の選択中',
  main: '交易・建設中',
  roadBuilding: '街道建設カードの処理中',
  gameOver: 'ゲーム終了後',
}

/** 今のフェーズでその操作ができるか */
export function wrongPhase(state: GameState, ...allowed: Phase['type'][]): string | null {
  if (allowed.includes(state.phase.type)) return null
  return `今は${PHASE_LABELS[state.phase.type]}のため、その操作はできません`
}

/** 資源を銀行に支払う */
export function pay(state: GameState, player: PlayerId, cost: ResourceCounts): string | null {
  const hand = state.players[player].resources
  if (!hasAtLeast(hand, cost)) return '資源が足りません'
  transfer(hand, state.bank, cost)
  return null
}

export function resumePhase(resume: ResumePhase): Phase {
  return { type: resume }
}
