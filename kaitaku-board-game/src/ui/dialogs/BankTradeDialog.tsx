import { useState } from 'react'
import { counts, tradeRates, type GameState, type Resource } from '../../logic/index.ts'
import { ResourcePicker, Sheet } from '../components.tsx'
import { RESOURCE_EMOJI, RESOURCE_LABEL } from '../labels.ts'
import type { Dispatch } from './types.ts'

export function BankTradeDialog({
  state,
  dispatch,
  onClose,
}: {
  state: GameState
  dispatch: Dispatch
  onClose: () => void
}) {
  const player = state.currentPlayer
  const hand = state.players[player].resources
  const rates = tradeRates(state, player)
  const [give, setGive] = useState<Resource | null>(null)
  const [get, setGet] = useState<Resource | null>(null)
  const [units, setUnits] = useState(1)

  const maxUnits = give && get ? Math.min(Math.floor(hand[give] / rates[give]), state.bank[get]) : 0
  const n = Math.min(units, Math.max(1, maxUnits))

  const submit = async () => {
    if (!give || !get) return
    const ok = await dispatch({
      type: 'bankTrade',
      give: counts({ [give]: rates[give] * n }),
      get: counts({ [get]: n }),
    })
    if (ok) {
      setGive(null)
      setGet(null)
      setUnits(1)
    }
  }

  return (
    <Sheet title="海上交易（銀行）" onClose={onClose}>
      <h3>出す資源</h3>
      <ResourcePicker
        value={give}
        onChange={(r) => {
          setGive(r)
          if (get === r) setGet(null)
        }}
        disabled={(r) => hand[r] < rates[r]}
        note={(r) => `${rates[r]}:1（${hand[r]}枚）`}
      />
      <h3>もらう資源</h3>
      <ResourcePicker
        value={get}
        onChange={setGet}
        disabled={(r) => r === give || state.bank[r] === 0}
        note={(r) => `銀行${state.bank[r]}`}
      />
      {give && get && maxUnits > 0 && (
        <div className="units">
          <button className="step" disabled={n <= 1} onClick={() => setUnits(n - 1)} aria-label="減らす">
            −
          </button>
          <span>
            {RESOURCE_EMOJI[give]}
            {RESOURCE_LABEL[give]}×{rates[give] * n} → {RESOURCE_EMOJI[get]}
            {RESOURCE_LABEL[get]}×{n}
          </span>
          <button className="step" disabled={n >= maxUnits} onClick={() => setUnits(n + 1)} aria-label="増やす">
            ＋
          </button>
        </div>
      )}
      <div className="sheet-actions">
        <button className="primary" disabled={!give || !get || maxUnits === 0} onClick={() => void submit()}>
          交換する
        </button>
      </div>
    </Sheet>
  )
}
