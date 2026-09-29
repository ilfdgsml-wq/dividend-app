// ブラウザ側のオンライン接続の窓口。本番は Supabase、開発・テスト用に模擬サーバー（vite --mode mock）も使える。

import type { PlayerView } from '../logic/index.ts'
import { mockBackend } from './mockBackend.ts'
import type { RoomInfo, SeatInfo, ServerRequest, ServerResponse } from './protocol.ts'
import { supabaseBackend } from './supabaseBackend.ts'

export interface RoomSnapshot {
  /** 参加していない・部屋がない場合は null */
  room: RoomInfo | null
  seats: SeatInfo[]
  /** ゲーム開始後の、自分から見た状態 */
  view: PlayerView | null
}

export interface RoomWatch {
  stop: () => void
  /** すぐに最新の状態を読み直す（自分の操作の直後など） */
  refresh: () => void
}

export interface OnlineBackend {
  /** 匿名でログインしてユーザーIDを返す（同じブラウザなら毎回同じID＝同じ席に戻れる） */
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
