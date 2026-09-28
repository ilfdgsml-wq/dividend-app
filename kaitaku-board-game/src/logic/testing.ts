// テスト用の補助関数（本番コードからは使わない）

import { applyAction } from './applyAction.ts'
import { createGame } from './createGame.ts'
import { TOPOLOGY, edgeBetween, otherEnd } from './board/topology.ts'
import type { BoardType } from './board/generate.ts'
import { counts } from './resources.ts'
import { seededRng } from './rng.ts'
import type {
  Action,
  BuildingKind,
  EdgeId,
  GameState,
  PlayerId,
  ResourceCounts,
  Rng,
  VertexId,
} from './types.ts'

export const COLORS = ['#d33', '#36c', '#e90', '#393']

export function newGame(n = 4, board: BoardType = 'beginner', seed = 1): GameState {
  return createGame(
    { players: COLORS.slice(0, n).map((color, i) => ({ name: `P${i}`, color })), board },
    seededRng(seed),
  )
}

/** 初期配置を飛ばして、プレイヤー0の「交易・建設」フェーズから始まる状態 */
export function mainPhase(n = 4): GameState {
  const s = newGame(n)
  s.phase = { type: 'main' }
  s.turn = 1
  s.startPlayer = 0
  s.currentPlayer = 0
  return s
}

export function act(state: GameState, action: Action, player: PlayerId, rng: Rng = seededRng(99)): GameState {
  const r = applyAction(state, action, player, rng)
  if (r.error) throw new Error(`想定外のエラー: ${r.error}`)
  return r.state
}

export function actError(state: GameState, action: Action, player: PlayerId, rng: Rng = seededRng(99)): string {
  const r = applyAction(state, action, player, rng)
  if (!r.error) throw new Error('エラーになるはずの操作が成功した')
  if (r.state !== state) throw new Error('エラー時は元の state を返すはず')
  return r.error
}

export function setHand(state: GameState, player: PlayerId, partial: Partial<ResourceCounts>): void {
  state.players[player].resources = counts(partial)
}

export function put(state: GameState, vertex: VertexId, owner: PlayerId, kind: BuildingKind = 'settlement'): void {
  state.buildings[vertex] = { owner, kind }
}

export function putRoads(state: GameState, edges: EdgeId[], owner: PlayerId): void {
  for (const e of edges) state.roads[e] = owner
}

/** 海岸沿いに連続する道。edges[i] は vertices[i] と vertices[i+1] を結ぶ */
export function coastalPath(start: number, length: number): { edges: EdgeId[]; vertices: VertexId[] } {
  const ring = TOPOLOGY.coastalEdges
  const edges = Array.from({ length }, (_, i) => ring[(start + i) % ring.length])
  if (length === 0) return { edges, vertices: [] }
  const [a, b] = TOPOLOGY.edges[edges[0]].vertices
  const first = length > 1 && TOPOLOGY.edges[edges[1]].vertices.includes(b) ? a : b
  const vertices = [first]
  for (const e of edges) vertices.push(otherEnd(e, vertices[vertices.length - 1]))
  return { edges, vertices }
}

/** avoid とその隣を避け、互いに隣接しない交差点を count 個選ぶ（点数を持たせるための建物置き場） */
export function spreadVertices(count: number, avoid: VertexId[] = []): VertexId[] {
  const blocked = new Set(avoid.flatMap((v) => [v, ...TOPOLOGY.vertices[v].neighbors]))
  const chosen: VertexId[] = []
  for (const v of TOPOLOGY.vertices) {
    if (chosen.length === count) break
    if (blocked.has(v.id)) continue
    chosen.push(v.id)
    for (const n of [v.id, ...v.neighbors]) blocked.add(n)
  }
  if (chosen.length < count) throw new Error('置き場所が足りない')
  return chosen
}

/** 頂点の列をたどる辺の列 */
export function pathThrough(vertices: VertexId[]): EdgeId[] {
  return vertices.slice(1).map((v, i) => {
    const e = edgeBetween(vertices[i], v)
    if (e === undefined) throw new Error(`頂点 ${vertices[i]} と ${v} は隣接していない`)
    return e
  })
}

/** [0,1) の値を返すと randomInt(rng, 6) + 1 がその目になるような値 */
export function die(face: number): number {
  return (face - 1) / 6 + 0.01
}
