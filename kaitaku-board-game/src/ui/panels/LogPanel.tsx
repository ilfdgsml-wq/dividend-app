import type { GameState, PlayerId } from '../../logic/index.ts'
import { formatLog } from '../labels.ts'

export function LogPanel({ state, viewer }: { state: GameState; viewer: PlayerId | null }) {
  const lines = state.log
    .map((entry, i) => ({ i, text: formatLog(entry, state, viewer) }))
    .filter((l): l is { i: number; text: string } => l.text !== null)
    .slice(-80)
    .reverse()
  return (
    <details className="log">
      <summary>ログ</summary>
      <ol>
        {lines.map((l) => (
          <li key={l.i}>{l.text}</li>
        ))}
      </ol>
    </details>
  )
}
