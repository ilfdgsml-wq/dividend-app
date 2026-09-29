import { isPlayerKey, userIdFromKey } from '../src/online/identity.ts'

/** プレイヤーキー → ユーザーID。キーの形が正しくなければ null */
export async function authenticateKey(key: string | null | undefined): Promise<string | null> {
  return isPlayerKey(key) ? userIdFromKey(key) : null
}
