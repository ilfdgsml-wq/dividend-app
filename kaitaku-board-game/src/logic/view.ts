// 非公開情報を伏せた「そのプレイヤーから見た状態」。フェーズ2でサーバーから配る形。

import { total } from './resources.ts'
import { victoryPoints } from './rules/victory.ts'
import type { DevCard, GameState, LogEntry, PlayerId, ResourceCounts } from './types.ts'

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
}

/** viewer = null は観戦者（誰の手札も見えない） */
export function viewFor(state: GameState, viewer: PlayerId | null): PlayerView {
  const reveal = state.phase.type === 'gameOver'
  const { devDeck, players, log, ...rest } = state
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
    log: log.map((e): LogEntry => redact(e, viewer)),
  }
}

function redact(entry: LogEntry, viewer: PlayerId | null): LogEntry {
  if (entry.kind === 'steal' && (viewer === null || !entry.visibleTo.includes(viewer))) {
    return { ...entry, resource: null }
  }
  return structuredClone(entry)
}
