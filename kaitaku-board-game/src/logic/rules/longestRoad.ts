import { LONGEST_ROAD_MIN } from '../constants.ts'
import { TOPOLOGY, otherEnd } from '../board/topology.ts'
import type { EdgeId, GameState, PlayerId, VertexId } from '../types.ts'

/**
 * player の一続きの道の最大長。
 * 同じ辺は2度通らない。他人の開拓地/都市がある交差点は通り抜けられない（そこで止まる）。
 */
export function longestRoadLength(state: GameState, player: PlayerId): number {
  const blocked = (v: VertexId) => {
    const b = state.buildings[v]
    return b !== null && b.owner !== player
  }
  const used = new Set<EdgeId>()

  const walk = (vertex: VertexId): number => {
    let best = 0
    for (const e of TOPOLOGY.vertices[vertex].edges) {
      if (state.roads[e] !== player || used.has(e)) continue
      const next = otherEnd(e, vertex)
      used.add(e)
      best = Math.max(best, 1 + (blocked(next) ? 0 : walk(next)))
      used.delete(e)
    }
    return best
  }

  // 出発点は通り抜けないので、他人の建物がある交差点からでも出発できる
  const starts = new Set<VertexId>()
  state.roads.forEach((owner, e) => {
    if (owner === player) TOPOLOGY.edges[e].vertices.forEach((v) => starts.add(v))
  })
  let best = 0
  for (const v of starts) best = Math.max(best, walk(v))
  return best
}

/**
 * 全員の長さを再計算し、SPEC 11章のルールで保持者を決める。
 * - 保持者が（同率でも）1位なら維持
 * - それ以外は、5本以上の単独1位がいればその人。同率複数・5本未満なら誰のものでもない
 */
export function updateLongestRoad(state: GameState): void {
  const lengths = state.players.map((_, p) => longestRoadLength(state, p))
  const max = Math.max(...lengths)
  const prev = state.longestRoad.holder
  let holder: PlayerId | null
  if (max < LONGEST_ROAD_MIN) {
    holder = null
  } else if (prev !== null && lengths[prev] === max) {
    holder = prev
  } else {
    const leaders = lengths.flatMap((len, p) => (len === max ? [p] : []))
    holder = leaders.length === 1 ? leaders[0] : null
  }
  state.longestRoad = { holder, lengths }
  if (holder !== prev) state.log.push({ kind: 'longestRoad', player: holder })
}
