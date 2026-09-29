import type { CSSProperties } from 'react'
import type { PlayerId, PlayerView } from '../../logic/index.ts'

/** 全員の公開情報。手札・発展カードは枚数だけ、点数は非公開の勝利点カードを含めない */
export function PlayerList({
  view,
  viewer,
  you,
}: {
  view: PlayerView
  /** 自分の勝利点カードを「+1」のように表示する人（目隠し中は null） */
  viewer: PlayerId | null
  /** オンラインで「あなた」と表示する席 */
  you?: PlayerId | null
}) {
  const over = view.phase.type === 'gameOver'
  return (
    <ul className="players">
      {view.players.map((p, i) => {
        const hidden = !over && i === viewer ? (p.devCards ?? []).filter((c) => c.type === 'victoryPoint').length : 0
        const current = i === view.currentPlayer
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
              {you === i && <small className="you">（あなた）</small>}
            </div>
            <div className="player-points" title="勝利点">
              {p.publicPoints}
              {hidden > 0 && <small title="あなたにだけ見える勝利点カード">+{hidden}</small>}
              <small>点</small>
            </div>
            <div className="player-stats">
              <span title="資源カードの枚数">🃏{p.resourceCount}</span>
              <span title="発展カードの枚数">📜{p.devCardCount}</span>
              <span title="使った騎士">⚔️{p.knightsPlayed}</span>
              <span title="最長の道">🛤️{view.longestRoad.lengths[i] ?? 0}</span>
            </div>
            <div className="player-badges">
              {view.longestRoad.holder === i && <span className="badge">最長交易路</span>}
              {view.largestArmy.holder === i && <span className="badge">最大騎士力</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
