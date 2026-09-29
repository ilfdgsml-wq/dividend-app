import { PLAYER_KEY_HEADER, type ServerRequest, type ServerResponse } from './protocol.ts'

/** サーバーに操作を送る。サーバーは失敗しても { ok: false, error } を JSON で返す */
export async function postGame(
  endpoint: string,
  req: ServerRequest,
  playerKey: string,
  headers: Record<string, string> = {},
): Promise<ServerResponse> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [PLAYER_KEY_HEADER]: playerKey, ...headers },
      body: JSON.stringify(req),
    })
    const body = (await res.json().catch(() => null)) as ServerResponse | null
    return body ?? { ok: false, error: `サーバーに接続できませんでした（${res.status}）` }
  } catch {
    return { ok: false, error: '通信できませんでした。電波の良いところでもう一度お試しください' }
  }
}
