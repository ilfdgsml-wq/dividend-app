// ゲーム状態・アクションの型定義。状態はすべて素の JSON（Map/Set/クラスを使わない）。

export type PlayerId = number
export type HexId = number
export type VertexId = number
export type EdgeId = number

export const RESOURCES = ['wood', 'brick', 'sheep', 'wheat', 'ore'] as const
export type Resource = (typeof RESOURCES)[number]
export type ResourceCounts = Record<Resource, number>

export type Terrain = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'desert'
export type DevCardType = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint'
/** 'any' = 3:1 の汎用港、資源名 = その資源の 2:1 港 */
export type PortKind = Resource | 'any'
export type BuildingKind = 'settlement' | 'city'

export interface Tile {
  terrain: Terrain
  /** 砂漠は null */
  number: number | null
}

export interface Port {
  edge: EdgeId
  kind: PortKind
}

export interface Building {
  owner: PlayerId
  kind: BuildingKind
}

export interface DevCard {
  type: DevCardType
  /** 購入した手番の通算番号。同じ手番には使えない */
  boughtTurn: number
}

export interface PlayerState {
  name: string
  color: string
  /** 非公開（枚数のみ公開） */
  resources: ResourceCounts
  /** 未使用の発展カード。非公開（枚数のみ公開） */
  devCards: DevCard[]
  knightsPlayed: number
}

/** サイコロ前に発展カードを使った場合、処理後にサイコロ前へ戻るための行き先 */
export type ResumePhase = 'preRoll' | 'main'

export type Phase =
  | {
      type: 'setup'
      round: 1 | 2
      step: 'settlement' | 'road'
      /** スネーク順の手番列（長さ = 人数 × 2） */
      order: PlayerId[]
      index: number
      lastSettlement: VertexId | null
    }
  | { type: 'preRoll' }
  | {
      type: 'discard'
      /** PlayerId ごとの捨てる残り枚数（0 = 済み／対象外） */
      pending: number[]
    }
  | { type: 'moveRobber'; resume: ResumePhase }
  | { type: 'steal'; candidates: PlayerId[]; resume: ResumePhase }
  | { type: 'main' }
  | { type: 'roadBuilding'; remaining: number; resume: ResumePhase }
  | { type: 'gameOver' }

export type TradeResponseStatus = 'pending' | 'accepted' | 'rejected' | 'countered'

export interface TradeResponse {
  status: TradeResponseStatus
  /** 対案（手番プレイヤーから見た「渡す／受け取る」） */
  counter?: { give: ResourceCounts; get: ResourceCounts }
}

/** 手番プレイヤーの交易提案。give/get は常に手番プレイヤーから見た向き */
export interface TradeOffer {
  give: ResourceCounts
  get: ResourceCounts
  /** PlayerId ごとの返答。手番プレイヤー自身は null */
  responses: (TradeResponse | null)[]
}

export type LogEntry =
  | { kind: 'start'; player: PlayerId }
  | { kind: 'setupSettlement'; player: PlayerId; vertex: VertexId }
  | { kind: 'setupRoad'; player: PlayerId; edge: EdgeId }
  | { kind: 'setupResources'; player: PlayerId; gains: ResourceCounts }
  | { kind: 'turnStart'; player: PlayerId; turn: number }
  | { kind: 'roll'; player: PlayerId; dice: [number, number] }
  | { kind: 'produce'; gains: ResourceCounts[]; shortage: Resource[] }
  | { kind: 'discard'; player: PlayerId; count: number }
  | { kind: 'robber'; player: PlayerId; hex: HexId }
  | { kind: 'steal'; player: PlayerId; target: PlayerId; resource: Resource | null; visibleTo: PlayerId[] }
  | { kind: 'build'; player: PlayerId; what: 'road' | 'settlement' | 'city'; free?: boolean }
  | { kind: 'buyDev'; player: PlayerId }
  | { kind: 'playDev'; player: PlayerId; card: Exclude<DevCardType, 'victoryPoint'> }
  | { kind: 'yearOfPlenty'; player: PlayerId; resources: [Resource, Resource] }
  | { kind: 'monopoly'; player: PlayerId; resource: Resource; count: number }
  | { kind: 'bankTrade'; player: PlayerId; give: ResourceCounts; get: ResourceCounts }
  | { kind: 'trade'; player: PlayerId; partner: PlayerId; give: ResourceCounts; get: ResourceCounts }
  | { kind: 'longestRoad'; player: PlayerId | null }
  | { kind: 'largestArmy'; player: PlayerId }
  | { kind: 'win'; player: PlayerId; points: number }

export interface GameState {
  tiles: Tile[]
  ports: Port[]
  robber: HexId
  buildings: (Building | null)[]
  roads: (PlayerId | null)[]

  players: PlayerState[]
  bank: ResourceCounts
  /** シャッフル済み。末尾が山札の一番上。非公開 */
  devDeck: DevCardType[]

  /** 通算手番数（初期配置中は 0） */
  turn: number
  startPlayer: PlayerId
  currentPlayer: PlayerId
  phase: Phase
  devCardPlayedThisTurn: boolean
  lastRoll: [number, number] | null

  longestRoad: { holder: PlayerId | null; lengths: number[] }
  largestArmy: { holder: PlayerId | null }
  trade: TradeOffer | null

  winner: PlayerId | null
  log: LogEntry[]
}

export type Action =
  | { type: 'placeSetupSettlement'; vertex: VertexId }
  | { type: 'placeSetupRoad'; edge: EdgeId }
  | { type: 'rollDice' }
  | { type: 'discard'; resources: ResourceCounts }
  | { type: 'moveRobber'; hex: HexId }
  | { type: 'steal'; target: PlayerId }
  | { type: 'buildRoad'; edge: EdgeId }
  | { type: 'buildSettlement'; vertex: VertexId }
  | { type: 'buildCity'; vertex: VertexId }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'placeFreeRoad'; edge: EdgeId }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: ResourceCounts; get: ResourceCounts }
  | { type: 'proposeTrade'; give: ResourceCounts; get: ResourceCounts }
  | { type: 'respondTrade'; accept: boolean }
  | { type: 'counterTrade'; give: ResourceCounts; get: ResourceCounts }
  | { type: 'confirmTrade'; partner: PlayerId }
  | { type: 'cancelTrade' }
  | { type: 'endTurn' }

export interface ActionResult {
  state: GameState
  /** 不正な操作なら理由（日本語）。成功時は null */
  error: string | null
}

/** [0, 1) の乱数を返す関数。ロジックは乱数を必ずこれ経由で受け取る */
export type Rng = () => number
