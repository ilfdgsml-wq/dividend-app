// Supabase への保存（本番用）。Secret key で接続するので RLS を通らない。テーブルは supabase/schema.sql を参照。

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoardType, GameState } from '../src/logic/index.ts'
import type { RoomInfo, RoomStatus, SeatInfo } from '../src/online/protocol.ts'
import type { GameStore } from './store.ts'

/** 一意制約違反（同じ部屋コード・同じ席） */
const UNIQUE_VIOLATION = '23505'

function check(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`)
}

export function supabaseStore(db: SupabaseClient): GameStore {
  return {
    async getRoom(roomId) {
      const { data, error } = await db.from('rooms').select('id, host, status, board').eq('id', roomId).maybeSingle()
      check(error, 'getRoom')
      return data
        ? { id: data.id, host: data.host, status: data.status as RoomStatus, board: data.board as BoardType }
        : null
    },

    async createRoom(room: RoomInfo, host: SeatInfo) {
      const { error } = await db
        .from('rooms')
        .insert({ id: room.id, host: room.host, status: room.status, board: room.board })
      if (error?.code === UNIQUE_VIOLATION) return false
      check(error, 'createRoom')
      const seat = await db
        .from('room_players')
        .insert({ room_id: room.id, user_id: host.userId, seat: 0, name: host.name })
      if (seat.error) {
        await db.from('rooms').delete().eq('id', room.id)
        check(seat.error, 'createRoom(seat)')
      }
      return true
    },

    async updateRoom(roomId, patch) {
      // 空の patch でも更新時刻が変わり、参加者の画面に変更が届く
      const { error } = await db
        .from('rooms')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', roomId)
      check(error, 'updateRoom')
    },

    async deleteRoom(roomId) {
      const { error } = await db.from('rooms').delete().eq('id', roomId)
      check(error, 'deleteRoom')
    },

    async listSeats(roomId) {
      const { data, error } = await db
        .from('room_players')
        .select('user_id, seat, name')
        .eq('room_id', roomId)
        .order('seat')
      check(error, 'listSeats')
      return (data ?? []).map((r) => ({ userId: r.user_id, seat: r.seat, name: r.name }))
    },

    async addSeat(roomId, seat) {
      const { error } = await db
        .from('room_players')
        .insert({ room_id: roomId, user_id: seat.userId, seat: seat.seat, name: seat.name })
      if (error?.code === UNIQUE_VIOLATION) return false
      check(error, 'addSeat')
      return true
    },

    async removeSeat(roomId, userId) {
      const { error } = await db.from('room_players').delete().eq('room_id', roomId).eq('user_id', userId)
      check(error, 'removeSeat')
    },

    async loadGame(roomId) {
      const { data, error } = await db
        .from('game_states')
        .select('state, version, player_ids')
        .eq('room_id', roomId)
        .maybeSingle()
      check(error, 'loadGame')
      return data ? { state: data.state as GameState, version: data.version, playerIds: data.player_ids } : null
    },

    async saveGame(roomId, expectedVersion, game, views) {
      const { data, error } = await db.rpc('save_game', {
        p_room: roomId,
        p_expected: expectedVersion,
        p_state: game.state,
        p_player_ids: game.playerIds,
        p_views: views,
      })
      check(error, 'saveGame')
      return data === true
    },
  }
}
