// Supabase を使うオンライン接続。読み取りは RLS 付きで直接、書き込みはすべて /api/game 経由。

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoardType, PlayerView } from '../logic/index.ts'
import { postGame } from './api.ts'
import type { OnlineBackend, RoomSnapshot } from './backend.ts'
import type { RoomStatus } from './protocol.ts'

/** リアルタイム通知が途切れても追いつけるよう、念のため定期的に読み直す間隔 */
const SAFETY_POLL_MS = 15_000

export function supabaseBackend(url: string, key: string): OnlineBackend {
  // ライブラリはオンライン対戦を使うときだけ読み込む（ホットシートだけの人の読み込みを軽くする）
  let clientPromise: Promise<SupabaseClient> | null = null
  const getClient = () =>
    (clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kaitaku-board-game-auth' },
      }),
    ))

  const accessToken = async () => {
    const { data } = await (await getClient()).auth.getSession()
    return data.session?.access_token ?? null
  }

  return {
    async signIn() {
      const client = await getClient()
      const { data } = await client.auth.getSession()
      if (data.session) return data.session.user.id
      const result = await client.auth.signInAnonymously()
      if (result.error || !result.data.user) {
        throw new Error(
          result.error?.message.includes('Anonymous')
            ? 'Supabase で匿名ログイン（Allow anonymous sign-ins）が有効になっていません'
            : `ログインできませんでした：${result.error?.message ?? '不明なエラー'}`,
        )
      }
      return result.data.user.id
    },

    async request(req) {
      const token = await accessToken()
      if (!token) return { ok: false, error: 'ログインしていません。ページを再読み込みしてください' }
      return postGame(req, token)
    },

    watch(roomId, onChange, onError) {
      let alive = true
      let seq = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      let stopChannel = () => {}

      const load = async () => {
        const client = await getClient()
        const mine = ++seq
        const [room, seats, view] = await Promise.all([
          client.from('rooms').select('id, host, status, board').eq('id', roomId).maybeSingle(),
          client.from('room_players').select('user_id, seat, name').eq('room_id', roomId).order('seat'),
          // RLS により自分の行だけが返る
          client.from('player_views').select('view').eq('room_id', roomId).maybeSingle(),
        ])
        if (!alive || mine !== seq) return
        const error = room.error ?? seats.error ?? view.error
        if (error) return onError(`読み込みに失敗しました：${error.message}`)
        const snap: RoomSnapshot = {
          room: room.data
            ? {
                id: room.data.id,
                host: room.data.host,
                status: room.data.status as RoomStatus,
                board: room.data.board as BoardType,
              }
            : null,
          seats: (seats.data ?? []).map((s) => ({ userId: s.user_id, seat: s.seat, name: s.name })),
          view: (view.data?.view as PlayerView | undefined) ?? null,
        }
        onChange(snap)
      }
      // 1回の操作で複数の通知が来るので、まとめて1回だけ読み直す
      const refresh = () => {
        clearTimeout(timer)
        timer = setTimeout(() => void load(), 60)
      }

      const subscribe = async () => {
        const client = await getClient()
        if (!alive) return
        const channel = client
          .channel(`room:${roomId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refresh)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
            refresh,
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'player_views', filter: `room_id=eq.${roomId}` },
            refresh,
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') refresh()
          })
        stopChannel = () => void client.removeChannel(channel)
      }
      void subscribe()

      const onVisible = () => {
        if (document.visibilityState === 'visible') refresh()
      }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('online', refresh)
      const poll = setInterval(refresh, SAFETY_POLL_MS)
      void load()

      return {
        refresh,
        stop() {
          alive = false
          clearTimeout(timer)
          clearInterval(poll)
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('online', refresh)
          stopChannel()
        },
      }
    },
  }
}
