// 開発・テスト用の模擬オンライン接続（vite --mode mock で起動したときだけ使う）。
// サーバーは vite の開発サーバー内のメモリ上で動き、状態は短い間隔で読み直す。

import type { PlayerView } from '../logic/index.ts'
import { postGame } from './api.ts'
import type { OnlineBackend } from './backend.ts'
import type { RoomInfo, SeatInfo } from './protocol.ts'

const POLL_MS = 400
const USER_KEY = 'kaitaku-board-game/mock-user'

function mockUserId(): string {
  try {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) return saved
    const id = crypto.randomUUID()
    localStorage.setItem(USER_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

interface MockRoomResponse {
  revision: number
  room: RoomInfo | null
  seats: SeatInfo[]
  view: PlayerView | null
}

export function mockBackend(): OnlineBackend {
  const userId = mockUserId()
  const token = `mock:${userId}`
  return {
    async signIn() {
      return userId
    },
    request: (req) => postGame(req, token),
    watch(roomId, onChange, onError) {
      let alive = true
      let revision = -1
      const load = async (force = false) => {
        try {
          const res = await fetch(`/api/mock-room?room=${encodeURIComponent(roomId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const body = (await res.json()) as MockRoomResponse
          if (!alive || (!force && body.revision === revision)) return
          revision = body.revision
          onChange({ room: body.room, seats: body.seats, view: body.view })
        } catch {
          if (alive) onError('模擬サーバーに接続できません')
        }
      }
      const timer = setInterval(() => void load(), POLL_MS)
      void load(true)
      return {
        refresh: () => void load(true),
        stop() {
          alive = false
          clearInterval(timer)
        },
      }
    },
  }
}
