// 開発・テスト用：vite --mode mock のとき、開発サーバーの中でオンライン対戦のサーバーを動かす（保存はメモリ上）。
// 本番（Supabase Edge Function）と同じ handleRequest を使う。変更の通知はなく、ブラウザが短い間隔で読み直す。

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { serveGameRequest, type Deps } from './http.ts'
import { MemoryStore } from './memoryStore.ts'

export function mockOnlinePlugin(): Plugin {
  const deps: Deps = { store: new MemoryStore(), rng: Math.random }

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname === '/api/game') void serveGameRequest(req, res, deps)
    else next()
  }

  return {
    name: 'kaitaku-mock-online',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
