// 盤面の位置関係（静的）。盤面の形は毎ゲーム同じなので、モジュール読み込み時に一度だけ計算する。
//
// 座標系：尖り上（pointy-top）の六角形、アキシャル座標 (q, r)。
// 角の位置は「格子座標」で表す（横の単位 = 半径×√3/2、縦の単位 = 半径×1/2）。
//   タイル中心 = (2q + r, 3r)
//   角の差分   = 北(0,-2) 北東(1,-1) 南東(1,1) 南(0,2) 南西(-1,1) 北西(-1,-1)
// こうするとすべての角が整数になり、隣り合うタイルの共有する角が同じ座標になる。

import type { EdgeId, HexId, VertexId } from '../types.ts'

export const BOARD_RADIUS = 2

export interface HexInfo {
  id: HexId
  q: number
  r: number
  /** 格子座標でのタイル中心 */
  center: { x: number; y: number }
  /** 北から時計回りの6頂点 */
  vertices: VertexId[]
  /** vertices[i] と vertices[i+1] を結ぶ辺（北東の辺から時計回り） */
  edges: EdgeId[]
  /** 盤面内の隣接タイル */
  neighbors: HexId[]
}

export interface VertexInfo {
  id: VertexId
  x: number
  y: number
  /** 接するタイル（1〜3枚） */
  hexes: HexId[]
  /** 辺でつながった隣の頂点（2〜3個） */
  neighbors: VertexId[]
  /** 接する辺（2〜3本） */
  edges: EdgeId[]
}

export interface EdgeInfo {
  id: EdgeId
  vertices: [VertexId, VertexId]
  /** 接するタイル（1枚なら海岸の辺） */
  hexes: HexId[]
  /** 端点を共有する辺 */
  neighbors: EdgeId[]
}

export interface Topology {
  hexes: HexInfo[]
  vertices: VertexInfo[]
  edges: EdgeInfo[]
  /** 海岸の辺（上から時計回り） */
  coastalEdges: EdgeId[]
  /** 港の位置（固定の9か所、時計回り） */
  portEdges: EdgeId[]
}

const CORNER_OFFSETS: [number, number][] = [
  [0, -2],
  [1, -1],
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
]

const HEX_DIRECTIONS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

/** 海岸の辺30本のうち、港を置く位置（時計回りの番号）。間隔 3,3,4 の繰り返し */
const PORT_SLOTS = [1, 4, 7, 11, 14, 17, 21, 24, 27]

/** 格子座標 → 描画座標（タイル半径 = 1） */
export function toPixel(x: number, y: number): { x: number; y: number } {
  return { x: (x * Math.sqrt(3)) / 2, y: y / 2 }
}

function buildTopology(): Topology {
  // タイル：上の行から、各行は左から
  const axial: { q: number; r: number }[] = []
  for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
    for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
      if (Math.abs(q + r) <= BOARD_RADIUS) axial.push({ q, r })
    }
  }

  // 頂点：全タイルの角を集めて重複を除き、(y, x) の昇順で採番
  const cornerKeys = new Map<string, { x: number; y: number }>()
  const hexCornerKeys = axial.map(({ q, r }) => {
    const cx = 2 * q + r
    const cy = 3 * r
    return CORNER_OFFSETS.map(([dx, dy]) => {
      const key = `${cx + dx},${cy + dy}`
      cornerKeys.set(key, { x: cx + dx, y: cy + dy })
      return key
    })
  })
  const sortedCorners = [...cornerKeys.entries()].sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
  const vertexIdByKey = new Map(sortedCorners.map(([key], i) => [key, i]))
  const vertices: VertexInfo[] = sortedCorners.map(([, p], id) => ({
    id,
    x: p.x,
    y: p.y,
    hexes: [],
    neighbors: [],
    edges: [],
  }))

  // 辺：各タイルの隣り合う角の組。中点 (y, x) の昇順で採番
  const edgePairs = new Map<string, [VertexId, VertexId]>()
  const hexVertexIds = hexCornerKeys.map((keys) => keys.map((k) => vertexIdByKey.get(k)!))
  for (const vs of hexVertexIds) {
    for (let i = 0; i < 6; i++) {
      const a = vs[i]
      const b = vs[(i + 1) % 6]
      const pair: [VertexId, VertexId] = a < b ? [a, b] : [b, a]
      edgePairs.set(pair.join('-'), pair)
    }
  }
  const mid = ([a, b]: [VertexId, VertexId]) => ({
    x: vertices[a].x + vertices[b].x,
    y: vertices[a].y + vertices[b].y,
  })
  const sortedPairs = [...edgePairs.values()].sort((p1, p2) => {
    const m1 = mid(p1)
    const m2 = mid(p2)
    return m1.y - m2.y || m1.x - m2.x
  })
  const edgeIdByKey = new Map(sortedPairs.map((pair, i) => [pair.join('-'), i]))
  const edges: EdgeInfo[] = sortedPairs.map((pair, id) => ({ id, vertices: pair, hexes: [], neighbors: [] }))

  const axialIndex = new Map(axial.map(({ q, r }, i) => [`${q},${r}`, i]))
  const hexes: HexInfo[] = axial.map(({ q, r }, id) => {
    const vs = hexVertexIds[id]
    const es = vs.map((a, i) => {
      const b = vs[(i + 1) % 6]
      return edgeIdByKey.get(a < b ? `${a}-${b}` : `${b}-${a}`)!
    })
    const neighbors = HEX_DIRECTIONS.map(([dq, dr]) => axialIndex.get(`${q + dq},${r + dr}`)).filter(
      (n): n is number => n !== undefined,
    )
    return { id, q, r, center: { x: 2 * q + r, y: 3 * r }, vertices: vs, edges: es, neighbors }
  })

  for (const hex of hexes) {
    for (const v of hex.vertices) vertices[v].hexes.push(hex.id)
    for (const e of hex.edges) edges[e].hexes.push(hex.id)
  }
  for (const edge of edges) {
    const [a, b] = edge.vertices
    vertices[a].neighbors.push(b)
    vertices[b].neighbors.push(a)
    vertices[a].edges.push(edge.id)
    vertices[b].edges.push(edge.id)
  }
  for (const edge of edges) {
    const [a, b] = edge.vertices
    edge.neighbors = [...vertices[a].edges, ...vertices[b].edges].filter((e) => e !== edge.id)
  }
  for (const v of vertices) {
    v.hexes.sort((a, b) => a - b)
    v.neighbors.sort((a, b) => a - b)
    v.edges.sort((a, b) => a - b)
  }

  // 海岸の辺を、真上から時計回り（画面座標で角度が増える向き）に並べる
  const angleOf = (e: EdgeInfo) => {
    const m = mid(e.vertices)
    const p = toPixel(m.x, m.y)
    return (Math.atan2(p.y, p.x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)
  }
  const coastalEdges = edges
    .filter((e) => e.hexes.length === 1)
    .sort((a, b) => angleOf(a) - angleOf(b))
    .map((e) => e.id)
  const portEdges = PORT_SLOTS.map((i) => coastalEdges[i])

  return { hexes, vertices, edges, coastalEdges, portEdges }
}

export const TOPOLOGY: Topology = buildTopology()

export const HEX_COUNT = TOPOLOGY.hexes.length
export const VERTEX_COUNT = TOPOLOGY.vertices.length
export const EDGE_COUNT = TOPOLOGY.edges.length

/** 辺の、指定した頂点とは反対側の端点 */
export function otherEnd(edge: EdgeId, from: VertexId): VertexId {
  const [a, b] = TOPOLOGY.edges[edge].vertices
  return a === from ? b : a
}

/** 2頂点を結ぶ辺（なければ undefined） */
export function edgeBetween(a: VertexId, b: VertexId): EdgeId | undefined {
  return TOPOLOGY.vertices[a].edges.find((e) => TOPOLOGY.edges[e].vertices.includes(b))
}
