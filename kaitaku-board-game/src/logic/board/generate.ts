import { NUMBER_POOL, PORT_POOL, RED_NUMBERS, TERRAIN_POOL } from '../constants.ts'
import { shuffle } from '../rng.ts'
import type { HexId, PortKind, Port, Rng, Terrain, Tile } from '../types.ts'
import { TOPOLOGY } from './topology.ts'

export interface BoardLayout {
  tiles: Tile[]
  ports: Port[]
  robber: HexId
}

export type BoardType = 'random' | 'beginner'

const MAX_NUMBER_ATTEMPTS = 10_000

/** 6 と 8（赤い数字）同士が隣接していないか */
export function redNumbersSeparated(tiles: Tile[]): boolean {
  return TOPOLOGY.hexes.every((hex) => {
    if (!RED_NUMBERS.includes(tiles[hex.id].number ?? 0)) return true
    return hex.neighbors.every((n) => !RED_NUMBERS.includes(tiles[n].number ?? 0))
  })
}

function withPorts(kinds: PortKind[]): Port[] {
  return TOPOLOGY.portEdges.map((edge, i) => ({ edge, kind: kinds[i] }))
}

function desertOf(tiles: Tile[]): HexId {
  return tiles.findIndex((t) => t.terrain === 'desert')
}

/** ランダム配置：地形・港・数字チップをシャッフル。6/8 が隣接したら数字を引き直す */
export function generateRandomBoard(rng: Rng): BoardLayout {
  const terrains = shuffle(rng, TERRAIN_POOL)
  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
    const numbers = shuffle(rng, NUMBER_POOL)
    let k = 0
    const tiles: Tile[] = terrains.map((terrain) => ({
      terrain,
      number: terrain === 'desert' ? null : numbers[k++],
    }))
    if (redNumbersSeparated(tiles)) {
      return { tiles, ports: withPorts(shuffle(rng, PORT_POOL)), robber: desertOf(tiles) }
    }
  }
  throw new Error('数字チップの配置に失敗しました')
}

// 初心者用の固定配置（自作）。HexId 順 = 上の行から、各行は左から。砂漠は中央
// prettier-ignore
const BEGINNER_TILES: [Terrain, number | null][] = [
  ['mountains', 10], ['pasture', 2], ['forest', 9],
  ['fields', 12], ['hills', 6], ['pasture', 4], ['hills', 10],
  ['fields', 9], ['forest', 11], ['desert', null], ['forest', 3], ['mountains', 8],
  ['mountains', 3], ['fields', 4], ['pasture', 6], ['fields', 5],
  ['forest', 8], ['pasture', 11], ['hills', 5],
]

const BEGINNER_PORTS: PortKind[] = ['any', 'sheep', 'any', 'ore', 'wheat', 'any', 'brick', 'any', 'wood']

export function generateBeginnerBoard(): BoardLayout {
  const tiles = BEGINNER_TILES.map(([terrain, number]) => ({ terrain, number }))
  return { tiles, ports: withPorts(BEGINNER_PORTS), robber: desertOf(tiles) }
}

export function generateBoard(type: BoardType, rng: Rng): BoardLayout {
  return type === 'beginner' ? generateBeginnerBoard() : generateRandomBoard(rng)
}
