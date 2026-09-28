import type { CSSProperties } from 'react'
import { total, victoryPoints, type GameState, type PlayerId } from '../../logic/index.ts'

export function PlayerList({ state, viewer }: { state: GameState; viewer: PlayerId | null }) {
  const over = state.phase.type === 'gameOver'
  return (
    <ul className="players">
      {state.players.map((p, i) => {
        const shown = victoryPoints(state, i, over)
        const hidden = !over && i === viewer ? victoryPoints(state, i, true) - shown : 0
        const current = i === state.currentPlayer
        return (
          <li
            key={i}
            className={current ? 'player current' : 'player'}
            style={{ '--pc': p.color } as CSSProperties}
            aria-current={current ? 'true' : undefined}
          >
            <div className="player-name">
              {current && <span className="turn-mark">▶</span>}
              {p.name}
            </div>
            <div className="player-points" title="勝利点">
              {shown}
              {hidden > 0 && <small title="あなたにだけ見える勝利点カード">+{hidden}</small>}
              <small>点</small>
            </div>
            <div className="player-stats">
              <span title="資源カードの枚数">🃏{total(p.resources)}</span>
              <span title="発展カードの枚数">📜{p.devCards.length}</span>
              <span title="使った騎士">⚔️{p.knightsPlayed}</span>
              <span title="最長の道">🛤️{state.longestRoad.lengths[i] ?? 0}</span>
            </div>
            <div className="player-badges">
              {state.longestRoad.holder === i && <span className="badge">最長交易路</span>}
              {state.largestArmy.holder === i && <span className="badge">最大騎士力</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
