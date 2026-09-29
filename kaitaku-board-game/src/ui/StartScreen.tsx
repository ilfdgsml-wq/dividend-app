import { useState, type CSSProperties } from 'react'
import { createGame, MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, type BoardType } from '../logic/index.ts'
import { OnlineStart } from './online/OnlineStart.tsx'
import type { SavedGame } from './storage.ts'

const DEFAULT_NAMES = ['あか', 'あお', 'だいだい', 'むらさき']

export function StartScreen({
  saved,
  onStart,
  onEnterRoom,
}: {
  saved: SavedGame | null
  onStart: (game: SavedGame) => void
  onEnterRoom: (roomId: string) => void
}) {
  const [count, setCount] = useState(4)
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [board, setBoard] = useState<BoardType>('random')
  const [privacy, setPrivacy] = useState(true)

  const start = () => {
    const players = names.slice(0, count).map((name, i) => ({
      name: name.trim() || `プレイヤー${i + 1}`,
      color: PLAYER_COLORS[i],
    }))
    onStart({ state: createGame({ players, board }, Math.random), settings: { privacy } })
  }

  return (
    <main className="start">
      <h1 className="title">
        <span aria-hidden="true">⬢</span> 開拓ボードゲーム
      </h1>
      <p className="muted">
        {MIN_PLAYERS}〜{MAX_PLAYERS}人で遊ぶ、資源を集めて開拓するボードゲーム。10点先取で勝ち。
      </p>

      <OnlineStart onEnterRoom={onEnterRoom} />

      {saved && saved.state.phase.type !== 'gameOver' && (
        <section className="panel resume">
          <h2>前回のゲーム（この端末）</h2>
          <p>
            {saved.state.players.map((p) => p.name).join('・')}（{saved.state.turn}手目）
          </p>
          <button className="primary" onClick={() => onStart(saved)}>
            続きから遊ぶ
          </button>
        </section>
      )}

      <section className="panel">
        <h2>この端末でみんなで遊ぶ</h2>
        <p className="muted">1台のスマホを順番に回して遊びます。</p>
        <div className="field">
          <span className="field-label">人数</span>
          <div className="segmented">
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
              <button key={n} className={count === n ? 'selected' : ''} onClick={() => setCount(n)}>
                {n}人
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">名前（手番順はゲーム開始時にランダムで決まります）</span>
          {names.slice(0, count).map((name, i) => (
            <label key={i} className="name-input" style={{ '--pc': PLAYER_COLORS[i] } as CSSProperties}>
              <span className="swatch" aria-hidden="true" />
              <input
                value={name}
                maxLength={10}
                aria-label={`プレイヤー${i + 1}の名前`}
                onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
              />
            </label>
          ))}
        </div>

        <div className="field">
          <span className="field-label">盤面</span>
          <div className="segmented">
            <button className={board === 'random' ? 'selected' : ''} onClick={() => setBoard('random')}>
              ランダム
            </button>
            <button className={board === 'beginner' ? 'selected' : ''} onClick={() => setBoard('beginner')}>
              初心者向け（固定）
            </button>
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          手番交代時に「端末を渡す」画面を出す（手札を隠す）
        </label>

        <button className="primary big" onClick={start}>
          ゲーム開始
        </button>
      </section>
    </main>
  )
}
