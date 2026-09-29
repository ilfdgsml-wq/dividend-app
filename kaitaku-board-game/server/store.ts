// サーバーのデータ保存の窓口。本番は Supabase、テストと開発用の模擬サーバーはメモリ上に保存する。

import type { GameState, PlayerView } from '../src/logic/index.ts'
import type { RoomInfo, SeatInfo } from '../src/online/protocol.ts'

export interface GameRecord {
  state: GameState
  /** 保存するたびに1増える（同時に操作が来たときの衝突検出用） */
  version: number
  /** PlayerId（手番順）→ ユーザーID */
  playerIds: string[]
}

export interface PlayerViewRecord {
  userId: string
  view: PlayerView
}

export interface GameStore {
  getRoom(roomId: string): Promise<RoomInfo | null>
  /** 部屋を作ってホストを席0に座らせる。コードが使用済みなら false */
  createRoom(room: RoomInfo, host: SeatInfo): Promise<boolean>
  updateRoom(roomId: string, patch: Partial<Pick<RoomInfo, 'status' | 'board'>>): Promise<void>
  deleteRoom(roomId: string): Promise<void>
  listSeats(roomId: string): Promise<SeatInfo[]>
  /** 席に座る。その席かユーザーがすでに埋まっていれば false */
  addSeat(roomId: string, seat: SeatInfo): Promise<boolean>
  removeSeat(roomId: string, userId: string): Promise<void>
  loadGame(roomId: string): Promise<GameRecord | null>
  /** そのユーザーから見た状態（ゲーム開始前・参加していなければ null） */
  getView(roomId: string, userId: string): Promise<PlayerView | null>
  /**
   * 状態と各プレイヤーの見え方を保存する。
   * expectedVersion = null は新規作成。読み込んだ後に他の操作で更新されていたら false（呼び出し側でやり直す）
   */
  saveGame(
    roomId: string,
    expectedVersion: number | null,
    game: Omit<GameRecord, 'version'>,
    views: PlayerViewRecord[],
  ): Promise<boolean>
}
