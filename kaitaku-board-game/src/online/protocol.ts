// オンライン対戦の通信の形（ブラウザとサーバーの両方で使う）

import type { Action, BoardType } from '../logic/index.ts'

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export interface RoomInfo {
  id: string
  host: string
  status: RoomStatus
  board: BoardType
}

export interface SeatInfo {
  userId: string
  seat: number
  name: string
}

/** 参加前に見せる部屋の概要 */
export interface RoomSummary {
  id: string
  status: RoomStatus
  hostName: string
  playerCount: number
  isMember: boolean
}

export type ServerRequest =
  | { op: 'create'; name: string }
  | { op: 'peek'; roomId: string }
  | { op: 'join'; roomId: string; name: string }
  | { op: 'leave'; roomId: string }
  | { op: 'start'; roomId: string; board: BoardType }
  | { op: 'action'; roomId: string; action: Action }

export type ServerResponse = { ok: true; roomId?: string; room?: RoomSummary } | { ok: false; error: string }

export const MAX_NAME_LENGTH = 12
export const ROOM_CODE_LENGTH = 6
/** 読み間違えやすい文字（0/O, 1/I）を除いた部屋コードの文字 */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** 各プレイヤーに配るログの件数 */
export const VIEW_LOG_LIMIT = 60

/** 入力された部屋コードを正規化（小文字・空白・ハイフンを許す） */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
}

export function isRoomCode(s: unknown): s is string {
  return typeof s === 'string' && s.length === ROOM_CODE_LENGTH && [...s].every((c) => ROOM_CODE_CHARS.includes(c))
}

export function normalizeName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const name = input.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
  return name.length > 0 ? name : null
}
