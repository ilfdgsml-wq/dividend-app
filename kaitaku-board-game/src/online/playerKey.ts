// このブラウザのプレイヤーキー（localStorage に保存。使えなければこのページを開いている間だけ有効）

import { isPlayerKey, newPlayerKey } from './identity.ts'

const STORAGE_KEY = 'kaitaku-board-game/player-key'
let memoryKey: string | null = null

export function loadPlayerKey(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isPlayerKey(saved)) return saved
    const key = newPlayerKey()
    localStorage.setItem(STORAGE_KEY, key)
    return key
  } catch {
    memoryKey ??= newPlayerKey()
    return memoryKey
  }
}
