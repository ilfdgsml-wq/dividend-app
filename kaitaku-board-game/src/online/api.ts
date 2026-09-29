import type { ServerRequest, ServerResponse } from './protocol.ts'

/** サーバー（/api/game）に操作を送る */
export async function postGame(req: ServerRequest, token: string): Promise<ServerResponse> {
  try {
    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
    })
    const body = (await res.json().catch(() => null)) as ServerResponse | null
    return body ?? { ok: false, error: `サーバーに接続できませんでした（${res.status}）` }
  } catch {
    return { ok: false, error: '通信できませんでした。電波の良いところでもう一度お試しください' }
  }
}
