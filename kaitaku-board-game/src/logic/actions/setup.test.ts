import { describe, expect, it } from 'vitest'
import { TERRAIN_RESOURCE } from '../constants.ts'
import { TOPOLOGY } from '../board/topology.ts'
import { total } from '../resources.ts'
import { legalRoadEdges, legalSettlementVertices } from '../rules/placement.ts'
import { victoryPoints } from '../rules/victory.ts'
import { act, actError, newGame } from '../testing.ts'
import type { GameState } from '../types.ts'

/** 置ける場所の先頭に開拓地と道を置く */
function placeFirstLegal(s: GameState): GameState {
  const p = s.currentPlayer
  const v = legalSettlementVertices(s, p, false)[0]
  s = act(s, { type: 'placeSetupSettlement', vertex: v }, p)
  const e = legalRoadEdges(s, p, v)[0]
  return act(s, { type: 'placeSetupRoad', edge: e }, p)
}

describe('初期配置（スネーク順）', () => {
  it('1巡目は時計回り、2巡目は逆順で、スタートプレイヤーが最後', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let s = newGame(4, 'beginner', seed)
      const start = s.startPlayer
      const seen: number[] = []
      for (let i = 0; i < 8; i++) {
        seen.push(s.currentPlayer)
        s = placeFirstLegal(s)
      }
      const r1 = [0, 1, 2, 3].map((i) => (start + i) % 4)
      expect(seen).toEqual([...r1, ...r1.slice().reverse()])
      // 初期配置後はスタートプレイヤーからサイコロ
      expect(s.phase.type).toBe('preRoll')
      expect(s.currentPlayer).toBe(start)
      expect(s.turn).toBe(1)
      for (let p = 0; p < 4; p++) expect(victoryPoints(s, p, true)).toBe(2)
    }
  })

  it('3人・2人でも同じ順序', () => {
    for (const n of [2, 3]) {
      let s = newGame(n, 'beginner', 3)
      const start = s.startPlayer
      const seen: number[] = []
      for (let i = 0; i < n * 2; i++) {
        seen.push(s.currentPlayer)
        s = placeFirstLegal(s)
      }
      const r1 = Array.from({ length: n }, (_, i) => (start + i) % n)
      expect(seen).toEqual([...r1, ...r1.slice().reverse()])
    }
  })

  it('初期配置でも距離ルールが適用される', () => {
    let s = newGame(4)
    const p = s.currentPlayer
    const v = TOPOLOGY.hexes[9].vertices[0]
    s = act(s, { type: 'placeSetupSettlement', vertex: v }, p)
    s = act(s, { type: 'placeSetupRoad', edge: legalRoadEdges(s, p, v)[0] }, p)
    const next = s.currentPlayer
    for (const n of TOPOLOGY.vertices[v].neighbors) {
      expect(actError(s, { type: 'placeSetupSettlement', vertex: n }, next)).toMatch('距離ルール')
    }
    expect(actError(s, { type: 'placeSetupSettlement', vertex: v }, next)).toMatch('すでに建物')
  })

  it('道は今置いた開拓地に接していなければならない', () => {
    let s = newGame(4)
    const p = s.currentPlayer
    const v = TOPOLOGY.hexes[9].vertices[0]
    s = act(s, { type: 'placeSetupSettlement', vertex: v }, p)
    const far = TOPOLOGY.edges.find((e) => !e.vertices.includes(v))!.id
    expect(actError(s, { type: 'placeSetupRoad', edge: far }, p)).toMatch('今置いた開拓地')
    expect(legalRoadEdges(s, p, v)).toEqual(TOPOLOGY.vertices[v].edges)
  })

  it('手番以外の人は置けない・順番を飛ばせない', () => {
    const s = newGame(4)
    const other = (s.currentPlayer + 1) % 4
    expect(actError(s, { type: 'placeSetupSettlement', vertex: 0 }, other)).toMatch('手番ではありません')
    expect(actError(s, { type: 'placeSetupRoad', edge: 0 }, s.currentPlayer)).toMatch('道を置く番ではありません')
    expect(actError(s, { type: 'rollDice' }, s.currentPlayer)).toMatch('初期配置中')
  })

  it('2つ目の開拓地に隣接する地形1枚につき1枚受け取る（1つ目は受け取らない）', () => {
    let s = newGame(4)
    for (let i = 0; i < 4; i++) s = placeFirstLegal(s)
    for (const p of s.players) expect(total(p.resources)).toBe(0)

    const p = s.currentPlayer
    // 3枚のタイルに接し、砂漠を含まない交差点を選ぶ
    const v = legalSettlementVertices(s, p, false).find((id) => {
      const hexes = TOPOLOGY.vertices[id].hexes
      return hexes.length === 3 && hexes.every((h) => s.tiles[h].terrain !== 'desert')
    })!
    s = act(s, { type: 'placeSetupSettlement', vertex: v }, p)
    const expected = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
    for (const h of TOPOLOGY.vertices[v].hexes) expected[TERRAIN_RESOURCE[s.tiles[h].terrain]!]++
    expect(s.players[p].resources).toEqual(expected)
    expect(total(s.bank)).toBe(95 - 3)
  })

  it('砂漠からは何も受け取らない', () => {
    let s = newGame(4)
    for (let i = 0; i < 4; i++) s = placeFirstLegal(s)
    const p = s.currentPlayer
    const desert = s.tiles.findIndex((t) => t.terrain === 'desert')
    const v = TOPOLOGY.hexes[desert].vertices.find((id) => legalSettlementVertices(s, p, false).includes(id))!
    s = act(s, { type: 'placeSetupSettlement', vertex: v }, p)
    expect(total(s.players[p].resources)).toBe(TOPOLOGY.vertices[v].hexes.length - 1)
  })
})
