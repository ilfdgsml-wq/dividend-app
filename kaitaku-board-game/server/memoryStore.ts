// メモリ上の保存（テストと開発用の模擬サーバー用）

import type { PlayerView } from '../src/logic/index.ts'
import type { RoomInfo, SeatInfo } from '../src/online/protocol.ts'
import type { GameRecord, GameStore } from './store.ts'

export class MemoryStore implements GameStore {
  rooms = new Map<string, RoomInfo>()
  seats = new Map<string, SeatInfo[]>()
  games = new Map<string, GameRecord>()
  /** `${roomId}:${userId}` → view */
  views = new Map<string, PlayerView>()
  /** 変更のたびに増える（模擬サーバーの変更検知用） */
  revision = 0

  private touch() {
    this.revision++
  }

  async getRoom(roomId: string) {
    const room = this.rooms.get(roomId)
    return room ? { ...room } : null
  }

  async createRoom(room: RoomInfo, host: SeatInfo) {
    if (this.rooms.has(room.id)) return false
    this.rooms.set(room.id, { ...room })
    this.seats.set(room.id, [{ ...host }])
    this.touch()
    return true
  }

  async updateRoom(roomId: string, patch: Partial<Pick<RoomInfo, 'status' | 'board'>>) {
    const room = this.rooms.get(roomId)
    if (room) this.rooms.set(roomId, { ...room, ...patch })
    this.touch()
  }

  async deleteRoom(roomId: string) {
    this.rooms.delete(roomId)
    this.seats.delete(roomId)
    this.games.delete(roomId)
    for (const key of [...this.views.keys()]) if (key.startsWith(`${roomId}:`)) this.views.delete(key)
    this.touch()
  }

  async listSeats(roomId: string) {
    return (this.seats.get(roomId) ?? []).map((s) => ({ ...s })).sort((a, b) => a.seat - b.seat)
  }

  async addSeat(roomId: string, seat: SeatInfo) {
    const list = this.seats.get(roomId)
    if (!list || list.some((s) => s.seat === seat.seat || s.userId === seat.userId)) return false
    list.push({ ...seat })
    this.touch()
    return true
  }

  async removeSeat(roomId: string, userId: string) {
    const list = this.seats.get(roomId)
    if (list)
      this.seats.set(
        roomId,
        list.filter((s) => s.userId !== userId),
      )
    this.touch()
  }

  async loadGame(roomId: string) {
    const game = this.games.get(roomId)
    return game ? structuredClone(game) : null
  }

  async saveGame(
    roomId: string,
    expectedVersion: number | null,
    game: Omit<GameRecord, 'version'>,
    views: { userId: string; view: PlayerView }[],
  ) {
    const existing = this.games.get(roomId)
    if (expectedVersion === null ? existing : existing?.version !== expectedVersion) return false
    const version = (existing?.version ?? 0) + 1
    this.games.set(roomId, structuredClone({ ...game, version }))
    for (const { userId, view } of views) this.views.set(`${roomId}:${userId}`, structuredClone(view))
    this.touch()
    return true
  }

  async getView(roomId: string, userId: string): Promise<PlayerView | null> {
    const view = this.views.get(`${roomId}:${userId}`)
    return view ? structuredClone(view) : null
  }
}
