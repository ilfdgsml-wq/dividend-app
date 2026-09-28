import { TOPOLOGY } from '../board/topology.ts'
import { RESOURCES, type GameState, type PlayerId, type PortKind, type Resource } from '../types.ts'

/** player の建物が接している港の種類 */
export function portsOf(state: GameState, player: PlayerId): PortKind[] {
  return state.ports
    .filter((port) => TOPOLOGY.edges[port.edge].vertices.some((v) => state.buildings[v]?.owner === player))
    .map((port) => port.kind)
}

/** 資源ごとの海上交易レート（4:1 / 3:1 / 2:1） */
export function tradeRates(state: GameState, player: PlayerId): Record<Resource, number> {
  const kinds = portsOf(state, player)
  const generic = kinds.includes('any') ? 3 : 4
  const rates = {} as Record<Resource, number>
  for (const r of RESOURCES) rates[r] = kinds.includes(r) ? 2 : generic
  return rates
}
