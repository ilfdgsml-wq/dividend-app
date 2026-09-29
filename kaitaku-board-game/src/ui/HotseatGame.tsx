// ホットシート（1台の端末を回して遊ぶ）。完全な状態を手元に持ち、見ている人の目線だけを画面に渡す。

import { useEffect, useMemo, useState } from 'react'
import { applyAction, viewFor, type Action, type GameState, type PlayerId } from '../logic/index.ts'
import { GameScreen } from './GameScreen.tsx'
import { HandoffScreen } from './HandoffScreen.tsx'
import { saveGame, type SavedGame, type Settings } from './storage.ts'

/** 今この端末を操作すべき人（捨て札中は捨てる人、交易の返答中は答える人） */
function actorOf(state: GameState, responder: PlayerId | null): PlayerId {
  const phase = state.phase
  if (phase.type === 'discard') {
    const n = state.players.length
    for (let i = 0; i < n; i++) {
      const p = (state.currentPlayer + i) % n
      if (phase.pending[p] > 0) return p
    }
  }
  if (responder !== null && state.trade) return responder
  return state.currentPlayer
}

export function HotseatGame({ initial, onQuit }: { initial: SavedGame; onQuit: () => void }) {
  const [state, setState] = useState(initial.state)
  const [settings, setSettings] = useState<Settings>(initial.settings)
  const [viewerRaw, setViewer] = useState<PlayerId>(() => actorOf(initial.state, null))
  const [responder, setResponder] = useState<PlayerId | null>(null)

  useEffect(() => saveGame({ state, settings }), [state, settings])

  const phase = state.phase
  const actor = actorOf(state, responder)
  // 初期配置中は隠す情報がないので、目隠し画面を出さない
  const privacy = settings.privacy && phase.type !== 'setup' && phase.type !== 'gameOver'
  const viewer = privacy ? viewerRaw : actor
  const handoff = privacy && viewerRaw !== actor
  const view = useMemo(() => viewFor(state, viewer), [state, viewer])

  const send = async (action: Action) => {
    const result = applyAction(state, action, viewer, Math.random)
    if (result.error) return result.error
    setState(result.state)
    return null
  }

  return (
    <GameScreen
      view={view}
      viewer={viewer}
      send={send}
      mode={{
        kind: 'hotseat',
        responder,
        onAskResponder: setResponder,
        onResponderDone: () => setResponder(null),
      }}
      cover={
        handoff ? (
          <HandoffScreen
            state={state}
            player={actor}
            reason={phase.type === 'discard' ? 'discard' : responder !== null ? 'trade' : 'turn'}
            onReady={() => setViewer(actor)}
          />
        ) : null
      }
      menuExtra={
        <>
          <h3>設定</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.privacy}
              onChange={(e) => setSettings({ ...settings, privacy: e.target.checked })}
            />
            手番交代時に「端末を渡す」画面を出す（手札を隠す）
          </label>
        </>
      }
      quit={{
        label: 'ゲームをやめる',
        message: 'このゲームを終了してタイトルに戻りますか？進行中のデータは消えます。',
        onQuit,
      }}
      exitLabel="新しいゲーム"
      onExit={onQuit}
    />
  )
}
