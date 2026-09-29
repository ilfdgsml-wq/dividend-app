import type { BuildingKind, DevCardType, PortKind, Resource, ResourceCounts, Terrain } from './types.ts'

export const WINNING_POINTS = 10
export const BANK_PER_RESOURCE = 19
export const LONGEST_ROAD_MIN = 5
export const LARGEST_ARMY_MIN = 3
export const DISCARD_THRESHOLD = 8
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

export const PIECE_LIMITS: Record<BuildingKind | 'road', number> = {
  settlement: 5,
  city: 4,
  road: 15,
}

export function counts(partial: Partial<ResourceCounts> = {}): ResourceCounts {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...partial }
}

export const COSTS = {
  road: counts({ brick: 1, wood: 1 }),
  settlement: counts({ brick: 1, wood: 1, sheep: 1, wheat: 1 }),
  city: counts({ ore: 3, wheat: 2 }),
  devCard: counts({ ore: 1, sheep: 1, wheat: 1 }),
} as const

export const DEV_DECK_COMPOSITION: Record<DevCardType, number> = {
  knight: 14,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
  victoryPoint: 5,
}

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  forest: 'wood',
  hills: 'brick',
  pasture: 'sheep',
  fields: 'wheat',
  mountains: 'ore',
  desert: null,
}

export const TERRAIN_POOL: Terrain[] = [
  ...Array<Terrain>(4).fill('forest'),
  ...Array<Terrain>(4).fill('pasture'),
  ...Array<Terrain>(4).fill('fields'),
  ...Array<Terrain>(3).fill('hills'),
  ...Array<Terrain>(3).fill('mountains'),
  'desert',
]

export const NUMBER_POOL = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]

export const PORT_POOL: PortKind[] = ['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore']

/** 数字チップの出やすさ（2個のサイコロでその目が出る組み合わせ数） */
export function pips(n: number): number {
  return 6 - Math.abs(7 - n)
}

export const RED_NUMBERS = [6, 8]

/** 席順ごとのプレイヤーの色 */
export const PLAYER_COLORS = ['#e53935', '#1e88e5', '#fb8c00', '#8e24aa']
