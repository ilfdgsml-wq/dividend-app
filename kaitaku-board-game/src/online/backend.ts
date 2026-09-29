// ブラウザ側のオンライン接続の窓口。本番は Supabase（Edge Function + Realtime）、
// 開発・テスト用に模擬サーバー（vite --mode mock）も使える。

import { mockBackend } from './mockBackend.ts'
import type { RoomSnapshot, ServerRequest, ServerResponse } from './protocol.ts'
import { supabaseBackend } from './supabaseBackend.ts'

export type { RoomSnapshot }

export interface RoomWatch {
  stop: () => void
  /** すぐに最新の状態を読み直す（自分の操作の直後など） */
  refresh: () => void
}

export interface OnlineBackend {
  /** このブラウザのユーザーID（同じブラウザなら毎回同じ＝同じ席に戻れる） */
  signIn(): Promise<string>
  request(req: ServerRequest): Promise<ServerResponse>
  /** 部屋を見守る。最初の1回と、変化があるたびに onChange が呼ばれる */
  watch(roomId: string, onChange: (snap: RoomSnapshot) => void, onError: (message: string) => void): RoomWatch
}

let cached: OnlineBackend | null | undefined

/** 設定がなければ null（オンライン対戦は使えない） */
export function getBackend(): OnlineBackend | null {
  if (cached !== undefined) return cached
  const env = import.meta.env
  const url = env.VITE_SUPABASE_URL as string | undefined
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY) as string | undefined
  if (env.MODE === 'mock') cached = mockBackend()
  else if (url && key) cached = supabaseBackend(url, key)
  else cached = null
  return cached
}

/** 'state' を読み直して onChange に渡す見守り（Supabase と模擬サーバーで共通） */
export function pollingWatch(
  request: (req: ServerRequest) => Promise<ServerResponse>,
  roomId: string,
  onChange: (snap: RoomSnapshot) => void,
  onError: (message: string) => void,
  intervalMs: number,
): RoomWatch & { alive: () => boolean } {
  let alive = true
  let seq = 0
  let last = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const load = async (force: boolean) => {
    const mine = ++seq
    const res = await request({ op: 'state', roomId })
    if (!alive || mine !== seq) return
    if (!res.ok) return onError(res.error)
    if (!res.snapshot) return
    const text = JSON.stringify(res.snapshot)
    if (!force && text === last) return
    last = text
    onChange(res.snapshot)
  }
  // 1回の操作で通知が重なっても、まとめて1回だけ読み直す
  const refresh = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void load(true), 60)
  }
  const poll = setInterval(() => void load(false), intervalMs)
  void load(true)
  return {
    refresh,
    alive: () => alive,
    stop() {
      alive = false
      clearTimeout(timer)
      clearInterval(poll)
    },
  }
}
