// 開発・テスト用：vite --mode mock のとき、開発サーバーの中でオンライン対戦のサーバーを動かす（保存はメモリ上）。
// 本番（Vercel）では使われない。

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { bearerToken, serveGameRequest, type Deps } from './http.ts'
import { MemoryStore } from './memoryStore.ts'

export function mockOnlinePlugin(): Plugin {
  const store = new MemoryStore()
  const deps: Deps = {
    store,
    rng: Math.random,
    authenticate: async (token) => (token.startsWith('mock:') ? token.slice(5) : null),
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/game') return serveGameRequest(req, res, deps)
    if (url.pathname === '/api/mock-room') {
      const token = bearerToken(req)
      const userId = token ? await deps.authenticate(token) : null
      const roomId = url.searchParams.get('room') ?? ''
      const seats = await store.listSeats(roomId)
      const member = !!userId && seats.some((s) => s.userId === userId)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          revision: store.revision,
          room: member ? await store.getRoom(roomId) : null,
          seats: member ? seats : [],
          view: member && userId ? store.getView(roomId, userId) : null,
        }),
      )
      return
    }
    next()
  }

  return {
    name: 'kaitaku-mock-online',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void middleware(req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void middleware(req, res, next))
    },
  }
}
