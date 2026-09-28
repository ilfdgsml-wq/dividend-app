import type { CSSProperties } from 'react'
import { RESOURCES, type DevCardType, type GameState, type PlayerId } from '../../logic/index.ts'
import { DEV_EMOJI, DEV_LABEL, RESOURCE_EMOJI, RESOURCE_LABEL } from '../labels.ts'

/** 画面を見ている人（viewer）の手札 */
export function Hand({ state, viewer }: { state: GameState; viewer: PlayerId }) {
  const player = state.players[viewer]
  const devCounts = new Map<DevCardType, { total: number; fresh: number }>()
  for (const c of player.devCards) {
    const entry = devCounts.get(c.type) ?? { total: 0, fresh: 0 }
    entry.total++
    if (c.boughtTurn === state.turn) entry.fresh++
    devCounts.set(c.type, entry)
  }
  return (
    <section className="hand" aria-label={`${player.name}さんの手札`} style={{ '--pc': player.color } as CSSProperties}>
      <div className="hand-title">{player.name}さんの手札</div>
      <div className="cards">
        {RESOURCES.map((r) => (
          <div key={r} className={player.resources[r] > 0 ? 'card' : 'card empty'} title={RESOURCE_LABEL[r]}>
            <span className="card-emoji">{RESOURCE_EMOJI[r]}</span>
            <span className="card-count">{player.resources[r]}</span>
          </div>
        ))}
      </div>
      {devCounts.size > 0 && (
        <div className="dev-list">
          {[...devCounts.entries()].map(([type, { total, fresh }]) => (
            <span key={type} className="dev-chip">
              {DEV_EMOJI[type]} {DEV_LABEL[type]}×{total}
              {fresh > 0 && <small className="fresh">（新{fresh}）</small>}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
