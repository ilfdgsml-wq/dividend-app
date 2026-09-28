import type { CSSProperties } from 'react'
import { total, type GameState, type PlayerId } from '../../logic/index.ts'
import { Sheet } from '../components.tsx'
import type { Dispatch } from './types.ts'

export function StealDialog({
  state,
  candidates,
  dispatch,
}: {
  state: GameState
  candidates: PlayerId[]
  dispatch: Dispatch
}) {
  return (
    <Sheet title="誰から奪いますか？">
      <p>選んだ人の手札からランダムに1枚もらいます。</p>
      <div className="choice-list">
        {candidates.map((p) => (
          <button
            key={p}
            className="player-choice"
            style={{ '--pc': state.players[p].color } as CSSProperties}
            onClick={() => dispatch({ type: 'steal', target: p }, state.currentPlayer)}
          >
            {state.players[p].name}
            <small>手札 {total(state.players[p].resources)}枚</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
