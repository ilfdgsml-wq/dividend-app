import { describe, expect, it } from 'vitest'
import { NUMBER_POOL, PORT_POOL, TERRAIN_POOL } from '../constants.ts'
import { seededRng } from '../rng.ts'
import { EDGE_COUNT, HEX_COUNT, TOPOLOGY, VERTEX_COUNT } from './topology.ts'
import { generateBeginnerBoard, generateRandomBoard, redNumbersSeparated } from './generate.ts'

const sorted = <T,>(a: T[]) => a.slice().sort()

describe('topology', () => {
  it('タイル19・交差点54・辺72・海岸の辺30', () => {
    expect(HEX_COUNT).toBe(19)
    expect(VERTEX_COUNT).toBe(54)
    expect(EDGE_COUNT).toBe(72)
    expect(TOPOLOGY.coastalEdges).toHaveLength(30)
  })

  it('交差点が接するタイル数：1枚が18、2枚が12、3枚が24', () => {
    const byCount = [0, 0, 0, 0]
    for (const v of TOPOLOGY.vertices) byCount[v.hexes.length]++
    expect(byCount).toEqual([0, 18, 12, 24])
  })

  it('海岸の交差点は1〜2枚のタイルにしか接しない', () => {
    for (const e of TOPOLOGY.coastalEdges) {
      for (const v of TOPOLOGY.edges[e].vertices) expect(TOPOLOGY.vertices[v].hexes.length).toBeLessThanOrEqual(2)
    }
  })

  it('IDは (y, x) 順に振られ、隣接関係は対称', () => {
    for (let i = 1; i < VERTEX_COUNT; i++) {
      const a = TOPOLOGY.vertices[i - 1]
      const b = TOPOLOGY.vertices[i]
      expect(a.y < b.y || (a.y === b.y && a.x < b.x)).toBe(true)
    }
    for (const v of TOPOLOGY.vertices) {
      expect(v.neighbors.length).toBeGreaterThanOrEqual(2)
      expect(v.neighbors.length).toBeLessThanOrEqual(3)
      for (const n of v.neighbors) expect(TOPOLOGY.vertices[n].neighbors).toContain(v.id)
    }
    for (const h of TOPOLOGY.hexes) {
      for (const n of h.neighbors) expect(TOPOLOGY.hexes[n].neighbors).toContain(h.id)
    }
    expect(TOPOLOGY.hexes[9].neighbors).toHaveLength(6)
  })

  it('海岸の辺は時計回りに連続している', () => {
    const ring = TOPOLOGY.coastalEdges
    ring.forEach((e, i) => {
      const next = ring[(i + 1) % ring.length]
      const shared = TOPOLOGY.edges[e].vertices.filter((v) => TOPOLOGY.edges[next].vertices.includes(v))
      expect(shared).toHaveLength(1)
    })
  })

  it('港は海岸の9か所で、交差点を共有しない', () => {
    const ports = TOPOLOGY.portEdges
    expect(ports).toHaveLength(9)
    const vs = ports.flatMap((e) => TOPOLOGY.edges[e].vertices)
    expect(new Set(vs).size).toBe(18)
    for (const e of ports) expect(TOPOLOGY.edges[e].hexes).toHaveLength(1)
  })
})

describe('盤面生成', () => {
  it('ランダム配置：構成が正しく、6と8が隣接しない（多数のシードで確認）', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const board = generateRandomBoard(seededRng(seed))
      expect(sorted(board.tiles.map((t) => t.terrain))).toEqual(sorted(TERRAIN_POOL))
      expect(sorted(board.tiles.flatMap((t) => (t.number === null ? [] : [t.number])))).toEqual(sorted(NUMBER_POOL))
      expect(sorted(board.ports.map((p) => p.kind))).toEqual(sorted(PORT_POOL))
      expect(redNumbersSeparated(board.tiles)).toBe(true)
      expect(board.tiles[board.robber].terrain).toBe('desert')
      expect(board.tiles[board.robber].number).toBeNull()
    }
  })

  it('同じシードなら同じ盤面', () => {
    expect(generateRandomBoard(seededRng(42))).toEqual(generateRandomBoard(seededRng(42)))
  })

  it('初心者用固定配置も構成が正しく、6と8が隣接しない', () => {
    const board = generateBeginnerBoard()
    expect(sorted(board.tiles.map((t) => t.terrain))).toEqual(sorted(TERRAIN_POOL))
    expect(sorted(board.tiles.flatMap((t) => (t.number === null ? [] : [t.number])))).toEqual(sorted(NUMBER_POOL))
    expect(sorted(board.ports.map((p) => p.kind))).toEqual(sorted(PORT_POOL))
    expect(redNumbersSeparated(board.tiles)).toBe(true)
    expect(board.tiles[board.robber].terrain).toBe('desert')
  })

  it('6と8の隣接を検出できる', () => {
    const board = generateBeginnerBoard()
    const [a, b] = [TOPOLOGY.hexes[9].id, TOPOLOGY.hexes[9].neighbors[0]]
    board.tiles[a] = { terrain: 'forest', number: 6 }
    board.tiles[b] = { terrain: 'hills', number: 8 }
    expect(redNumbersSeparated(board.tiles)).toBe(false)
  })
})
