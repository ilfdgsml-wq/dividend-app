// Node の HTTP リクエストを handleRequest につなぐ（Vercel の関数と開発用の模擬サーバーで共通）

import type { IncomingMessage, ServerResponse as NodeResponse } from 'node:http'
import type { Rng } from '../src/logic/index.ts'
import type { ServerResponse } from '../src/online/protocol.ts'
import { handleRequest } from './handler.ts'
import type { GameStore } from './store.ts'

export interface Deps {
  store: GameStore
  /** アクセストークンからユーザーIDを求める。無効なら null */
  authenticate: (token: string) => Promise<string | null>
  rng: Rng
}

type Req = IncomingMessage & { body?: unknown }

async function readJson(req: Req): Promise<unknown> {
  // Vercel は JSON の本文を req.body に読み込み済み
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

export function send(res: NodeResponse, status: number, body: ServerResponse): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1] : null
}

export async function serveGameRequest(req: Req, res: NodeResponse, deps: Deps): Promise<void> {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST で送ってください' })
  const token = bearerToken(req)
  const userId = token ? await deps.authenticate(token) : null
  if (!userId)
    return send(res, 401, { ok: false, error: 'ログインの有効期限が切れました。ページを再読み込みしてください' })
  let body: unknown
  try {
    body = await readJson(req)
  } catch {
    return send(res, 400, { ok: false, error: 'リクエストの形式が正しくありません' })
  }
  try {
    const result = await handleRequest(deps.store, userId, body, deps.rng)
    send(res, result.ok ? 200 : 400, result)
  } catch (e) {
    console.error(e)
    send(res, 500, { ok: false, error: 'サーバーでエラーが起きました。少し待ってからもう一度お試しください' })
  }
}
