import type { CSSProperties } from 'react'
import type { GameState, PlayerId } from '../logic/index.ts'

/** ホットシートの目隠し：端末を次の人に渡してもらう画面 */
export function HandoffScreen({
  state,
  player,
  reason,
  onReady,
}: {
  state: GameState
  player: PlayerId
  reason: 'turn' | 'discard' | 'trade'
  onReady: () => void
}) {
  const p = state.players[player]
  const message = {
    turn: player === state.currentPlayer ? `${p.name}さんの番です` : `${p.name}さんに渡してください`,
    discard: `7が出ました。${p.name}さんは手札を捨ててください`,
    trade: `${state.players[state.currentPlayer].name}さんからの交易の提案に、${p.name}さんが答えます`,
  }[reason]
  return (
    <div className="handoff" style={{ '--pc': p.color } as CSSProperties}>
      <div className="handoff-card">
        <p className="handoff-lead">端末を渡してください</p>
        <p className="handoff-name">{p.name}</p>
        <p>{message}</p>
        <button className="primary big" onClick={onReady}>
          {p.name}さんです（手札を表示）
        </button>
        <p className="muted">他の人に手札が見えないように注意してください</p>
      </div>
    </div>
  )
}
