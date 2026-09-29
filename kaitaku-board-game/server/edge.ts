// Supabase Edge Function「game」の入口（Deno で動く）。
// npm run build:edge で、ゲームロジックとサーバー処理を supabase/functions/game/index.ts の1ファイルにまとめる。
// Supabase が関数に渡す環境変数（SUPABASE_URL とサーバー用の鍵）だけを使うので、自分で設定する値はない。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PLAYER_KEY_HEADER, type ServerResponse } from '../src/online/protocol.ts'
import { authenticateKey } from './auth.ts'
import { handleRequest } from './handler.ts'
import { cryptoRng } from './rng.ts'
import { supabaseStore } from './supabaseStore.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): unknown
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': `authorization, apikey, content-type, x-client-info, ${PLAYER_KEY_HEADER}`,
  'Access-Control-Max-Age': '86400',
}

function json(body: ServerResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** サーバー用の鍵：従来の service_role キー、なければ新しい Secret key */
function serverKey(): string | undefined {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!keys) return undefined
  try {
    const parsed = JSON.parse(keys) as Record<string, string>
    return parsed.default ?? Object.values(parsed)[0]
  } catch {
    return undefined
  }
}

const url = Deno.env.get('SUPABASE_URL')
const key = serverKey()
const db: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null

/** 部屋のチャンネルに「変わった」とだけ知らせる（中身は送らない。受け取った人はサーバーに読みに来る） */
async function notify(roomId: string): Promise<void> {
  if (!db) return
  const channel = db.channel(`room:${roomId}`)
  try {
    await channel.httpSend('changed', {})
  } finally {
    await db.removeChannel(channel)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST で送ってください' }, 405)
  if (!db) return json({ ok: false, error: 'サーバーの設定が足りません（SUPABASE_URL / サーバー用の鍵）' }, 500)

  const userId = await authenticateKey(req.headers.get(PLAYER_KEY_HEADER))
  if (!userId) return json({ ok: false, error: 'プレイヤーの情報がありません。ページを再読み込みしてください' }, 401)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'リクエストの形式が正しくありません' }, 400)
  }
  try {
    const result = await handleRequest(supabaseStore(db), userId, body, cryptoRng, { notify })
    return json(result, result.ok ? 200 : 400)
  } catch (e) {
    console.error(e)
    return json({ ok: false, error: 'サーバーでエラーが起きました。少し待ってからもう一度お試しください' }, 500)
  }
})
