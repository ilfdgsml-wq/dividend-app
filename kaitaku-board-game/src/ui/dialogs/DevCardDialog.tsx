import { useState } from 'react'
import {
  counts,
  devCardError,
  total,
  RESOURCES,
  type DevCardType,
  type GameState,
  type Resource,
} from '../../logic/index.ts'
import { ResourcePicker, ResourceStepper, Sheet } from '../components.tsx'
import { DEV_DESCRIPTION, DEV_EMOJI, DEV_LABEL } from '../labels.ts'
import type { Dispatch } from './types.ts'

const ORDER: DevCardType[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint']

export function DevCardDialog({
  state,
  dispatch,
  onClose,
}: {
  state: GameState
  dispatch: Dispatch
  onClose: () => void
}) {
  const me = state.currentPlayer
  const hand = state.players[me].devCards
  const [choosing, setChoosing] = useState<'yearOfPlenty' | 'monopoly' | null>(null)
  const [plenty, setPlenty] = useState(counts())
  const [mono, setMono] = useState<Resource | null>(null)

  const play = (type: DevCardType) => {
    if (type === 'knight') {
      void dispatch({ type: 'playKnight' }).then((ok) => ok && onClose())
    } else if (type === 'roadBuilding') {
      void dispatch({ type: 'playRoadBuilding' }).then((ok) => ok && onClose())
    } else if (type === 'yearOfPlenty' || type === 'monopoly') {
      setChoosing(type)
    }
  }

  if (choosing === 'yearOfPlenty') {
    const picked = RESOURCES.flatMap((r) => Array<Resource>(plenty[r]).fill(r))
    return (
      <Sheet title="収穫：資源を2枚選ぶ" onClose={() => setChoosing(null)}>
        <ResourceStepper
          value={plenty}
          onChange={setPlenty}
          max={(r) => (total(plenty) >= 2 ? plenty[r] : Math.min(2, state.bank[r]))}
        />
        <div className="sheet-actions">
          <button
            className="primary"
            disabled={picked.length !== 2}
            onClick={() => {
              void dispatch({ type: 'playYearOfPlenty', resources: [picked[0], picked[1]] }).then(
                (ok) => ok && onClose(),
              )
            }}
          >
            受け取る
          </button>
        </div>
      </Sheet>
    )
  }

  if (choosing === 'monopoly') {
    return (
      <Sheet title="独占：資源を1種類選ぶ" onClose={() => setChoosing(null)}>
        <ResourcePicker value={mono} onChange={setMono} />
        <div className="sheet-actions">
          <button
            className="primary"
            disabled={!mono}
            onClick={() => {
              if (mono) void dispatch({ type: 'playMonopoly', resource: mono }).then((ok) => ok && onClose())
            }}
          >
            全員から集める
          </button>
        </div>
      </Sheet>
    )
  }

  const types = ORDER.filter((t) => hand.some((c) => c.type === t))
  return (
    <Sheet title="発展カード" onClose={onClose}>
      {types.length === 0 && <p className="muted">発展カードを持っていません。</p>}
      <ul className="dev-cards">
        {types.map((type) => {
          const n = hand.filter((c) => c.type === type).length
          const error = type === 'victoryPoint' ? null : devCardError(state, me, type)
          return (
            <li key={type}>
              <div className="dev-card-head">
                <span className="dev-card-name">
                  {DEV_EMOJI[type]} {DEV_LABEL[type]} ×{n}
                </span>
                {type !== 'victoryPoint' && (
                  <button className="primary" disabled={error !== null} onClick={() => play(type)}>
                    使う
                  </button>
                )}
              </div>
              <div className="muted">{DEV_DESCRIPTION[type]}</div>
              {error && type !== 'victoryPoint' && <div className="hint">{error}</div>}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
