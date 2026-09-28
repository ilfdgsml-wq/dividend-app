import { describe, expect, it } from 'vitest'
import { TOPOLOGY, otherEnd } from '../board/topology.ts'
import { act, coastalPath, mainPhase, put, putRoads, setHand } from '../testing.ts'
import type { EdgeId, GameState, VertexId } from '../types.ts'
import { longestRoadLength, updateLongestRoad } from './longestRoad.ts'

/** 海岸沿いの道のうち、index 番目の頂点が内陸への辺を持つ（3本の辺に接する）ものを探す */
function pathWithInlandJunction(length: number, index: number) {
  for (let start = 0; start < 30; start++) {
    const p = coastalPath(start, length)
    const v = p.vertices[index]
    const inland = TOPOLOGY.vertices[v].edges.find((e) => !p.edges.includes(e))
    if (inland !== undefined) return { ...p, junction: v, inland }
  }
  throw new Error('見つからない')
}

/** 頂点 from から、使っていない頂点をたどって内陸へ length 本延ばす */
function spur(from: VertexId, first: EdgeId, length: number, avoid: VertexId[]): EdgeId[] {
  const edges = [first]
  const visited = new Set([...avoid, from])
  let v = otherEnd(first, from)
  visited.add(v)
  while (edges.length < length) {
    const e = TOPOLOGY.vertices[v].edges.find((x) => !visited.has(otherEnd(x, v)))!
    edges.push(e)
    v = otherEnd(e, v)
    visited.add(v)
  }
  return edges
}

describe('最長交易路の長さ', () => {
  it('一直線の道はその本数', () => {
    const s = mainPhase()
    putRoads(s, coastalPath(0, 7).edges, 0)
    expect(longestRoadLength(s, 0)).toBe(7)
    expect(longestRoadLength(s, 1)).toBe(0)
  })

  it('分岐がある場合は最長の1経路だけを数える', () => {
    const s = mainPhase()
    const p = pathWithInlandJunction(4, 2)
    putRoads(s, p.edges, 0)
    putRoads(s, spur(p.junction, p.inland, 3, p.vertices), 0)
    // 腕の長さ 2・2・3 → 2 + 3 = 5（合計7本でも5）
    expect(longestRoadLength(s, 0)).toBe(5)
  })

  it('輪になった道は一周分を数え、しっぽがあれば足す', () => {
    const s = mainPhase()
    const hex = TOPOLOGY.hexes[9]
    putRoads(s, hex.edges, 0)
    expect(longestRoadLength(s, 0)).toBe(6)
    const v = hex.vertices[0]
    const tail = TOPOLOGY.vertices[v].edges.find((e) => !hex.edges.includes(e))!
    putRoads(s, [tail], 0)
    expect(longestRoadLength(s, 0)).toBe(7)
  })

  it('他人の開拓地/都市が途中にあると、そこで分断される', () => {
    const s = mainPhase()
    const p = coastalPath(0, 6)
    putRoads(s, p.edges, 0)
    put(s, p.vertices[2], 1)
    expect(longestRoadLength(s, 0)).toBe(4)
    put(s, p.vertices[2], 1, 'city')
    expect(longestRoadLength(s, 0)).toBe(4)
  })

  it('自分の建物や、端にある他人の建物では分断されない', () => {
    const s = mainPhase()
    const p = coastalPath(0, 6)
    putRoads(s, p.edges, 0)
    put(s, p.vertices[3], 0)
    put(s, p.vertices[0], 1)
    put(s, p.vertices[6], 2)
    expect(longestRoadLength(s, 0)).toBe(6)
  })
})

/** 3人がそれぞれ離れた海岸に道を持つ状態 */
function threeRoads(a: number, b: number, c: number) {
  const s = mainPhase()
  const paths = [coastalPath(0, a), coastalPath(10, b), coastalPath(20, c)]
  paths.forEach((p, i) => putRoads(s, p.edges, i))
  return { s, paths }
}

describe('最長交易路の保持者', () => {
  it('5本以上を最初に作った人が獲得（4本では誰のものでもない）', () => {
    let s = mainPhase()
    const p = coastalPath(0, 5)
    put(s, p.vertices[0], 0)
    putRoads(s, p.edges.slice(0, 4), 0)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBeNull()
    setHand(s, 0, { wood: 1, brick: 1 })
    s = act(s, { type: 'buildRoad', edge: p.edges[4] }, 0)
    expect(s.longestRoad).toEqual({ holder: 0, lengths: [5, 0, 0, 0] })
    expect(s.log[s.log.length - 1]).toEqual({ kind: 'longestRoad', player: 0 })
  })

  it('同じ長さでは奪えない。より長い道を作った人が即座に奪う', () => {
    const { s } = threeRoads(5, 5, 0)
    s.longestRoad.holder = 0
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(0)
    putRoads(s, coastalPath(10, 6).edges, 1)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(1)
  })

  it('保持者の道が短くなっても、まだ同率1位なら維持', () => {
    const { s, paths } = threeRoads(7, 5, 0)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(0)
    put(s, paths[0].vertices[5], 2) // 7本 → 5本と2本に分断
    updateLongestRoad(s)
    expect(s.longestRoad.lengths[0]).toBe(5)
    expect(s.longestRoad.holder).toBe(0)
  })

  it('保持者が1位でなくなり、新しい1位が単独ならその人へ', () => {
    const { s, paths } = threeRoads(6, 5, 0)
    updateLongestRoad(s)
    put(s, paths[0].vertices[3], 2)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(1)
  })

  it('保持者が1位でなくなり、新しい1位が同率で複数なら誰のものでもない', () => {
    const { s, paths } = threeRoads(6, 5, 5)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(0)
    put(s, paths[0].vertices[3], 3)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBeNull()
    expect(s.log[s.log.length - 1]).toEqual({ kind: 'longestRoad', player: null })
  })

  it('5本以上の人がいなくなれば誰のものでもない。その後、単独1位が現れたら獲得', () => {
    const { s, paths } = threeRoads(6, 4, 0)
    updateLongestRoad(s)
    put(s, paths[0].vertices[3], 3)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBeNull()
    putRoads(s, coastalPath(10, 5).edges, 1)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(1)
  })

  it('誰のものでもない状態で同率1位が2人いる間は誰も獲得しない', () => {
    const { s } = threeRoads(5, 5, 0)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBeNull()
  })

  it('空き交差点に開拓地を建てて相手の道を切ると、その場で再計算される', () => {
    let s: GameState = mainPhase()
    const p = pathWithInlandJunction(6, 3)
    putRoads(s, p.edges, 1)
    updateLongestRoad(s)
    expect(s.longestRoad.holder).toBe(1)
    // プレイヤー0が内陸側から道をつなぎ、分岐点に開拓地を建てる
    putRoads(s, [p.inland], 0)
    setHand(s, 0, { wood: 1, brick: 1, sheep: 1, wheat: 1 })
    s = act(s, { type: 'buildSettlement', vertex: p.junction }, 0)
    expect(s.longestRoad.lengths[1]).toBe(3)
    expect(s.longestRoad.holder).toBeNull()
  })
})
