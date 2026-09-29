// Node の HTTP リクエストを handleRequest につなぐ（開発・テスト用の模擬サーバーで使う）

import type { IncomingMessage, ServerResponse as NodeResponse } from 'node:http'
import type { Rng } from '../src/logic/index.ts'
import { PLAYER_KEY_HEADER, type ServerResponse } from '../src/online/protocol.ts'
import { authenticateKey } from './auth.ts'
import { handleRequest, type HandlerOptions } from './handler.ts'
import type { GameStore } from './store.ts'

export interface Deps extends HandlerOptions {
  store: GameStore
  rng: Rng
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function send(res: NodeResponse, status: number, body: ServerResponse): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function serveGameRequest(req: IncomingMessage, res: NodeResponse, deps: Deps): Promise<void> {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST で送ってください' })
  const header = req.headers[PLAYER_KEY_HEADER]
  const userId = await authenticateKey(Array.isArray(header) ? header[0] : header)
  if (!userId)
    return send(res, 401, { ok: false, error: 'プレイヤーの情報がありません。ページを再読み込みしてください' })
  let body: unknown
  try {
    body = await readJson(req)
  } catch {
    return send(res, 400, { ok: false, error: 'リクエストの形式が正しくありません' })
  }
  try {
    const result = await handleRequest(deps.store, userId, body, deps.rng, deps)
    send(res, result.ok ? 200 : 400, result)
  } catch (e) {
    console.error(e)
    send(res, 500, { ok: false, error: 'サーバーでエラーが起きました。少し待ってからもう一度お試しください' })
  }
}
