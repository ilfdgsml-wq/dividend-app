import { BANK_PER_RESOURCE, DEV_DECK_COMPOSITION, MAX_PLAYERS, MIN_PLAYERS } from './constants.ts'
import { generateBoard, type BoardType } from './board/generate.ts'
import { EDGE_COUNT, VERTEX_COUNT } from './board/topology.ts'
import { counts } from './resources.ts'
import { randomInt, shuffle } from './rng.ts'
import { RESOURCES, type DevCardType, type GameState, type Rng } from './types.ts'

export interface GameConfig {
  players: { name: string; color: string }[]
  board: BoardType
}

export function createGame(config: GameConfig, rng: Rng): GameState {
  const n = config.players.length
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error(`プレイ人数は${MIN_PLAYERS}〜${MAX_PLAYERS}人です`)

  const board = generateBoard(config.board, rng)
  const deck = shuffle(
    rng,
    (Object.entries(DEV_DECK_COMPOSITION) as [DevCardType, number][]).flatMap(([type, k]) =>
      Array<DevCardType>(k).fill(type),
    ),
  )
  // スタートプレイヤーは乱数で決める。1巡目は時計回り、2巡目は逆順（スネーク順）
  const start = randomInt(rng, n)
  const firstRound = Array.from({ length: n }, (_, i) => (start + i) % n)
  const order = [...firstRound, ...firstRound.slice().reverse()]

  const bank = counts()
  for (const r of RESOURCES) bank[r] = BANK_PER_RESOURCE

  return {
    tiles: board.tiles,
    ports: board.ports,
    robber: board.robber,
    buildings: Array(VERTEX_COUNT).fill(null),
    roads: Array(EDGE_COUNT).fill(null),
    players: config.players.map(({ name, color }) => ({
      name,
      color,
      resources: counts(),
      devCards: [],
      knightsPlayed: 0,
    })),
    bank,
    devDeck: deck,
    turn: 0,
    startPlayer: start,
    currentPlayer: start,
    phase: { type: 'setup', round: 1, step: 'settlement', order, index: 0, lastSettlement: null },
    devCardPlayedThisTurn: false,
    lastRoll: null,
    longestRoad: { holder: null, lengths: Array(n).fill(0) },
    largestArmy: { holder: null },
    trade: null,
    winner: null,
    log: [{ kind: 'start', player: start }],
  }
}
