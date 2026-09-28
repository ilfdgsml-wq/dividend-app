import { useState } from 'react'
import { counts, total, type GameState, type PlayerId } from '../../logic/index.ts'
import { ResourceStepper, Sheet } from '../components.tsx'
import type { Dispatch } from './types.ts'

export function DiscardDialog({
  state,
  player,
  need,
  dispatch,
}: {
  state: GameState
  player: PlayerId
  need: number
  dispatch: Dispatch
}) {
  const [picked, setPicked] = useState(counts())
  const hand = state.players[player].resources
  const chosen = total(picked)
  return (
    <Sheet title="7が出ました：手札を捨てる">
      <p>
        {state.players[player].name}さんは手札が{total(hand)}枚あるので、<strong>{need}枚</strong>選んで捨ててください。
      </p>
      <ResourceStepper value={picked} onChange={setPicked} max={(r) => (chosen < need ? hand[r] : picked[r])} />
      <div className="sheet-actions">
        <button
          className="primary"
          disabled={chosen !== need}
          onClick={() => dispatch({ type: 'discard', resources: picked }, player)}
        >
          {chosen}/{need}枚を捨てる
        </button>
      </div>
    </Sheet>
  )
}
