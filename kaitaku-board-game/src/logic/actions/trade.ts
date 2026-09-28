// 交易（プレイヤー間・海上）。give/get は常に手番プレイヤーから見た向き。

import { hasAtLeast, isValidCounts, total, transfer } from '../resources.ts'
import { tradeRates } from '../rules/ports.ts'
import { RESOURCES, type GameState, type PlayerId, type ResourceCounts } from '../types.ts'
import { notYourTurn, wrongPhase } from './common.ts'

const RESOURCE_LABELS = { wood: '木材', brick: 'レンガ', sheep: '羊毛', wheat: '小麦', ore: '鉄鉱石' } as const

/** 交換条件そのものの妥当性（タダであげる・同じ資源同士を禁止） */
function termsError(give: ResourceCounts, get: ResourceCounts): string | null {
  if (!isValidCounts(give) || !isValidCounts(get)) return '交換する資源の指定が正しくありません'
  if (total(give) === 0 || total(get) === 0) return 'タダであげる・もらう交換はできません'
  if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return '同じ資源同士は交換できません'
  return null
}

export function bankTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceCounts,
  get: ResourceCounts,
): string | null {
  const err = notYourTurn(state, player) ?? wrongPhase(state, 'main') ?? termsError(give, get)
  if (err) return err
  const rates = tradeRates(state, player)
  let units = 0
  for (const r of RESOURCES) {
    if (give[r] % rates[r] !== 0) return `${RESOURCE_LABELS[r]}は${rates[r]}枚単位で出してください`
    units += give[r] / rates[r]
  }
  if (units !== total(get)) return `受け取れるのは${units}枚です`
  if (!hasAtLeast(state.players[player].resources, give)) return '手札が足りません'
  if (!hasAtLeast(state.bank, get)) return '銀行にその資源が足りません'

  transfer(state.players[player].resources, state.bank, give)
  transfer(state.bank, state.players[player].resources, get)
  state.log.push({ kind: 'bankTrade', player, give, get })
  return null
}

export function proposeTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceCounts,
  get: ResourceCounts,
): string | null {
  const err = notYourTurn(state, player) ?? wrongPhase(state, 'main') ?? termsError(give, get)
  if (err) return err
  if (!hasAtLeast(state.players[player].resources, give)) return '手札が足りません'
  state.trade = {
    give,
    get,
    responses: state.players.map((_, i) => (i === player ? null : { status: 'pending' })),
  }
  return null
}

function responderError(state: GameState, player: PlayerId): string | null {
  const err = wrongPhase(state, 'main')
  if (err) return err
  if (!state.trade) return '交易の提案がありません'
  if (player === state.currentPlayer) return '手番プレイヤーは自分の提案に返答できません'
  if (!state.trade.responses[player]) return 'その提案には返答できません'
  return null
}

export function respondTrade(state: GameState, player: PlayerId, accept: boolean): string | null {
  const err = responderError(state, player)
  if (err) return err
  const trade = state.trade!
  // 応じる側は、手番プレイヤーが受け取る分（get）を出す
  if (accept && !hasAtLeast(state.players[player].resources, trade.get)) return '手札が足りません'
  trade.responses[player] = { status: accept ? 'accepted' : 'rejected' }
  return null
}

export function counterTrade(
  state: GameState,
  player: PlayerId,
  give: ResourceCounts,
  get: ResourceCounts,
): string | null {
  const err = responderError(state, player) ?? termsError(give, get)
  if (err) return err
  if (!hasAtLeast(state.players[player].resources, get)) return '手札が足りません'
  state.trade!.responses[player] = { status: 'countered', counter: { give, get } }
  return null
}

export function confirmTrade(state: GameState, player: PlayerId, partner: PlayerId): string | null {
  const err = notYourTurn(state, player) ?? wrongPhase(state, 'main')
  if (err) return err
  const trade = state.trade
  if (!trade) return '交易の提案がありません'
  const response = trade.responses[partner]
  if (!response || (response.status !== 'accepted' && response.status !== 'countered')) {
    return 'その相手はまだ応じていません'
  }
  const terms = response.status === 'countered' && response.counter ? response.counter : trade
  const mine = state.players[player].resources
  const theirs = state.players[partner].resources
  if (!hasAtLeast(mine, terms.give)) return '手札が足りません'
  if (!hasAtLeast(theirs, terms.get)) return '相手の手札が足りません'

  transfer(mine, theirs, terms.give)
  transfer(theirs, mine, terms.get)
  state.log.push({ kind: 'trade', player, partner, give: terms.give, get: terms.get })
  state.trade = null
  return null
}

export function cancelTrade(state: GameState, player: PlayerId): string | null {
  const err = notYourTurn(state, player)
  if (err) return err
  if (!state.trade) return '交易の提案がありません'
  state.trade = null
  return null
}
