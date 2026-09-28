import { describe, expect, it } from 'vitest'
import { TOPOLOGY } from '../board/topology.ts'
import { total } from '../resources.ts'
import { act, actError, mainPhase, put, putRoads, setHand } from '../testing.ts'
import { legalSettlementVertices, piecesLeft, satisfiesDistanceRule } from './placement.ts'

const SETTLEMENT_HAND = { wood: 1, brick: 1, sheep: 1, wheat: 1 }
const ROAD_HAND = { wood: 1, brick: 1 }

describe('距離ルール', () => {
  const center = TOPOLOGY.hexes[9].vertices[0]
  const neighbors = TOPOLOGY.vertices[center].neighbors

  it('空いていて、隣の交差点もすべて空いていれば置ける', () => {
    const s = mainPhase()
    expect(satisfiesDistanceRule(s, center)).toBe(true)
  })

  it('隣接する交差点に自分の建物があると置けない', () => {
    for (const n of neighbors) {
      const s = mainPhase()
      put(s, n, 0)
      expect(satisfiesDistanceRule(s, center)).toBe(false)
    }
  })

  it('隣接する交差点に他人の建物（都市も）があると置けない', () => {
    const s = mainPhase()
    put(s, neighbors[0], 1, 'city')
    expect(satisfiesDistanceRule(s, center)).toBe(false)
  })

  it('2つ離れた交差点の建物は関係ない', () => {
    const s = mainPhase()
    const twoAway = TOPOLOGY.vertices[neighbors[0]].neighbors.find((v) => v !== center)!
    put(s, twoAway, 1)
    expect(satisfiesDistanceRule(s, center)).toBe(true)
  })

  it('建設時：距離ルール違反の交差点には、道がつながっていても建てられない', () => {
    const s = mainPhase()
    const [a, b] = [neighbors[0], center]
    put(s, a, 0)
    putRoads(s, [TOPOLOGY.vertices[a].edges.find((e) => TOPOLOGY.edges[e].vertices.includes(b))!], 0)
    setHand(s, 0, SETTLEMENT_HAND)
    expect(actError(s, { type: 'buildSettlement', vertex: b }, 0)).toMatch('距離ルール')
  })

  it('候補一覧に距離ルール違反の交差点は含まれない', () => {
    const s = mainPhase()
    put(s, center, 2)
    const legal = legalSettlementVertices(s, 0, false)
    expect(legal).not.toContain(center)
    for (const n of neighbors) expect(legal).not.toContain(n)
    expect(legal.length).toBe(54 - 1 - neighbors.length)
  })
})

describe('開拓地の建設', () => {
  it('自分の道につながる、距離ルールを満たす交差点に建てられ、資源は銀行へ', () => {
    let s = mainPhase()
    const v0 = TOPOLOGY.hexes[9].vertices[0]
    const path = [v0, TOPOLOGY.vertices[v0].neighbors[0]]
    const v2 = TOPOLOGY.vertices[path[1]].neighbors.find((v) => v !== v0)!
    put(s, v0, 0)
    putRoads(s, [TOPOLOGY.vertices[v0].edges.find((e) => TOPOLOGY.edges[e].vertices.includes(path[1]))!], 0)
    putRoads(s, [TOPOLOGY.vertices[path[1]].edges.find((e) => TOPOLOGY.edges[e].vertices.includes(v2))!], 0)
    setHand(s, 0, SETTLEMENT_HAND)
    const bankBefore = total(s.bank)
    s = act(s, { type: 'buildSettlement', vertex: v2 }, 0)
    expect(s.buildings[v2]).toEqual({ owner: 0, kind: 'settlement' })
    expect(total(s.players[0].resources)).toBe(0)
    expect(total(s.bank)).toBe(bankBefore + 4)
  })

  it('他人の道にしかつながっていない交差点には建てられない', () => {
    const s = mainPhase()
    const v = TOPOLOGY.hexes[9].vertices[0]
    putRoads(s, [TOPOLOGY.vertices[v].edges[0]], 1)
    setHand(s, 0, SETTLEMENT_HAND)
    expect(actError(s, { type: 'buildSettlement', vertex: v }, 0)).toMatch('自分の道')
  })

  it('資源が足りなければ建てられない', () => {
    const s = mainPhase()
    setHand(s, 0, { wood: 1, brick: 1, sheep: 1 })
    expect(actError(s, { type: 'buildSettlement', vertex: 0 }, 0)).toMatch('資源が足りません')
  })

  it('開拓地5つを使い切ると建てられない。都市化すると再び建てられる', () => {
    const s = mainPhase()
    const spots = legalSettlementVertices(s, 0, false)
    const chosen: number[] = []
    for (const v of spots) {
      if (chosen.length === 5) break
      if (chosen.every((c) => !TOPOLOGY.vertices[c].neighbors.includes(v))) chosen.push(v)
    }
    chosen.forEach((v) => put(s, v, 0))
    expect(piecesLeft(s, 0, 'settlement')).toBe(0)
    put(s, chosen[0], 0, 'city')
    expect(piecesLeft(s, 0, 'settlement')).toBe(1)
    expect(piecesLeft(s, 0, 'city')).toBe(3)
  })
})

describe('道の建設', () => {
  const v = TOPOLOGY.hexes[9].vertices[0]
  const [e1, e2] = TOPOLOGY.vertices[v].edges

  it('自分の建物に接する辺に置ける', () => {
    let s = mainPhase()
    put(s, v, 0)
    setHand(s, 0, ROAD_HAND)
    s = act(s, { type: 'buildRoad', edge: e1 }, 0)
    expect(s.roads[e1]).toBe(0)
  })

  it('自分の道の先に延ばせる', () => {
    let s = mainPhase()
    putRoads(s, [e1], 0)
    setHand(s, 0, ROAD_HAND)
    s = act(s, { type: 'buildRoad', edge: e2 }, 0)
    expect(s.roads[e2]).toBe(0)
  })

  it('他人の開拓地がある交差点を通り抜けて延ばせない', () => {
    const s = mainPhase()
    putRoads(s, [e1], 0)
    put(s, v, 1)
    setHand(s, 0, ROAD_HAND)
    expect(actError(s, { type: 'buildRoad', edge: e2 }, 0)).toMatch('つながっていない')
  })

  it('つながっていない辺・すでに道がある辺には置けない', () => {
    const s = mainPhase()
    setHand(s, 0, ROAD_HAND)
    expect(actError(s, { type: 'buildRoad', edge: e1 }, 0)).toMatch('つながっていない')
    putRoads(s, [e1], 1)
    expect(actError(s, { type: 'buildRoad', edge: e1 }, 0)).toMatch('すでに道')
  })

  it('道は15本まで', () => {
    const s = mainPhase()
    const own = TOPOLOGY.edges.slice(0, 15).map((e) => e.id)
    putRoads(s, own, 0)
    put(s, TOPOLOGY.edges[20].vertices[0], 0)
    setHand(s, 0, ROAD_HAND)
    const target = TOPOLOGY.vertices[TOPOLOGY.edges[20].vertices[0]].edges.find((e) => s.roads[e] === null)!
    expect(actError(s, { type: 'buildRoad', edge: target }, 0)).toMatch('道の駒が残っていません')
  })

  it('範囲外のIDは弾く', () => {
    const s = mainPhase()
    setHand(s, 0, { ...ROAD_HAND, ...SETTLEMENT_HAND })
    expect(actError(s, { type: 'buildRoad', edge: 72 }, 0)).toMatch('辺の指定')
    expect(actError(s, { type: 'buildSettlement', vertex: -1 }, 0)).toMatch('交差点の指定')
  })
})

describe('都市の建設', () => {
  it('自分の開拓地を都市にでき、開拓地の駒が戻る', () => {
    let s = mainPhase()
    put(s, 10, 0)
    setHand(s, 0, { ore: 3, wheat: 2 })
    s = act(s, { type: 'buildCity', vertex: 10 }, 0)
    expect(s.buildings[10]).toEqual({ owner: 0, kind: 'city' })
    expect(piecesLeft(s, 0, 'settlement')).toBe(5)
  })

  it('他人の開拓地や空き交差点は都市にできない', () => {
    const s = mainPhase()
    put(s, 10, 1)
    setHand(s, 0, { ore: 3, wheat: 2 })
    expect(actError(s, { type: 'buildCity', vertex: 10 }, 0)).toMatch('自分の開拓地')
    expect(actError(s, { type: 'buildCity', vertex: 30 }, 0)).toMatch('自分の開拓地')
  })
})
