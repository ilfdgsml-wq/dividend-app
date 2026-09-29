import { describe, expect, it } from 'vitest'
import { counts, legalRoadEdges, legalSettlementVertices, seededRng, type Action } from '../src/logic/index.ts'
import type { ServerRequest } from '../src/online/protocol.ts'
import { handleRequest } from './handler.ts'
import { MemoryStore } from './memoryStore.ts'

const HOST = 'user-host'
const B = 'user-b'
const C = 'user-c'

function setup() {
  const store = new MemoryStore()
  const rng = seededRng(7)
  const call = (user: string, req: ServerRequest | Record<string, unknown>) => handleRequest(store, user, req, rng)
  return { store, call }
}

async function roomWith(users: string[]) {
  const s = setup()
  const created = await s.call(users[0], { op: 'create', name: 'ホスト' })
  if (!created.ok || !created.roomId) throw new Error('部屋を作れない')
  const roomId = created.roomId
  for (const u of users.slice(1)) {
    const r = await s.call(u, { op: 'join', roomId, name: u })
    if (!r.ok) throw new Error(r.error)
  }
  return { ...s, roomId }
}

async function startedGame(users: string[]) {
  const s = await roomWith(users)
  const r = await s.call(users[0], { op: 'start', roomId: s.roomId, board: 'beginner' })
  if (!r.ok) throw new Error(r.error)
  return s
}

describe('部屋を作る・参加する', () => {
  it('部屋を作るとホストが席0に座り、6文字の部屋コードが返る', async () => {
    const { store, call } = setup()
    const r = await call(HOST, { op: 'create', name: '  たろう  ' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.roomId).toMatch(/^[A-Z2-9]{6}$/)
    expect(await store.getRoom(r.roomId!)).toMatchObject({ host: HOST, status: 'lobby' })
    expect(await store.listSeats(r.roomId!)).toEqual([{ userId: HOST, seat: 0, name: 'たろう' }])
  })

  it('名前が空なら作れない', async () => {
    const { call } = setup()
    expect(await call(HOST, { op: 'create', name: '   ' })).toEqual({ ok: false, error: '名前を入力してください' })
  })

  it('参加すると空いている席に座る。同じ人が再度参加しても席は増えない', async () => {
    const { store, call, roomId } = await roomWith([HOST, B])
    expect(await call(B, { op: 'join', roomId, name: 'B' })).toEqual({ ok: true, roomId })
    expect((await store.listSeats(roomId)).map((s) => [s.userId, s.seat])).toEqual([
      [HOST, 0],
      [B, 1],
    ])
  })

  it('小文字や存在しない部屋コードは見つからない', async () => {
    const { call } = await roomWith([HOST])
    const r = await call(B, { op: 'join', roomId: 'zzzzzz', name: 'B' })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('見つかりません') })
  })

  it('4人で満員', async () => {
    const { call, roomId } = await roomWith([HOST, B, C, 'user-d'])
    const r = await call('user-e', { op: 'join', roomId, name: 'E' })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('満員') })
  })

  it('peek で参加前に部屋の概要が分かる', async () => {
    const { call, roomId } = await roomWith([HOST, B])
    expect(await call(C, { op: 'peek', roomId })).toEqual({
      ok: true,
      roomId,
      room: { id: roomId, status: 'lobby', hostName: 'ホスト', playerCount: 2, isMember: false },
    })
    expect(await call(B, { op: 'peek', roomId })).toMatchObject({ room: { isMember: true } })
  })

  it('ホスト以外が抜けると席が空き、ホストが抜けると部屋がなくなる', async () => {
    const { store, call, roomId } = await roomWith([HOST, B, C])
    await call(B, { op: 'leave', roomId })
    expect((await store.listSeats(roomId)).map((s) => s.userId)).toEqual([HOST, C])
    // 空いた席1に次の人が座る
    await call('user-d', { op: 'join', roomId, name: 'D' })
    expect((await store.listSeats(roomId)).map((s) => s.seat)).toEqual([0, 1, 2])
    await call(HOST, { op: 'leave', roomId })
    expect(await store.getRoom(roomId)).toBeNull()
  })
})

describe('ゲーム開始', () => {
  it('ホストだけが、2人以上そろってから始められる', async () => {
    const solo = await roomWith([HOST])
    expect(await solo.call(HOST, { op: 'start', roomId: solo.roomId, board: 'random' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('2人以上'),
    })
    const { call, roomId } = await roomWith([HOST, B])
    expect(await call(B, { op: 'start', roomId, board: 'random' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('部屋を作った人'),
    })
    expect(await call(HOST, { op: 'start', roomId, board: 'weird' })).toMatchObject({ ok: false })
  })

  it('開始すると席順どおりにプレイヤーが並び、各自の見え方が保存される', async () => {
    const { store, roomId } = await startedGame([HOST, B, C])
    const room = await store.getRoom(roomId)
    expect(room).toMatchObject({ status: 'playing', board: 'beginner' })
    const game = (await store.loadGame(roomId))!
    expect(game.playerIds).toEqual([HOST, B, C])
    expect(game.state.players.map((p) => p.name)).toEqual(['ホスト', B, C])
    expect(game.version).toBe(1)
    for (const [p, user] of [HOST, B, C].entries()) {
      const view = store.getView(roomId, user)!
      expect(view.viewer).toBe(p)
      expect('devDeck' in view).toBe(false)
      expect(view.players.filter((x) => x.resources !== null)).toHaveLength(1)
    }
  })

  it('開始後は新しく参加できない（参加済みの人は戻れる）', async () => {
    const { call, roomId } = await startedGame([HOST, B])
    expect(await call(C, { op: 'join', roomId, name: 'C' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('始まっています'),
    })
    expect(await call(B, { op: 'join', roomId, name: 'B' })).toEqual({ ok: true, roomId })
    expect(await call(B, { op: 'leave', roomId })).toMatchObject({ ok: false })
  })
})

describe('ゲーム中の操作', () => {
  async function placeSetup(s: Awaited<ReturnType<typeof startedGame>>) {
    const game = (await s.store.loadGame(s.roomId))!
    const p = game.state.currentPlayer
    const user = game.playerIds[p]
    const vertex = legalSettlementVertices(game.state, p, false)[0]
    const r = await s.call(user, { op: 'action', roomId: s.roomId, action: { type: 'placeSetupSettlement', vertex } })
    return { r, user, p, vertex }
  }

  it('手番の人の操作は検証されて保存され、全員の見え方が更新される', async () => {
    const s = await startedGame([HOST, B])
    const { r, vertex } = await placeSetup(s)
    expect(r).toEqual({ ok: true })
    const game = (await s.store.loadGame(s.roomId))!
    expect(game.version).toBe(2)
    expect(game.state.buildings[vertex]).not.toBeNull()
    for (const user of [HOST, B]) expect(s.store.getView(s.roomId, user)!.buildings[vertex]).not.toBeNull()
  })

  it('不正な操作・手番でない人・参加していない人は弾かれ、保存されない', async () => {
    const s = await startedGame([HOST, B])
    const game = (await s.store.loadGame(s.roomId))!
    const other = game.playerIds[1 - game.state.currentPlayer]
    const action: Action = { type: 'placeSetupSettlement', vertex: 0 }
    expect(await s.call(other, { op: 'action', roomId: s.roomId, action })).toEqual({
      ok: false,
      error: 'あなたの手番ではありません',
    })
    expect(await s.call(C, { op: 'action', roomId: s.roomId, action })).toMatchObject({
      ok: false,
      error: expect.stringContaining('参加していません'),
    })
    const current = game.playerIds[game.state.currentPlayer]
    expect(await s.call(current, { op: 'action', roomId: s.roomId, action: { type: 'rollDice' } })).toMatchObject({
      ok: false,
    })
    expect((await s.store.loadGame(s.roomId))!.version).toBe(1)
  })

  it('他の人の手札は見え方に含まれない（本人の分だけ）', async () => {
    const s = await startedGame([HOST, B])
    const game = (await s.store.loadGame(s.roomId))!
    game.state.players[0].resources = counts({ ore: 3 })
    game.state.players[1].resources = counts({ wheat: 2 })
    // 手札を持たせた状態で保存し直し、1手進める
    await s.store.saveGame(s.roomId, game.version, game, [])
    await placeSetup(s)
    const hostView = s.store.getView(s.roomId, HOST)!
    const bView = s.store.getView(s.roomId, B)!
    expect(hostView.players[0].resources).toEqual(counts({ ore: 3 }))
    expect(hostView.players[1].resources).toBeNull()
    expect(hostView.players[1].resourceCount).toBe(2)
    expect(bView.players[1].resources).toEqual(counts({ wheat: 2 }))
    expect(bView.players[0].resources).toBeNull()
  })

  it('保存が他の操作と衝突したら、最新の状態でやり直す', async () => {
    const s = await startedGame([HOST, B])
    const original = s.store.saveGame.bind(s.store)
    let conflicts = 1
    s.store.saveGame = async (roomId, expected, game, views) => {
      if (expected !== null && conflicts-- > 0) {
        // 読み込み後に別の操作が保存された状況を作る
        const latest = (await s.store.loadGame(roomId))!
        await original(roomId, latest.version, latest, [])
        return original(roomId, expected, game, views)
      }
      return original(roomId, expected, game, views)
    }
    const { r } = await placeSetup(s)
    expect(r).toEqual({ ok: true })
    expect((await s.store.loadGame(s.roomId))!.version).toBe(3)
  })

  it('7の捨て札は、該当する全員がそれぞれ送れる', async () => {
    const s = await startedGame([HOST, B, C])
    const game = (await s.store.loadGame(s.roomId))!
    game.state.phase = { type: 'discard', pending: [0, 4, 4] }
    game.state.players[1].resources = counts({ wood: 8 })
    game.state.players[2].resources = counts({ ore: 9 })
    await s.store.saveGame(s.roomId, game.version, game, [])
    const [r1, r2] = await Promise.all([
      s.call(C, { op: 'action', roomId: s.roomId, action: { type: 'discard', resources: counts({ ore: 4 }) } }),
      s.call(B, { op: 'action', roomId: s.roomId, action: { type: 'discard', resources: counts({ wood: 4 }) } }),
    ])
    expect([r1, r2]).toEqual([{ ok: true }, { ok: true }])
    const after = (await s.store.loadGame(s.roomId))!
    expect(after.state.phase).toEqual({ type: 'moveRobber', resume: 'main' })
    expect(after.state.players[1].resources.wood).toBe(4)
    expect(after.state.players[2].resources.ore).toBe(5)
  })

  it('勝負がついたら部屋は終了になる', async () => {
    const s = await startedGame([HOST, B])
    const game = (await s.store.loadGame(s.roomId))!
    const p = 0
    game.state.phase = { type: 'main' }
    game.state.turn = 3
    game.state.currentPlayer = p
    game.state.players[p].devCards = Array.from({ length: 9 }, () => ({ type: 'victoryPoint' as const, boughtTurn: 0 }))
    game.state.players[p].resources = counts({ ore: 1, sheep: 1, wheat: 1 })
    game.state.devDeck = ['victoryPoint']
    await s.store.saveGame(s.roomId, game.version, game, [])
    expect(await s.call(game.playerIds[p], { op: 'action', roomId: s.roomId, action: { type: 'buyDevCard' } })).toEqual(
      {
        ok: true,
      },
    )
    expect((await s.store.getRoom(s.roomId))!.status).toBe('finished')
    // 終了後は全員に全員の手札が公開される
    expect(s.store.getView(s.roomId, B)!.players[0].devCards).toHaveLength(10)
  })

  it('初期配置の道まで通しで進められる', async () => {
    const s = await startedGame([HOST, B])
    const { user, p, vertex } = await placeSetup(s)
    const game = (await s.store.loadGame(s.roomId))!
    const edge = legalRoadEdges(game.state, p, vertex)[0]
    expect(await s.call(user, { op: 'action', roomId: s.roomId, action: { type: 'placeSetupRoad', edge } })).toEqual({
      ok: true,
    })
  })
})
