// 盤面の描画座標（SVG 単位）。トポロジーは静的なので一度だけ計算する

import { TOPOLOGY, toPixel } from '../../logic/index.ts'

/** タイル半径（SVG 単位） */
export const S = 100

export interface Point {
  x: number
  y: number
}

const px = (x: number, y: number): Point => {
  const p = toPixel(x, y)
  return { x: p.x * S, y: p.y * S }
}

export const VERTEX_POS: Point[] = TOPOLOGY.vertices.map((v) => px(v.x, v.y))
export const HEX_CENTER: Point[] = TOPOLOGY.hexes.map((h) => px(h.center.x, h.center.y))
export const HEX_POINTS: string[] = TOPOLOGY.hexes.map((h) =>
  h.vertices.map((v) => `${VERTEX_POS[v].x.toFixed(1)},${VERTEX_POS[v].y.toFixed(1)}`).join(' '),
)
export const EDGE_ENDS: [Point, Point][] = TOPOLOGY.edges.map((e) => [
  VERTEX_POS[e.vertices[0]],
  VERTEX_POS[e.vertices[1]],
])

/** 港の目印の位置：海岸の辺の外側 */
export function portMarker(edge: number): Point {
  const hex = TOPOLOGY.edges[edge].hexes[0]
  const c = HEX_CENTER[hex]
  const [a, b] = EDGE_ENDS[edge]
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const dx = m.x - c.x
  const dy = m.y - c.y
  const len = Math.hypot(dx, dy)
  const out = 1.5 * S
  return { x: c.x + (dx / len) * out, y: c.y + (dy / len) * out }
}

/** 海（盤面を囲む六角形） */
export const SEA_POINTS = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i
  const r = 5.35 * S
  return `${(Math.cos(angle) * r).toFixed(1)},${(Math.sin(angle) * r).toFixed(1)}`
}).join(' ')

export const VIEW_BOX = `${-5.5 * S} ${-5.0 * S} ${11 * S} ${10 * S}`
