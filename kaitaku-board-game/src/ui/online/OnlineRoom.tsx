// オンライン対戦の部屋（参加 → 待合室 → ゲーム）。URL の ?room=コード で開く

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, type Action, type BoardType } from '../../logic/index.ts'
import { getBackend, type RoomSnapshot, type RoomWatch } from '../../online/backend.ts'
import { MAX_NAME_LENGTH, normalizeName, type RoomSummary } from '../../online/protocol.ts'
import { GameScreen } from '../GameScreen.tsx'
import { loadName, roomUrl, saveLastRoom, saveName } from './prefs.ts'

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'outside'; summary: RoomSummary | null }
  | { kind: 'inside'; userId: string }

export function OnlineRoom({ roomId, onExit }: { roomId: string; onExit: () => void }) {
  const backend = getBackend()
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const [snap, setSnap] = useState<RoomSnapshot | null>(null)
  const [watchError, setWatchError] = useState<string | null>(null)
  const watchRef = useRef<RoomWatch | null>(null)

  // ログインして、参加済みかどうかを確かめる
  useEffect(() => {
    if (!backend) return
    let cancelled = false
    void (async () => {
      try {
        const userId = await backend.signIn()
        const peek = await backend.request({ op: 'peek', roomId })
        if (cancelled) return
        if (!peek.ok) setStage({ kind: 'outside', summary: null })
        else if (peek.room?.isMember) setStage({ kind: 'inside', userId })
        else setStage({ kind: 'outside', summary: peek.room ?? null })
      } catch (e) {
        if (!cancelled) setStage({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [backend, roomId])

  // 参加後は部屋の変化を見守る
  const inside = stage.kind === 'inside'
  useEffect(() => {
    if (!backend || !inside) return
    const watch = backend.watch(
      roomId,
      (s) => {
        setWatchError(null)
        setSnap(s)
      },
      setWatchError,
    )
    watchRef.current = watch
    saveLastRoom(roomId)
    return () => {
      watch.stop()
      watchRef.current = null
    }
  }, [backend, inside, roomId])

  if (!backend)
    return <Message title="オンライン対戦は使えません" text="サイトの設定が済んでいません。" onExit={onExit} />
  if (stage.kind === 'loading') return <Message title="部屋に接続しています…" onExit={onExit} />
  if (stage.kind === 'error') return <Message title="接続できませんでした" text={stage.message} onExit={onExit} />
  if (stage.kind === 'outside') {
    return (
      <JoinForm
        roomId={roomId}
        summary={stage.summary}
        onJoin={async (name) => {
          const res = await backend.request({ op: 'join', roomId, name })
          if (!res.ok) return res.error
          const userId = await backend.signIn()
          setStage({ kind: 'inside', userId })
          return null
        }}
        onExit={onExit}
      />
    )
  }

  const leave = () => {
    saveLastRoom(null)
    onExit()
  }

  if (!snap) return <Message title="部屋を読み込んでいます…" text={watchError ?? undefined} onExit={onExit} />
  if (!snap.room) {
    return <Message title="部屋がなくなりました" text="部屋を作った人が部屋を閉じました。" onExit={leave} />
  }

  if (snap.room.status === 'lobby' || !snap.view) {
    return (
      <Lobby
        snap={snap}
        userId={stage.userId}
        roomId={roomId}
        error={watchError}
        onStart={async (board) => {
          const res = await backend.request({ op: 'start', roomId, board })
          watchRef.current?.refresh()
          return res.ok ? null : res.error
        }}
        onLeave={async () => {
          const res = await backend.request({ op: 'leave', roomId })
          if (res.ok) leave()
          return res.ok ? null : res.error
        }}
        onExit={onExit}
      />
    )
  }

  const view = snap.view
  const send = async (action: Action) => {
    const res = await backend.request({ op: 'action', roomId, action })
    watchRef.current?.refresh()
    return res.ok ? null : res.error
  }

  return (
    <GameScreen
      view={view}
      viewer={view.viewer ?? 0}
      send={send}
      mode={{ kind: 'online' }}
      menuExtra={<InviteBox roomId={roomId} compact />}
      quit={{
        label: 'トップに戻る',
        message: 'トップ画面に戻りますか？この部屋のURLを開けば、いつでも同じ席に戻れます。',
        onQuit: onExit,
      }}
      exitLabel="トップに戻る"
      onExit={leave}
    />
  )
}

function Message({ title, text, onExit }: { title: string; text?: string; onExit: () => void }) {
  return (
    <main className="start">
      <section className="panel">
        <h2>{title}</h2>
        {text && <p>{text}</p>}
        <button onClick={onExit}>トップに戻る</button>
      </section>
    </main>
  )
}

function JoinForm({
  roomId,
  summary,
  onJoin,
  onExit,
}: {
  roomId: string
  summary: RoomSummary | null
  onJoin: (name: string) => Promise<string | null>
  onExit: () => void
}) {
  const [name, setName] = useState(loadName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!summary) {
    return <Message title="部屋が見つかりません" text={`部屋コード ${roomId} を確かめてください。`} onExit={onExit} />
  }
  if (summary.status !== 'lobby') {
    return (
      <Message
        title="この部屋のゲームはもう始まっています"
        text="途中からは参加できません。部屋を作った人に新しい部屋を作ってもらってください。"
        onExit={onExit}
      />
    )
  }
  if (summary.playerCount >= MAX_PLAYERS) {
    return <Message title="この部屋は満員です" text={`最大${MAX_PLAYERS}人までです。`} onExit={onExit} />
  }

  const submit = async () => {
    const n = normalizeName(name)
    if (!n) return setError('名前を入力してください')
    setBusy(true)
    setError(null)
    saveName(n)
    const err = await onJoin(n)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <main className="start">
      <h1 className="title">
        <span aria-hidden="true">⬢</span> 開拓ボードゲーム
      </h1>
      <section className="panel">
        <h2>{summary.hostName}さんの部屋に参加</h2>
        <p className="muted">
          部屋コード <strong className="code">{roomId}</strong>・いま{summary.playerCount}/{MAX_PLAYERS}人
        </p>
        <label className="field">
          <span className="field-label">あなたの名前</span>
          <input
            id="join-name"
            className="text-input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="例：はなこ"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="primary big" disabled={busy} onClick={() => void submit()}>
          参加する
        </button>
        {error && <p className="hint">{error}</p>}
        <button className="link" onClick={onExit}>
          トップに戻る
        </button>
      </section>
    </main>
  )
}

function Lobby({
  snap,
  userId,
  roomId,
  error,
  onStart,
  onLeave,
  onExit,
}: {
  snap: RoomSnapshot
  userId: string
  roomId: string
  error: string | null
  onStart: (board: BoardType) => Promise<string | null>
  onLeave: () => Promise<string | null>
  onExit: () => void
}) {
  const room = snap.room!
  const isHost = room.host === userId
  const [board, setBoard] = useState<BoardType>(room.board)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const enough = snap.seats.length >= MIN_PLAYERS

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true)
    setMessage(null)
    const err = await task()
    setBusy(false)
    if (err) setMessage(err)
  }

  return (
    <main className="start lobby">
      <h1 className="title">
        <span aria-hidden="true">⬢</span> 開拓ボードゲーム
      </h1>

      <section className="panel">
        <h2>友達を招待する</h2>
        <InviteBox roomId={roomId} />
      </section>

      <section className="panel">
        <h2>
          参加者（{snap.seats.length}/{MAX_PLAYERS}人）
        </h2>
        <ul className="seat-list">
          {snap.seats.map((s, i) => (
            <li key={s.userId} style={{ '--pc': PLAYER_COLORS[i] } as CSSProperties}>
              <span className="swatch" aria-hidden="true" />
              <span className="seat-name">{s.name}</span>
              {s.userId === room.host && <span className="tag">ホスト</span>}
              {s.userId === userId && <span className="tag you-tag">あなた</span>}
            </li>
          ))}
          {Array.from({ length: MAX_PLAYERS - snap.seats.length }, (_, i) => (
            <li key={`empty${i}`} className="empty-seat">
              空き
            </li>
          ))}
        </ul>
        <p className="muted">手番の順番はゲーム開始時にランダムで決まります。</p>
      </section>

      <section className="panel">
        {isHost ? (
          <>
            <h2>ゲームを始める</h2>
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
            <button className="primary big" disabled={busy || !enough} onClick={() => void run(() => onStart(board))}>
              {enough
                ? `${snap.seats.length}人でゲーム開始`
                : `あと${MIN_PLAYERS - snap.seats.length}人以上待っています`}
            </button>
          </>
        ) : (
          <p className="waiting-host">⏳ ホストがゲームを始めるのを待っています…</p>
        )}
        {(message ?? error) && <p className="hint">{message ?? error}</p>}
      </section>

      <div className="lobby-footer">
        {confirmLeave ? (
          <div className="quit-confirm">
            <p>{isHost ? '部屋を閉じますか？参加者も全員退出になります。' : 'この部屋から抜けますか？'}</p>
            <div className="sheet-actions">
              <button className="danger" disabled={busy} onClick={() => void run(onLeave)}>
                {isHost ? '部屋を閉じる' : '部屋を抜ける'}
              </button>
              <button onClick={() => setConfirmLeave(false)}>やめる</button>
            </div>
          </div>
        ) : (
          <div className="sheet-actions">
            <button onClick={onExit}>トップに戻る</button>
            <button className="danger" onClick={() => setConfirmLeave(true)}>
              {isHost ? '部屋を閉じる' : '部屋を抜ける'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

/** 部屋コードと招待URL（コピー・共有） */
function InviteBox({ roomId, compact = false }: { roomId: string; compact?: boolean }) {
  const url = roomUrl(roomId)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      inputRef.current?.select()
    }
  }

  return (
    <div className="invite">
      {compact && <h3>招待</h3>}
      <p className="room-code" aria-label="部屋コード">
        {roomId}
      </p>
      {!compact && <p className="muted">このURLを友達に送ってください。開くとこの部屋に参加できます。</p>}
      <div className="invite-url">
        <input
          ref={inputRef}
          id={compact ? 'invite-url-menu' : 'invite-url'}
          className="text-input"
          value={url}
          readOnly
          onFocus={(e) => e.target.select()}
          aria-label="招待URL"
        />
        <button onClick={() => void copy()}>{copied ? 'コピーしました' : 'コピー'}</button>
      </div>
      {canShare && !compact && (
        <button
          className="primary"
          onClick={() =>
            void navigator.share({ title: '開拓ボードゲーム', text: '一緒に遊ぼう！', url }).catch(() => {})
          }
        >
          LINE などで送る
        </button>
      )}
    </div>
  )
}
