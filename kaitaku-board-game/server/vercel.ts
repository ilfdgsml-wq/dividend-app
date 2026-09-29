// Vercel の関数（/api/game）の入口。npm run build:api で api/game.js に1ファイルへまとめる。
// 必要な環境変数：SUPABASE_URL（または VITE_SUPABASE_URL）、SUPABASE_SECRET_KEY（または SUPABASE_SERVICE_ROLE_KEY）

import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { send, serveGameRequest } from './http.ts'
import { cryptoRng } from './rng.ts'
import { supabaseStore } from './supabaseStore.ts'

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return send(res, 500, {
      ok: false,
      error: 'サーバーの設定が足りません（Vercel の環境変数 VITE_SUPABASE_URL と SUPABASE_SECRET_KEY）',
    })
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  await serveGameRequest(req, res, {
    store: supabaseStore(db),
    rng: cryptoRng,
    authenticate: async (token) => {
      const { data, error } = await db.auth.getUser(token)
      return error || !data.user ? null : data.user.id
    },
  })
}
