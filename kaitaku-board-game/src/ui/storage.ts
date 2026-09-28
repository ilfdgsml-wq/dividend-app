// localStorage への自動保存。使えない環境（プライベートモード等）でも落ちないようにする

import type { GameState } from '../logic/index.ts'

const KEY = 'kaitaku-board-game/v1'

export interface Settings {
  /** 手番交代時などに「端末を渡してください」画面をはさむ */
  privacy: boolean
}

export interface SavedGame {
  state: GameState
  settings: Settings
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedGame
    return saved?.state?.players ? saved : null
  } catch {
    return null
  }
}

export function saveGame(saved: SavedGame): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // 保存できなくても遊べるようにする
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 何もしない
  }
}
