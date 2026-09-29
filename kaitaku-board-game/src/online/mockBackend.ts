// 開発・テスト用の模擬オンライン接続（vite --mode mock で起動したときだけ使う）。
// サーバーは vite の開発サーバー内のメモリ上で動き、状態は短い間隔で読み直す。

import { postGame } from './api.ts'
import { pollingWatch, type OnlineBackend } from './backend.ts'
import { userIdFromKey } from './identity.ts'
import { loadPlayerKey } from './playerKey.ts'

const POLL_MS = 400

export function mockBackend(): OnlineBackend {
  const key = loadPlayerKey()
  const request: OnlineBackend['request'] = (req) => postGame('/api/game', req, key)
  return {
    signIn: () => userIdFromKey(key),
    request,
    watch: (roomId, onChange, onError) => pollingWatch(request, roomId, onChange, onError, POLL_MS),
  }
}
