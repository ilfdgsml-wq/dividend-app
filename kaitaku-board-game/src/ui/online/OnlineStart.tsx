import { useState } from 'react'
import { getBackend } from '../../online/backend.ts'
import { MAX_NAME_LENGTH, normalizeName, normalizeRoomCode, ROOM_CODE_LENGTH } from '../../online/protocol.ts'
import { loadLastRoom, loadName, saveName } from './prefs.ts'

/** スタート画面の「オンラインで遊ぶ」 */
export function OnlineStart({ onEnterRoom }: { onEnterRoom: (roomId: string) => void }) {
  const backend = getBackend()
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastRoom = loadLastRoom()

  if (!backend) {
    return (
      <section className="panel">
        <h2>友達とオンラインで遊ぶ</h2>
        <p className="muted">
          オンライン対戦の接続先（Supabase）がまだ設定されていません。設定が済むと、ここから部屋を作れるようになります。
        </p>
      </section>
    )
  }

  const create = async () => {
    const n = normalizeName(name)
    if (!n) return setError('名前を入力してください')
    setBusy(true)
    setError(null)
    try {
      saveName(n)
      await backend.signIn()
      const res = await backend.request({ op: 'create', name: n })
      if (!res.ok || !res.roomId) return setError(res.ok ? '部屋を作れませんでした' : res.error)
      onEnterRoom(res.roomId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const join = () => {
    const c = normalizeRoomCode(code)
    if (c.length !== ROOM_CODE_LENGTH) return setError(`部屋コードは${ROOM_CODE_LENGTH}文字です`)
    if (normalizeName(name)) saveName(name.trim())
    onEnterRoom(c)
  }

  return (
    <section className="panel online-start">
      <h2>友達とオンラインで遊ぶ</h2>
      <p className="muted">部屋を作ってURLを送ると、それぞれのスマホから参加できます（2〜4人）。</p>
      <label className="field">
        <span className="field-label">あなたの名前</span>
        <input
          id="online-name"
          className="text-input"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="例：たろう"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button className="primary big" disabled={busy} onClick={() => void create()}>
        部屋を作る
      </button>
      <div className="join-row">
        <input
          id="room-code"
          className="text-input code-input"
          value={code}
          placeholder="部屋コード"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="部屋コード"
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
        />
        <button disabled={busy || code.length === 0} onClick={join}>
          コードで参加
        </button>
      </div>
      {lastRoom && (
        <button className="link" onClick={() => onEnterRoom(lastRoom)}>
          前回の部屋（{lastRoom}）に戻る
        </button>
      )}
      {error && <p className="hint">{error}</p>}
    </section>
  )
}
