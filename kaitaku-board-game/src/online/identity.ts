// プレイヤーの識別。ブラウザごとに作るランダムなキー（秘密）を送り、サーバーはその SHA-256 をユーザーIDとして使う。
// ログインは不要で、同じブラウザなら同じ席に戻れる。キーそのものはどこにも保存しない（ブラウザの中だけ）。

/** キーの形：64文字の16進数（256ビットの乱数） */
export function isPlayerKey(key: unknown): key is string {
  return typeof key === 'string' && /^[0-9a-f]{64}$/.test(key)
}

/** キー → ユーザーID（SHA-256 の16進数）。ブラウザ・Node・Deno のどこでも動く */
export async function userIdFromKey(key: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function newPlayerKey(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
