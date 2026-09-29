import type { GameState, PlayerId } from '../../logic/index.ts'
import { formatLog } from '../labels.ts'

/** logStart = state.log[0] が元のログの何番目か（オンラインでは古いログが省かれる） */
export function LogPanel({ state, logStart, viewer }: { state: GameState; logStart: number; viewer: PlayerId | null }) {
  const lines = state.log
    .map((entry, i) => ({ key: logStart + i, text: formatLog(entry, state, viewer) }))
    .filter((l): l is { key: number; text: string } => l.text !== null)
    .slice(-80)
    .reverse()
  return (
    <details className="log">
      <summary>ログ</summary>
      <ol>
        {lines.map((l) => (
          <li key={l.key}>{l.text}</li>
        ))}
      </ol>
    </details>
  )
}
