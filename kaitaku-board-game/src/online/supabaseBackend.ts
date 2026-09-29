// Supabase を使うオンライン接続。操作も読み込みもすべて Edge Function「game」経由で、
// Realtime の Broadcast（room:部屋コード）で「変わった」と知らされたら読み直す。

import type { SupabaseClient } from '@supabase/supabase-js'
import { postGame } from './api.ts'
import { pollingWatch, type OnlineBackend } from './backend.ts'
import { userIdFromKey } from './identity.ts'
import { loadPlayerKey } from './playerKey.ts'

/** 通知が途切れても追いつけるよう、念のため定期的に読み直す間隔 */
const SAFETY_POLL_MS = 10_000

export function supabaseBackend(url: string, publishableKey: string): OnlineBackend {
  const key = loadPlayerKey()
  const endpoint = `${url.replace(/\/$/, '')}/functions/v1/game`
  const request: OnlineBackend['request'] = (req) => postGame(endpoint, req, key, { apikey: publishableKey })

  // Realtime のライブラリはオンライン対戦を使うときだけ読み込む（ホットシートだけの人の読み込みを軽くする）
  let clientPromise: Promise<SupabaseClient> | null = null
  const getClient = () =>
    (clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    ))

  return {
    signIn: () => userIdFromKey(key),
    request,
    watch(roomId, onChange, onError) {
      const watch = pollingWatch(request, roomId, onChange, onError, SAFETY_POLL_MS)
      let stopChannel = () => {}

      void getClient().then((client) => {
        if (!watch.alive()) return
        const channel = client
          .channel(`room:${roomId}`)
          .on('broadcast', { event: 'changed' }, watch.refresh)
          .subscribe((status) => {
            // つながり直したときは、その間の変化を取りこぼさないよう読み直す
            if (status === 'SUBSCRIBED') watch.refresh()
          })
        stopChannel = () => void client.removeChannel(channel)
      })

      const onVisible = () => {
        if (document.visibilityState === 'visible') watch.refresh()
      }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('online', watch.refresh)

      return {
        refresh: watch.refresh,
        stop() {
          watch.stop()
          stopChannel()
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('online', watch.refresh)
        },
      }
    },
  }
}
