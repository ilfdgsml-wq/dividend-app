// 勝利判定・公開情報・純粋性・通しプレイ

import { describe, expect, it } from 'vitest'
import { applyAction } from './applyAction.ts'
import { TOPOLOGY } from './board/topology.ts'
import { COSTS } from './constants.ts'
import { devCardError } from './actions/devCards.ts'
import { counts, hasAtLeast, total } from './resources.ts'
import { seededRng } from './rng.ts'
import { legalCityVertices, legalRoadEdges, legalSettlementVertices } from './rules/placement.ts'
import { tradeRates } from './rules/ports.ts'
import { victoryPoints } from './rules/victory.ts'
import { act, actError, coastalPath, mainPhase, newGame, put, putRoads, setHand, spreadVertices } from './testing.ts'
import { RESOURCES, type Action, type GameState, type ResourceCounts, type Rng } from './types.ts'
import { viewFor, viewToState } from './view.ts'

describe('勝利条件', () => {
  it('自分の手番中に10点以上になった時点で勝利し、以後の操作はできない', () => {
    let s = mainPhase()
    const p = coastalPath(12, 2)
    spreadVertices(4, p.vertices).forEach((v) => put(s, v, 0, 'city'))
    put(s, p.vertices[0], 0)
    putRoads(s, p.edges, 0)
    setHand(s, 0, { wood: 1, brick: 1, sheep: 1, wheat: 1 })
    expect(victoryPoints(s, 0, true)).toBe(9)
    s = act(s, { type: 'buildSettlement', vertex: p.vertices[2] }, 0)
    expect(s.winner).toBe(0)
    expect(s.phase.type).toBe('gameOver')
    expect(s.log[s.log.length - 1]).toEqual({ kind: 'win', player: 0, points: 10 })
    expect(actError(s, { type: 'endTurn' }, 0)).toMatch('終了')
  })

  it('他人の手番中に10点に達しても勝利せず、自分の手番が来た時点で勝利', () => {
    let s = mainPhase()
    // プレイヤー2：6本の道（最長交易路の保持者）。途中の交差点は内陸にも辺がある
    let start = 0
    while (TOPOLOGY.vertices[coastalPath(start, 6).vertices[3]].edges.length < 3) start++
    const road2 = coastalPath(start, 6)
    // プレイヤー1：都市4つで8点、道5本
    const road1 = coastalPath(start + 12, 5)
    spreadVertices(4, [...road1.vertices, ...road2.vertices]).forEach((v) => put(s, v, 1, 'city'))
    putRoads(s, road1.edges, 1)
    putRoads(s, road2.edges, 2)
    s.longestRoad = { holder: 2, lengths: [0, 5, 6, 0] }
    // プレイヤー0が内陸側から道をつなぎ、プレイヤー2の道の途中に開拓地を建てて分断する
    const junction = road2.vertices[3]
    putRoads(s, [TOPOLOGY.vertices[junction].edges.find((e) => !road2.edges.includes(e))!], 0)
    setHand(s, 0, { wood: 1, brick: 1, sheep: 1, wheat: 1 })
    s = act(s, { type: 'buildSettlement', vertex: junction }, 0)
    expect(s.longestRoad.holder).toBe(1)
    expect(victoryPoints(s, 1, true)).toBe(10)
    expect(s.winner).toBeNull()
    s = act(s, { type: 'endTurn' }, 0)
    expect(s.currentPlayer).toBe(1)
    expect(s.winner).toBe(1)
  })
})

describe('公開・非公開情報', () => {
  it('他人の手札・発展カードは枚数だけ見える。山札は枚数だけ', () => {
    const s = mainPhase()
    setHand(s, 0, { wood: 2 })
    setHand(s, 1, { ore: 3 })
    s.players[1].devCards = [{ type: 'victoryPoint', boughtTurn: 0 }]
    const v = viewFor(s, 0)
    expect(v.players[0].resources).toEqual(counts({ wood: 2 }))
    expect(v.players[1].resources).toBeNull()
    expect(v.players[1].resourceCount).toBe(3)
    expect(v.players[1].devCards).toBeNull()
    expect(v.players[1].devCardCount).toBe(1)
    expect(v.players[1].publicPoints).toBe(0)
    expect(v.devDeckCount).toBe(25)
    expect('devDeck' in v).toBe(false)
  })

  it('盗賊で奪われた資源の種類は、奪った人と奪われた人だけが見られる', () => {
    let s = mainPhase()
    s.phase = { type: 'moveRobber', resume: 'main' }
    put(s, TOPOLOGY.hexes[0].vertices[0], 1)
    setHand(s, 1, { brick: 1 })
    s = act(s, { type: 'moveRobber', hex: 0 }, 0)
    const last = (viewer: number | null) => viewFor(s, viewer).log.at(-1)
    expect(last(0)).toMatchObject({ kind: 'steal', resource: 'brick' })
    expect(last(1)).toMatchObject({ kind: 'steal', resource: 'brick' })
    expect(last(2)).toMatchObject({ kind: 'steal', stolen: true, resource: null })
    expect(last(null)).toMatchObject({ kind: 'steal', stolen: true, resource: null })
  })

  it('ログは新しい方から指定件数だけ残し、元の位置を logStart で示す', () => {
    const s = mainPhase()
    s.log = Array.from({ length: 10 }, (_, i) => ({ kind: 'turnStart' as const, player: 0, turn: i }))
    const v = viewFor(s, 0, { maxLog: 3 })
    expect(v.logStart).toBe(7)
    expect(v.log.map((e) => (e.kind === 'turnStart' ? e.turn : -1))).toEqual([7, 8, 9])
    expect(viewFor(s, 0).logStart).toBe(0)
  })

  it('viewToState：本人の手札はそのまま、他人の手札は空。盤面の判定は元の状態と同じ', () => {
    const s = mainPhase()
    setHand(s, 0, { wood: 2, brick: 1 })
    setHand(s, 1, { ore: 3 })
    s.players[0].devCards = [{ type: 'knight', boughtTurn: 0 }]
    s.players[1].devCards = [{ type: 'victoryPoint', boughtTurn: 0 }]
    put(s, 0, 0)
    putRoads(s, [TOPOLOGY.vertices[0].edges[0]], 0)
    const pseudo = viewToState(viewFor(s, 0))
    expect(pseudo.players[0].resources).toEqual(counts({ wood: 2, brick: 1 }))
    expect(pseudo.players[1].resources).toEqual(counts())
    expect(pseudo.players[1].devCards).toEqual([])
    expect(pseudo.devDeck).toHaveLength(s.devDeck.length)
    expect(legalRoadEdges(pseudo, 0)).toEqual(legalRoadEdges(s, 0))
    expect(legalSettlementVertices(pseudo, 0, true)).toEqual(legalSettlementVertices(s, 0, true))
    expect(devCardError(pseudo, 0, 'knight')).toBe(devCardError(s, 0, 'knight'))
    expect('viewer' in pseudo || 'logStart' in pseudo).toBe(false)
  })
})

describe('applyAction の純粋性', () => {
  it('引数の state を書き換えず、エラー時は同じ state を返す', () => {
    const s = mainPhase()
    setHand(s, 0, { wood: 1, brick: 1 })
    put(s, 0, 0)
    const snapshot = JSON.stringify(s)
    const ok = applyAction(s, { type: 'buildRoad', edge: TOPOLOGY.vertices[0].edges[0] }, 0, seededRng(1))
    expect(ok.error).toBeNull()
    expect(ok.state).not.toBe(s)
    expect(JSON.stringify(s)).toBe(snapshot)
    const bad = applyAction(s, { type: 'buildCity', vertex: 0 }, 0, seededRng(1))
    expect(bad.error).toMatch('資源が足りません')
    expect(bad.state).toBe(s)
  })

  it('不正な入力（不明な操作・範囲外のプレイヤー）を弾く', () => {
    const s = mainPhase()
    expect(applyAction(s, { type: 'hack' } as unknown as Action, 0, seededRng(1)).error).toMatch('不明な操作')
    expect(applyAction(s, { type: 'endTurn' }, 7, seededRng(1)).error).toMatch('プレイヤーの指定')
  })
})

/** 合法手からランダムに選んで進める簡易プレイヤー（通しプレイの検証用） */
function randomLegalAction(s: GameState, rng: Rng): { action: Action; player: number } {
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)]
  const p = s.currentPlayer
  const phase = s.phase
  switch (phase.type) {
    case 'setup':
      return phase.step === 'settlement'
        ? { player: p, action: { type: 'placeSetupSettlement', vertex: pick(legalSettlementVertices(s, p, false)) } }
        : { player: p, action: { type: 'placeSetupRoad', edge: pick(legalRoadEdges(s, p, phase.lastSettlement)) } }
    case 'preRoll':
      return { player: p, action: { type: 'rollDice' } }
    case 'discard': {
      const who = phase.pending.findIndex((n) => n > 0)
      const hand = { ...s.players[who].resources }
      const out = counts()
      for (let i = 0; i < phase.pending[who]; i++) {
        const r = (Object.keys(hand) as (keyof typeof hand)[]).find((k) => hand[k] > 0)!
        hand[r]--
        out[r]++
      }
      return { player: who, action: { type: 'discard', resources: out } }
    }
    case 'moveRobber':
      return { player: p, action: { type: 'moveRobber', hex: (s.robber + 1 + Math.floor(rng() * 18)) % 19 } }
    case 'steal':
      return { player: p, action: { type: 'steal', target: pick(phase.candidates) } }
    case 'roadBuilding':
      return { player: p, action: { type: 'placeFreeRoad', edge: pick(legalRoadEdges(s, p)) } }
    default: {
      const hand = s.players[p].resources
      const can = (cost: ResourceCounts) => hasAtLeast(hand, cost)
      const options: Action[] = [
        ...(can(COSTS.city) ? legalCityVertices(s, p).map((vertex): Action => ({ type: 'buildCity', vertex })) : []),
        ...(can(COSTS.settlement)
          ? legalSettlementVertices(s, p, true).map((vertex): Action => ({ type: 'buildSettlement', vertex }))
          : []),
        ...(can(COSTS.road) ? legalRoadEdges(s, p).map((edge): Action => ({ type: 'buildRoad', edge })) : []),
        ...(can(COSTS.devCard) && s.devDeck.length > 0 ? [{ type: 'buyDevCard' } as Action] : []),
        ...(devCardError(s, p, 'knight') === null ? [{ type: 'playKnight' } as Action] : []),
      ]
      // 余っている資源を、足りない資源と海上交易する
      const rates = tradeRates(s, p)
      const rich = RESOURCES.find((r) => hand[r] >= rates[r])
      const poor = RESOURCES.find((r) => hand[r] === 0 && s.bank[r] > 0)
      if (rich && poor) {
        options.push({ type: 'bankTrade', give: counts({ [rich]: rates[rich] }), get: counts({ [poor]: 1 }) })
      }
      return { player: p, action: options.length > 0 ? pick(options) : { type: 'endTurn' } }
    }
  }
}

describe('通しプレイ', () => {
  it('ランダムな合法手で最後まで遊んでも、資源の総数が保たれ勝者が決まる', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = seededRng(seed)
      let s = newGame(2 + (seed % 3), seed % 2 ? 'random' : 'beginner', seed)
      for (let step = 0; step < 5000 && s.phase.type !== 'gameOver'; step++) {
        const { action, player } = randomLegalAction(s, rng)
        const r = applyAction(s, action, player, rng)
        expect(r.error).toBeNull()
        s = r.state
        const inHands = s.players.reduce((sum, p) => sum + total(p.resources), 0)
        expect(inHands + total(s.bank)).toBe(95)
      }
      expect(s.phase.type).toBe('gameOver')
      expect(victoryPoints(s, s.winner!, true)).toBeGreaterThanOrEqual(10)
    }
  }, 60_000)
})
