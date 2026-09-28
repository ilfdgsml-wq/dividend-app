// 建設できる場所の判定。applyAction の検証と、UI のハイライト表示の両方で使う。

import { PIECE_LIMITS } from '../constants.ts'
import { EDGE_COUNT, TOPOLOGY, VERTEX_COUNT } from '../board/topology.ts'
import type { BuildingKind, EdgeId, GameState, PlayerId, VertexId } from '../types.ts'

export function piecesUsed(state: GameState, player: PlayerId): Record<BuildingKind | 'road', number> {
  let settlement = 0
  let city = 0
  for (const b of state.buildings) {
    if (b?.owner !== player) continue
    if (b.kind === 'settlement') settlement++
    else city++
  }
  const road = state.roads.filter((o) => o === player).length
  return { settlement, city, road }
}

export function piecesLeft(state: GameState, player: PlayerId, kind: BuildingKind | 'road'): number {
  return PIECE_LIMITS[kind] - piecesUsed(state, player)[kind]
}

/** 距離ルール：その交差点と、隣接する交差点すべてが空いていること */
export function satisfiesDistanceRule(state: GameState, vertex: VertexId): boolean {
  if (state.buildings[vertex] !== null) return false
  return TOPOLOGY.vertices[vertex].neighbors.every((n) => state.buildings[n] === null)
}

function isValidVertex(v: unknown): v is VertexId {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < VERTEX_COUNT
}

function isValidEdge(e: unknown): e is EdgeId {
  return Number.isInteger(e) && (e as number) >= 0 && (e as number) < EDGE_COUNT
}

/** 開拓地を置けない理由（置けるなら null）。requireRoad = 自分の道に接している必要があるか */
export function settlementError(
  state: GameState,
  player: PlayerId,
  vertex: VertexId,
  requireRoad: boolean,
): string | null {
  if (!isValidVertex(vertex)) return '交差点の指定が正しくありません'
  if (state.buildings[vertex] !== null) return 'その交差点にはすでに建物があります'
  if (!satisfiesDistanceRule(state, vertex)) return '距離ルールにより置けません（隣の交差点に建物があります）'
  if (requireRoad && !TOPOLOGY.vertices[vertex].edges.some((e) => state.roads[e] === player)) {
    return '自分の道につながっていない交差点には置けません'
  }
  if (piecesLeft(state, player, 'settlement') <= 0) return '開拓地の駒が残っていません'
  return null
}

/** 頂点 v から、player の道を延ばせるか（自分の建物がある、または他人の建物がなく自分の道が接している） */
function canExtendFrom(state: GameState, player: PlayerId, vertex: VertexId, except: EdgeId): boolean {
  const b = state.buildings[vertex]
  if (b !== null) return b.owner === player
  return TOPOLOGY.vertices[vertex].edges.some((e) => e !== except && state.roads[e] === player)
}

/** 道を置けない理由（置けるなら null）。setupVertex を渡すと「その開拓地に接する辺」だけを許可 */
export function roadError(
  state: GameState,
  player: PlayerId,
  edge: EdgeId,
  setupVertex: VertexId | null = null,
): string | null {
  if (!isValidEdge(edge)) return '辺の指定が正しくありません'
  if (state.roads[edge] !== null) return 'その辺にはすでに道があります'
  if (piecesLeft(state, player, 'road') <= 0) return '道の駒が残っていません'
  const [a, b] = TOPOLOGY.edges[edge].vertices
  if (setupVertex !== null) {
    if (a !== setupVertex && b !== setupVertex) return '今置いた開拓地に接する辺を選んでください'
    return null
  }
  if (!canExtendFrom(state, player, a, edge) && !canExtendFrom(state, player, b, edge)) {
    return '自分の道・建物につながっていない辺には置けません'
  }
  return null
}

export function cityError(state: GameState, player: PlayerId, vertex: VertexId): string | null {
  if (!isValidVertex(vertex)) return '交差点の指定が正しくありません'
  const b = state.buildings[vertex]
  if (b === null || b.owner !== player || b.kind !== 'settlement') return '都市にできるのは自分の開拓地だけです'
  if (piecesLeft(state, player, 'city') <= 0) return '都市の駒が残っていません'
  return null
}

export function legalSettlementVertices(state: GameState, player: PlayerId, requireRoad: boolean): VertexId[] {
  return TOPOLOGY.vertices.map((v) => v.id).filter((v) => settlementError(state, player, v, requireRoad) === null)
}

export function legalRoadEdges(state: GameState, player: PlayerId, setupVertex: VertexId | null = null): EdgeId[] {
  return TOPOLOGY.edges.map((e) => e.id).filter((e) => roadError(state, player, e, setupVertex) === null)
}

export function legalCityVertices(state: GameState, player: PlayerId): VertexId[] {
  return TOPOLOGY.vertices.map((v) => v.id).filter((v) => cityError(state, player, v) === null)
}
