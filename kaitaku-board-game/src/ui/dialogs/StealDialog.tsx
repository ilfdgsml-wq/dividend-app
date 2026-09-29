import type { CSSProperties } from 'react'
import type { PlayerView, PlayerId } from '../../logic/index.ts'
import { Sheet } from '../components.tsx'
import type { Dispatch } from './types.ts'

export function StealDialog({
  view,
  candidates,
  dispatch,
}: {
  view: PlayerView
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
            style={{ '--pc': view.players[p].color } as CSSProperties}
            onClick={() => void dispatch({ type: 'steal', target: p })}
          >
            {view.players[p].name}
            <small>手札 {view.players[p].resourceCount}枚</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
