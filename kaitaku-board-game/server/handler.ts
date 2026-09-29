// オンライン対戦のサーバー処理。保存先（GameStore）と乱数を受け取るので、どこで動かしても同じ。
// すべての操作はここで applyAction を通して検証し、各プレイヤーには本人から見た状態だけを保存する。

import {
  applyAction,
  createGame,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  viewFor,
  type Action,
  type BoardType,
  type GameState,
  type Rng,
} from '../src/logic/index.ts'
import {
  isRoomCode,
  normalizeName,
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
  VIEW_LOG_LIMIT,
  type RoomInfo,
  type ServerRequest,
  type ServerResponse,
} from '../src/online/protocol.ts'
import type { GameStore, PlayerViewRecord } from './store.ts'

/** 同時に操作が来て保存が衝突したときのやり直し回数 */
const MAX_RETRIES = 5

const fail = (error: string): ServerResponse => ({ ok: false, error })

function viewsFor(state: GameState, playerIds: string[]): PlayerViewRecord[] {
  return playerIds.map((userId, p) => ({ userId, view: viewFor(state, p, { maxLog: VIEW_LOG_LIMIT }) }))
}

function newRoomCode(rng: Rng): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_CHARS[Math.floor(rng() * ROOM_CODE_CHARS.length)]
  return code
}

function isBoardType(b: unknown): b is BoardType {
  return b === 'random' || b === 'beginner'
}

export interface HandlerOptions {
  /** 部屋の状態が変わったことを参加者に知らせる（本番は Supabase Realtime の Broadcast） */
  notify?: (roomId: string) => Promise<void>
}

/** 成功したら部屋の状態が変わる操作 */
const CHANGES_ROOM = new Set<string>(['join', 'leave', 'start', 'action'])

export async function handleRequest(
  store: GameStore,
  userId: string,
  raw: unknown,
  rng: Rng,
  options: HandlerOptions = {},
): Promise<ServerResponse> {
  if (typeof raw !== 'object' || raw === null) return fail('リクエストの形式が正しくありません')
  const req = raw as ServerRequest
  const result = await dispatch(store, userId, req, rng)
  // 通知の失敗は操作の結果に影響させない（参加者の画面は定期的な読み直しでも追いつく）
  const roomId = (req as { roomId?: unknown }).roomId
  if (result.ok && options.notify && CHANGES_ROOM.has(req.op) && isRoomCode(roomId)) {
    await options.notify(roomId).catch(() => {})
  }
  return result
}

async function dispatch(store: GameStore, userId: string, req: ServerRequest, rng: Rng): Promise<ServerResponse> {
  switch (req.op) {
    case 'create':
      return createRoom(store, userId, req.name, rng)
    case 'peek':
      return peekRoom(store, userId, req.roomId)
    case 'state':
      return roomState(store, userId, req.roomId)
    case 'join':
      return joinRoom(store, userId, req.roomId, req.name)
    case 'leave':
      return leaveRoom(store, userId, req.roomId)
    case 'start':
      return startGame(store, userId, req.roomId, req.board, rng)
    case 'action':
      return playAction(store, userId, req.roomId, req.action, rng)
    default:
      return fail('不明な操作です')
  }
}

async function createRoom(store: GameStore, userId: string, rawName: unknown, rng: Rng): Promise<ServerResponse> {
  const name = normalizeName(rawName)
  if (!name) return fail('名前を入力してください')
  for (let i = 0; i < 10; i++) {
    const room: RoomInfo = { id: newRoomCode(rng), host: userId, status: 'lobby', board: 'random' }
    if (await store.createRoom(room, { userId, seat: 0, name })) return { ok: true, roomId: room.id }
  }
  return fail('部屋を作れませんでした。もう一度お試しください')
}

async function loadRoom(store: GameStore, roomId: unknown) {
  if (!isRoomCode(roomId)) return null
  return store.getRoom(roomId)
}

async function peekRoom(store: GameStore, userId: string, roomId: unknown): Promise<ServerResponse> {
  const room = await loadRoom(store, roomId)
  if (!room) return fail('部屋が見つかりません。部屋コードを確かめてください')
  const seats = await store.listSeats(room.id)
  return {
    ok: true,
    roomId: room.id,
    room: {
      id: room.id,
      status: room.status,
      hostName: seats.find((s) => s.userId === room.host)?.name ?? '',
      playerCount: seats.length,
      isMember: seats.some((s) => s.userId === userId),
    },
  }
}

/** 参加者にだけ、部屋・参加者一覧・本人から見た状態を返す */
async function roomState(store: GameStore, userId: string, roomId: unknown): Promise<ServerResponse> {
  const room = await loadRoom(store, roomId)
  const seats = room ? await store.listSeats(room.id) : []
  if (!room || !seats.some((s) => s.userId === userId)) {
    return { ok: true, snapshot: { room: null, seats: [], view: null } }
  }
  return { ok: true, roomId: room.id, snapshot: { room, seats, view: await store.getView(room.id, userId) } }
}

async function joinRoom(store: GameStore, userId: string, roomId: unknown, rawName: unknown): Promise<ServerResponse> {
  const name = normalizeName(rawName)
  if (!name) return fail('名前を入力してください')
  const room = await loadRoom(store, roomId)
  if (!room) return fail('部屋が見つかりません。部屋コードを確かめてください')
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const seats = await store.listSeats(room.id)
    if (seats.some((s) => s.userId === userId)) return { ok: true, roomId: room.id }
    if (room.status !== 'lobby') return fail('この部屋のゲームはもう始まっています')
    if (seats.length >= MAX_PLAYERS) return fail(`この部屋は満員です（最大${MAX_PLAYERS}人）`)
    const taken = new Set(seats.map((s) => s.seat))
    const seat = [...Array(MAX_PLAYERS).keys()].find((s) => !taken.has(s))!
    if (await store.addSeat(room.id, { userId, seat, name })) {
      await store.updateRoom(room.id, {})
      return { ok: true, roomId: room.id }
    }
  }
  return fail('参加できませんでした。もう一度お試しください')
}

async function leaveRoom(store: GameStore, userId: string, roomId: unknown): Promise<ServerResponse> {
  const room = await loadRoom(store, roomId)
  if (!room) return { ok: true }
  if (room.status !== 'lobby') return fail('ゲーム中は部屋を抜けられません')
  if (room.host === userId) {
    await store.deleteRoom(room.id)
  } else {
    await store.removeSeat(room.id, userId)
    await store.updateRoom(room.id, {})
  }
  return { ok: true }
}

async function startGame(
  store: GameStore,
  userId: string,
  roomId: unknown,
  board: unknown,
  rng: Rng,
): Promise<ServerResponse> {
  const room = await loadRoom(store, roomId)
  if (!room) return fail('部屋が見つかりません')
  if (room.host !== userId) return fail('ゲームを始められるのは部屋を作った人だけです')
  if (room.status !== 'lobby') return fail('ゲームはもう始まっています')
  if (!isBoardType(board)) return fail('盤面の種類が正しくありません')
  const seats = await store.listSeats(room.id)
  if (seats.length < MIN_PLAYERS) return fail(`${MIN_PLAYERS}人以上そろってから始めてください`)

  const state = createGame({ players: seats.map((s, i) => ({ name: s.name, color: PLAYER_COLORS[i] })), board }, rng)
  const playerIds = seats.map((s) => s.userId)
  if (!(await store.saveGame(room.id, null, { state, playerIds }, viewsFor(state, playerIds)))) {
    return fail('ゲームはもう始まっています')
  }
  await store.updateRoom(room.id, { status: 'playing', board })
  return { ok: true, roomId: room.id }
}

async function playAction(
  store: GameStore,
  userId: string,
  roomId: unknown,
  action: unknown,
  rng: Rng,
): Promise<ServerResponse> {
  if (!isRoomCode(roomId)) return fail('部屋が見つかりません')
  if (typeof action !== 'object' || action === null) return fail('不明な操作です')
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const game = await store.loadGame(roomId)
    if (!game) return fail('ゲームが始まっていません')
    const player = game.playerIds.indexOf(userId)
    if (player < 0) return fail('このゲームに参加していません')

    const result = applyAction(game.state, action as Action, player, rng)
    if (result.error) return fail(result.error)
    const saved = await store.saveGame(
      roomId,
      game.version,
      { state: result.state, playerIds: game.playerIds },
      viewsFor(result.state, game.playerIds),
    )
    if (saved) {
      if (result.state.phase.type === 'gameOver') await store.updateRoom(roomId, { status: 'finished' })
      return { ok: true }
    }
    // 読み込んだ後に他の人の操作が保存された：最新の状態でやり直す
  }
  return fail('混み合っています。もう一度お試しください')
}
