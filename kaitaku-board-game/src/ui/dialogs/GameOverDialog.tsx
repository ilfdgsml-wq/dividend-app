import type { CSSProperties } from 'react'
import { pointBreakdown, victoryPoints, type GameState, type PointBreakdown } from '../../logic/index.ts'
import { Sheet } from '../components.tsx'

export function GameOverDialog({
  state,
  exitLabel,
  onExit,
}: {
  state: GameState
  exitLabel: string
  onExit: () => void
}) {
  const ranking = state.players
    .map((p, i) => ({ p, i, points: victoryPoints(state, i, true), b: pointBreakdown(state, i) }))
    .sort((a, b) => b.points - a.points)
  const winner = state.winner !== null ? state.players[state.winner] : null
  return (
    <Sheet title="ゲーム終了">
      {winner && <p className="winner">🎉 {winner.name}さんの勝利！</p>}
      <table className="scores">
        <thead>
          <tr>
            <th>名前</th>
            <th>点</th>
            <th>内訳</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map(({ p, i, points, b }) => (
            <tr key={i} style={{ '--pc': p.color } as CSSProperties}>
              <td className="score-name">{p.name}</td>
              <td className="score-points">{points}</td>
              <td className="muted">{breakdownText(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sheet-actions">
        <button className="primary" onClick={onExit}>
          {exitLabel}
        </button>
      </div>
    </Sheet>
  )
}

function breakdownText(b: PointBreakdown): string {
  const items: [string, number][] = [
    ['開拓地', b.settlements],
    ['都市', b.cities],
    ['最長交易路', b.longestRoad],
    ['最大騎士力', b.largestArmy],
    ['勝利点カード', b.victoryCards],
  ]
  return items
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label}${n}点`)
    .join('・')
}
