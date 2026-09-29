import { useState } from 'react'
import { counts, total, RESOURCES, type GameState, type PlayerId } from '../../logic/index.ts'
import { Counts, ResourceStepper, Sheet } from '../components.tsx'
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
  const remaining = counts()
  for (const r of RESOURCES) remaining[r] = hand[r] - picked[r]
  return (
    <Sheet title="7が出ました：手札を捨てる">
      <p>
        {state.players[player].name}さんは手札が{total(hand)}枚あるので、<strong>{need}枚</strong>選んで捨ててください。
      </p>
      <ResourceStepper
        value={picked}
        onChange={setPicked}
        max={(r) => (chosen < need ? hand[r] : picked[r])}
        dim={(r) => hand[r] === 0}
        note={(r) =>
          picked[r] > 0 ? (
            <>
              持っている{hand[r]}枚 → <strong>残り{hand[r] - picked[r]}枚</strong>
            </>
          ) : (
            `持っている${hand[r]}枚`
          )
        }
      />
      <p className="discard-summary">
        捨てた後の手札：
        <Counts value={remaining} />（{total(hand) - chosen}枚）
      </p>
      <div className="sheet-actions">
        <button
          className="primary"
          disabled={chosen !== need}
          onClick={() => void dispatch({ type: 'discard', resources: picked })}
        >
          {chosen}/{need}枚を捨てる
        </button>
      </div>
    </Sheet>
  )
}
