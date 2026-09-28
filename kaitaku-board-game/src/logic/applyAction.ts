import { placeSetupRoad, placeSetupSettlement } from './actions/setup.ts'
import { rollDice } from './actions/dice.ts'
import { discard, moveRobber, steal } from './actions/robber.ts'
import { buildCity, buildRoad, buildSettlement, buyDevCard } from './actions/build.ts'
import { playKnight, placeFreeRoad, playMonopoly, playRoadBuilding, playYearOfPlenty } from './actions/devCards.ts'
import { bankTrade, cancelTrade, confirmTrade, counterTrade, proposeTrade, respondTrade } from './actions/trade.ts'
import { endTurn } from './actions/turn.ts'
import { checkVictory } from './rules/victory.ts'
import type { Action, ActionResult, GameState, PlayerId, Rng } from './types.ts'

/** draft をその場で変更する。不正なら理由を返す */
function dispatch(draft: GameState, action: Action, player: PlayerId, rng: Rng): string | null {
  switch (action.type) {
    case 'placeSetupSettlement':
      return placeSetupSettlement(draft, player, action.vertex)
    case 'placeSetupRoad':
      return placeSetupRoad(draft, player, action.edge)
    case 'rollDice':
      return rollDice(draft, player, rng)
    case 'discard':
      return discard(draft, player, action.resources)
    case 'moveRobber':
      return moveRobber(draft, player, action.hex, rng)
    case 'steal':
      return steal(draft, player, action.target, rng)
    case 'buildRoad':
      return buildRoad(draft, player, action.edge)
    case 'buildSettlement':
      return buildSettlement(draft, player, action.vertex)
    case 'buildCity':
      return buildCity(draft, player, action.vertex)
    case 'buyDevCard':
      return buyDevCard(draft, player)
    case 'playKnight':
      return playKnight(draft, player)
    case 'playRoadBuilding':
      return playRoadBuilding(draft, player)
    case 'placeFreeRoad':
      return placeFreeRoad(draft, player, action.edge)
    case 'playYearOfPlenty':
      return playYearOfPlenty(draft, player, action.resources)
    case 'playMonopoly':
      return playMonopoly(draft, player, action.resource)
    case 'bankTrade':
      return bankTrade(draft, player, action.give, action.get)
    case 'proposeTrade':
      return proposeTrade(draft, player, action.give, action.get)
    case 'respondTrade':
      return respondTrade(draft, player, action.accept === true)
    case 'counterTrade':
      return counterTrade(draft, player, action.give, action.get)
    case 'confirmTrade':
      return confirmTrade(draft, player, action.partner)
    case 'cancelTrade':
      return cancelTrade(draft, player)
    case 'endTurn':
      return endTurn(draft, player)
    default:
      return '不明な操作です'
  }
}

/**
 * ゲームの唯一の入口。純粋関数：引数の state は変更せず、新しい state を返す。
 * 不正な操作なら元の state と理由を返す。乱数は rng で受け取る。
 */
export function applyAction(state: GameState, action: Action, player: PlayerId, rng: Rng): ActionResult {
  if (state.phase.type === 'gameOver') return { state, error: 'ゲームは終了しています' }
  if (!Number.isInteger(player) || player < 0 || player >= state.players.length) {
    return { state, error: 'プレイヤーの指定が正しくありません' }
  }
  if (typeof action !== 'object' || action === null) return { state, error: '不明な操作です' }

  const draft = structuredClone(state)
  const error = dispatch(draft, action, player, rng)
  if (error) return { state, error }
  checkVictory(draft)
  return { state: draft, error: null }
}
