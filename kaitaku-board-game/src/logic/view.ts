// 非公開情報を伏せた「そのプレイヤーから見た状態」。オンライン対戦ではサーバーがこれを各プレイヤーに配る。

import { counts, total } from './resources.ts'
import { victoryPoints } from './rules/victory.ts'
import type { DevCard, DevCardType, GameState, LogEntry, PlayerId, ResourceCounts } from './types.ts'

export interface PublicPlayer {
  name: string
  color: string
  resourceCount: number
  devCardCount: number
  knightsPlayed: number
  /** 他人に見える点数（非公開の勝利点カードを含まない） */
  publicPoints: number
  /** 本人（またはゲーム終了後）だけ中身が見える */
  resources: ResourceCounts | null
  devCards: DevCard[] | null
}

export interface PlayerView extends Omit<GameState, 'players' | 'devDeck'> {
  viewer: PlayerId | null
  players: PublicPlayer[]
  devDeckCount: number
  /** log[0] が元のログの何番目か（古いログを省いたとき 0 より大きくなる） */
  logStart: number
}

export interface ViewOptions {
  /** 新しい方からこの件数だけログを残す（通信量を抑えるため） */
  maxLog?: number
}

/** viewer = null は観戦者（誰の手札も見えない） */
export function viewFor(state: GameState, viewer: PlayerId | null, options: ViewOptions = {}): PlayerView {
  const reveal = state.phase.type === 'gameOver'
  const { devDeck, players, log, ...rest } = state
  const logStart = options.maxLog !== undefined ? Math.max(0, log.length - options.maxLog) : 0
  return {
    ...structuredClone(rest),
    viewer,
    devDeckCount: devDeck.length,
    players: players.map((p, i) => {
      const visible = reveal || i === viewer
      return {
        name: p.name,
        color: p.color,
        resourceCount: total(p.resources),
        devCardCount: p.devCards.length,
        knightsPlayed: p.knightsPlayed,
        publicPoints: victoryPoints(state, i, reveal),
        resources: visible ? { ...p.resources } : null,
        devCards: visible ? p.devCards.map((c) => ({ ...c })) : null,
      }
    }),
    logStart,
    log: log.slice(logStart).map((e): LogEntry => redact(e, viewer)),
  }
}

function redact(entry: LogEntry, viewer: PlayerId | null): LogEntry {
  if (entry.kind === 'steal' && (viewer === null || !entry.visibleTo.includes(viewer))) {
    return { ...entry, resource: null, visibleTo: [...entry.visibleTo] }
  }
  return structuredClone(entry)
}

/**
 * 見えている情報から、盤面の判定（置ける場所・交換レート・発展カードの使用可否など）に使える
 * GameState の形を作る。見えない手札は空、山札は枚数だけ合わせた仮の中身になるので、
 * 他人の手札の枚数や点数は PlayerView の方を使うこと。
 */
export function viewToState(view: PlayerView): GameState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { players, devDeckCount, viewer, logStart, ...rest } = view
  return {
    ...structuredClone(rest),
    devDeck: Array<DevCardType>(devDeckCount).fill('knight'),
    players: players.map((p) => ({
      name: p.name,
      color: p.color,
      resources: p.resources ? { ...p.resources } : counts(),
      devCards: p.devCards ? p.devCards.map((c) => ({ ...c })) : [],
      knightsPlayed: p.knightsPlayed,
    })),
  }
}
