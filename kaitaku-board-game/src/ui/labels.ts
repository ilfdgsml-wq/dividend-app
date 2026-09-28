import type {
  DevCardType,
  GameState,
  LogEntry,
  PlayerId,
  PortKind,
  Resource,
  ResourceCounts,
  Terrain,
} from '../logic/index.ts'
import { RESOURCES } from '../logic/index.ts'

export const RESOURCE_LABEL: Record<Resource, string> = {
  wood: '木材',
  brick: 'レンガ',
  sheep: '羊毛',
  wheat: '小麦',
  ore: '鉄鉱石',
}

export const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛰️',
}

export const TERRAIN_LABEL: Record<Terrain, string> = {
  forest: '森',
  hills: '丘陵',
  pasture: '牧草地',
  fields: '畑',
  mountains: '山地',
  desert: '砂漠',
}

export const TERRAIN_EMOJI: Record<Terrain, string> = {
  forest: '🌲',
  hills: '🧱',
  pasture: '🐑',
  fields: '🌾',
  mountains: '⛰️',
  desert: '🏜️',
}

export const TERRAIN_COLOR: Record<Terrain, string> = {
  forest: '#3f8f46',
  hills: '#c9683f',
  pasture: '#9fd36a',
  fields: '#f0c850',
  mountains: '#9aa0a6',
  desert: '#e9d7a6',
}

export const DEV_LABEL: Record<DevCardType, string> = {
  knight: '騎士',
  roadBuilding: '街道建設',
  yearOfPlenty: '収穫',
  monopoly: '独占',
  victoryPoint: '勝利点',
}

export const DEV_EMOJI: Record<DevCardType, string> = {
  knight: '⚔️',
  roadBuilding: '🛤️',
  yearOfPlenty: '🎁',
  monopoly: '💰',
  victoryPoint: '🏆',
}

export const DEV_DESCRIPTION: Record<DevCardType, string> = {
  knight: '盗賊を移動し、そのタイルに建物がある人から1枚奪う',
  roadBuilding: '道を2本無料で置く',
  yearOfPlenty: '銀行から好きな資源を2枚もらう',
  monopoly: '資源を1種類指定し、他の全員からその資源を全部もらう',
  victoryPoint: '1点（自動で数えます）',
}

export function portLabel(kind: PortKind): string {
  return kind === 'any' ? '3:1' : `${RESOURCE_EMOJI[kind]}2:1`
}

export const PLAYER_COLORS = ['#e53935', '#1e88e5', '#fb8c00', '#8e24aa']

/** 資源の組み合わせを「🌲2 🧱1」のように */
export function formatCounts(c: ResourceCounts): string {
  const parts = RESOURCES.filter((r) => c[r] > 0).map((r) => `${RESOURCE_EMOJI[r]}${c[r]}`)
  return parts.length > 0 ? parts.join(' ') : 'なし'
}

const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
export function diceFace(n: number): string {
  return DICE[n - 1] ?? '?'
}

/** ログ1行分の文章。viewer に見えない情報（奪われた資源）は伏せる */
export function formatLog(entry: LogEntry, state: GameState, viewer: PlayerId | null): string | null {
  const name = (p: PlayerId) => state.players[p]?.name ?? '?'
  switch (entry.kind) {
    case 'start':
      return `${name(entry.player)}さんがスタートプレイヤーです`
    case 'setupSettlement':
      return `${name(entry.player)}さんが開拓地を置きました`
    case 'setupRoad':
      return null
    case 'setupResources':
      return `${name(entry.player)}さんが初期資源 ${formatCounts(entry.gains)} を受け取りました`
    case 'turnStart':
      return `── ${name(entry.player)}さんの手番（${entry.turn}手目）`
    case 'roll':
      return `${name(entry.player)}さんのサイコロ：${diceFace(entry.dice[0])}${diceFace(entry.dice[1])} = ${entry.dice[0] + entry.dice[1]}`
    case 'produce': {
      const lines = entry.gains.flatMap((g, p) =>
        RESOURCES.some((r) => g[r] > 0) ? [`${name(p)} ${formatCounts(g)}`] : [],
      )
      const short =
        entry.shortage.length > 0 ? `（銀行不足：${entry.shortage.map((r) => RESOURCE_LABEL[r]).join('・')}）` : ''
      return lines.length > 0 ? `産出：${lines.join(' / ')}${short}` : `産出なし${short}`
    }
    case 'discard':
      return `${name(entry.player)}さんが${entry.count}枚捨てました`
    case 'robber':
      return `${name(entry.player)}さんが盗賊を移動しました`
    case 'steal': {
      const seen = viewer !== null && entry.visibleTo.includes(viewer)
      if (entry.resource === null) return `${name(entry.player)}さんは${name(entry.target)}さんから何も奪えませんでした`
      const what = seen ? `${RESOURCE_EMOJI[entry.resource]}${RESOURCE_LABEL[entry.resource]}を` : ''
      return `${name(entry.player)}さんが${name(entry.target)}さんから${what}1枚奪いました`
    }
    case 'build': {
      const what = { road: '道', settlement: '開拓地', city: '都市' }[entry.what]
      return `${name(entry.player)}さんが${what}を建設しました${entry.free ? '（無料）' : ''}`
    }
    case 'buyDev':
      return `${name(entry.player)}さんが発展カードを買いました`
    case 'playDev':
      return `${name(entry.player)}さんが「${DEV_LABEL[entry.card]}」を使いました`
    case 'yearOfPlenty':
      return `${name(entry.player)}さんが ${entry.resources.map((r) => RESOURCE_EMOJI[r]).join('')} を受け取りました`
    case 'monopoly':
      return `${name(entry.player)}さんが${RESOURCE_EMOJI[entry.resource]}${RESOURCE_LABEL[entry.resource]}を${entry.count}枚集めました`
    case 'bankTrade':
      return `${name(entry.player)}さんが海上交易：${formatCounts(entry.give)} → ${formatCounts(entry.get)}`
    case 'trade':
      return `${name(entry.player)}さんと${name(entry.partner)}さんが交易：${formatCounts(entry.give)} ⇄ ${formatCounts(entry.get)}`
    case 'longestRoad':
      return entry.player === null
        ? '最長交易路は誰のものでもなくなりました'
        : `${name(entry.player)}さんが最長交易路（2点）を獲得しました`
    case 'largestArmy':
      return `${name(entry.player)}さんが最大騎士力（2点）を獲得しました`
    case 'win':
      return `🎉 ${name(entry.player)}さんが${entry.points}点で勝利しました！`
  }
}
