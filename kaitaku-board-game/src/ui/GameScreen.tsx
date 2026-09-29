// 対戦画面（ホットシート・オンライン共通）。見ている人（viewer）から見た状態 PlayerView だけで描画する。

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  COSTS,
  hasAtLeast,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  TOPOLOGY,
  viewToState,
  type Action,
  type GameState,
  type LogEntry,
  type PlayerId,
  type PlayerView,
  type ResourceCounts,
} from '../logic/index.ts'
import { BoardSvg, type Selection, type Targets } from './board/BoardSvg.tsx'
import { Counts } from './components.tsx'
import { BankTradeDialog } from './dialogs/BankTradeDialog.tsx'
import { DevCardDialog } from './dialogs/DevCardDialog.tsx'
import { DiscardDialog } from './dialogs/DiscardDialog.tsx'
import { GameOverDialog } from './dialogs/GameOverDialog.tsx'
import { MenuDialog, type QuitOption } from './dialogs/MenuDialog.tsx'
import { StealDialog } from './dialogs/StealDialog.tsx'
import { RespondDialog, TradeDialog } from './dialogs/TradeDialog.tsx'
import type { Dispatch } from './dialogs/types.ts'
import { DEV_LABEL, RESOURCE_EMOJI, RESOURCE_LABEL, diceFace, formatLog } from './labels.ts'
import { Hand } from './panels/Hand.tsx'
import { LogPanel } from './panels/LogPanel.tsx'
import { PlayerList } from './panels/PlayerList.tsx'

type BuildMode = 'road' | 'settlement' | 'city'
type DialogName = 'trade' | 'bank' | 'dev' | 'menu'

/** モードごとの違い */
export type ModeProps =
  | {
      kind: 'hotseat'
      /** 交易の提案に答えている人 */
      responder: PlayerId | null
      onAskResponder: (p: PlayerId) => void
      onResponderDone: () => void
    }
  | { kind: 'online' }

interface Props {
  view: PlayerView
  viewer: PlayerId
  /** viewer として操作を送る。不正ならエラー文、成功なら null */
  send: (action: Action) => Promise<string | null>
  mode: ModeProps
  /** 画面全体を覆う表示（ホットシートの目隠し画面） */
  cover?: ReactNode
  /** メニューに出すモードごとの項目 */
  menuExtra?: ReactNode
  quit: QuitOption
  exitLabel: string
  onExit: () => void
}

function targetsFor(state: GameState, mode: BuildMode | null): Targets | null {
  const p = state.currentPlayer
  const phase = state.phase
  switch (phase.type) {
    case 'setup':
      return phase.step === 'settlement'
        ? { kind: 'vertex', ids: legalSettlementVertices(state, p, false) }
        : { kind: 'edge', ids: legalRoadEdges(state, p, phase.lastSettlement) }
    case 'moveRobber':
      return { kind: 'hex', ids: TOPOLOGY.hexes.map((h) => h.id).filter((h) => h !== state.robber) }
    case 'roadBuilding':
      return { kind: 'edge', ids: legalRoadEdges(state, p) }
    case 'main':
      if (mode === 'road') return { kind: 'edge', ids: legalRoadEdges(state, p) }
      if (mode === 'settlement') return { kind: 'vertex', ids: legalSettlementVertices(state, p, true) }
      if (mode === 'city') return { kind: 'vertex', ids: legalCityVertices(state, p) }
      return null
    default:
      return null
  }
}

/** 盤面で選んだ場所に対応する操作と、確認ボタンの文言 */
function actionFor(state: GameState, mode: BuildMode | null, sel: Selection): { action: Action; label: string } | null {
  const phase = state.phase
  if (phase.type === 'setup') {
    return sel.kind === 'vertex'
      ? { action: { type: 'placeSetupSettlement', vertex: sel.id }, label: 'ここに開拓地を置く' }
      : { action: { type: 'placeSetupRoad', edge: sel.id }, label: 'ここに道を置く' }
  }
  if (phase.type === 'moveRobber') return { action: { type: 'moveRobber', hex: sel.id }, label: 'ここに盗賊を移動する' }
  if (phase.type === 'roadBuilding')
    return { action: { type: 'placeFreeRoad', edge: sel.id }, label: 'ここに道を置く（無料）' }
  if (phase.type === 'main') {
    if (mode === 'road') return { action: { type: 'buildRoad', edge: sel.id }, label: 'ここに道を建設' }
    if (mode === 'settlement')
      return { action: { type: 'buildSettlement', vertex: sel.id }, label: 'ここに開拓地を建設' }
    if (mode === 'city') return { action: { type: 'buildCity', vertex: sel.id }, label: 'ここを都市にする' }
  }
  return null
}

function statusText(state: GameState, mode: BuildMode | null): string {
  const phase = state.phase
  switch (phase.type) {
    case 'setup':
      return phase.step === 'settlement'
        ? `初期配置${phase.round}巡目：開拓地を置く交差点を選んでください`
        : '初期配置：開拓地につながる道を置いてください'
    case 'preRoll':
      return 'サイコロを振ってください（発展カードも使えます）'
    case 'discard':
      return '7が出ました！手札が8枚以上の人は半分を捨てます'
    case 'moveRobber':
      return '盗賊を移動するタイルを選んでください'
    case 'steal':
      return '奪う相手を選んでください'
    case 'roadBuilding':
      return `街道建設：道を置く辺を選んでください（残り${phase.remaining}本）`
    case 'main':
      if (mode === 'road') return '道を置く辺を選んでください'
      if (mode === 'settlement') return '開拓地を建てる交差点を選んでください'
      if (mode === 'city') return '都市にする開拓地を選んでください'
      return '交易・建設ができます。終わったら「手番終了」'
    case 'gameOver':
      return 'ゲーム終了'
  }
}

/** 手番でない人向けの、いま何をしているかの説明（オンライン） */
function spectatorText(state: GameState): string {
  switch (state.phase.type) {
    case 'setup':
      return '初期配置中'
    case 'preRoll':
      return 'サイコロを振るところです'
    case 'discard':
      return '7が出ました！手札が8枚以上の人は半分を捨てます'
    case 'moveRobber':
      return '盗賊を移動しています'
    case 'steal':
      return '奪う相手を選んでいます'
    case 'roadBuilding':
      return '街道建設で道を置いています'
    case 'main':
      return '交易・建設中'
    case 'gameOver':
      return 'ゲーム終了'
  }
}

/** 新しく起きた出来事のうち、viewer に知らせるもの（奪った・奪われた資源、引いたカード、自分の番） */
function eventMessage(entries: LogEntry[], view: PlayerView, state: GameState, viewer: PlayerId, online: boolean) {
  let message: string | null = null
  for (const e of entries) {
    if (e.kind === 'steal' && e.visibleTo.includes(viewer)) message = formatLog(e, state, viewer)
    if (e.kind === 'buyDev' && e.player === viewer) {
      const card = view.players[viewer].devCards?.at(-1)
      if (card) message = `📜 「${DEV_LABEL[card.type]}」を引きました`
    }
    if (online && e.kind === 'turnStart' && e.player === viewer) message = '▶ あなたの番です'
    if (online && e.kind === 'trade' && e.partner === viewer) message = formatLog(e, state, viewer)
  }
  return message
}

interface Toast {
  id: number
  text: string
  error: boolean
  /** 出した手番。手番が変わったら表示しない（前の人向けの情報を次の人に見せない） */
  turn: number
}

export function GameScreen({ view, viewer, send, mode, cover, menuExtra, quit, exitLabel, onExit }: Props) {
  const state = useMemo(() => viewToState(view), [view])
  const [buildMode, setBuildMode] = useState<BuildMode | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissedOffer, setDismissedOffer] = useState<string | null>(null)

  const phase = state.phase
  const me = state.currentPlayer
  const online = mode.kind === 'online'
  const covered = cover != null
  const myTurn = viewer === me && !covered

  // 新しいログの出来事を通知（前回の描画から増えた分だけ）
  const logEnd = view.logStart + view.log.length
  const [seenLogEnd, setSeenLogEnd] = useState(logEnd)
  if (seenLogEnd !== logEnd) {
    setSeenLogEnd(logEnd)
    if (logEnd > seenLogEnd) {
      const fresh = view.log.slice(Math.max(0, seenLogEnd - view.logStart))
      const text = eventMessage(fresh, view, state, viewer, online)
      if (text) setToast({ id: (toast?.id ?? 0) + 1, text, error: false, turn: view.turn })
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 3500 : 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!online) return
    document.title = myTurn && phase.type !== 'gameOver' ? '▶ あなたの番｜開拓ボードゲーム' : '開拓ボードゲーム'
  }, [online, myTurn, phase.type])

  const dispatch: Dispatch = async (action) => {
    setBusy(true)
    try {
      const error = await send(action)
      if (error) {
        setToast({ id: (toast?.id ?? 0) + 1, text: error, error: true, turn: view.turn })
        return false
      }
      setSelection(null)
      return true
    } finally {
      setBusy(false)
    }
  }

  const mode_ = phase.type === 'main' ? buildMode : null
  const targets = myTurn && !(phase.type === 'main' && dialog) ? targetsFor(state, mode_) : null
  const validSelection =
    selection && targets?.kind === selection.kind && targets.ids.includes(selection.id) ? selection : null
  const pending = validSelection ? actionFor(state, mode_, validSelection) : null

  const confirmPending = async () => {
    if (!pending || busy) return
    if (await dispatch(pending.action)) setBuildMode(null)
  }

  const onSelect = (sel: Selection) => {
    // 同じ場所をもう一度タップしたら確定
    if (validSelection && validSelection.kind === sel.kind && validSelection.id === sel.id) void confirmPending()
    else setSelection(sel)
  }

  const hand = state.players[me].resources
  const can = (cost: ResourceCounts) => hasAtLeast(hand, cost)
  const toggleMode = (m: BuildMode) => {
    setSelection(null)
    setBuildMode(mode_ === m ? null : m)
  }

  const current = view.players[me]
  const rolled = state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : null
  const lastEvent = [...state.log]
    .reverse()
    .map((e) => formatLog(e, state, covered ? null : viewer))
    .find((t) => t !== null && !t.startsWith('──'))

  // 交易の提案への返答（オンラインは各自の端末で答える）
  const trade = state.trade
  const offerKey = trade ? JSON.stringify([trade.give, trade.get]) : null
  const myResponsePending = !!trade && viewer !== me && trade.responses[viewer]?.status === 'pending'
  const showRespond =
    mode.kind === 'hotseat'
      ? mode.responder === viewer && !!trade && !covered
      : myResponsePending && dismissedOffer !== offerKey
  const discardPending = phase.type === 'discard' ? phase.pending : null
  const waitingDiscard = discardPending
    ? discardPending.flatMap((n, p) => (n > 0 && p !== viewer ? [view.players[p].name] : []))
    : []

  // 表示するダイアログ（優先度順）
  let overlay: ReactNode = null
  if (phase.type === 'gameOver') {
    overlay = <GameOverDialog state={state} exitLabel={exitLabel} onExit={onExit} />
  } else if (cover) {
    overlay = cover
  } else if (discardPending && discardPending[viewer] > 0) {
    overlay = (
      <DiscardDialog
        key={`discard-${viewer}`}
        state={state}
        player={viewer}
        need={discardPending[viewer]}
        dispatch={dispatch}
      />
    )
  } else if (showRespond) {
    overlay = (
      <RespondDialog
        key={`respond-${viewer}:${offerKey}`}
        state={state}
        player={viewer}
        dispatch={dispatch}
        onDone={mode.kind === 'hotseat' ? mode.onResponderDone : () => {}}
        onClose={mode.kind === 'online' ? () => setDismissedOffer(offerKey) : undefined}
      />
    )
  } else if (phase.type === 'steal' && myTurn) {
    overlay = <StealDialog view={view} candidates={phase.candidates} dispatch={dispatch} />
  } else if (dialog === 'menu') {
    overlay = (
      <MenuDialog quit={quit} onClose={() => setDialog(null)}>
        {menuExtra}
      </MenuDialog>
    )
  } else if (myTurn && dialog === 'trade' && phase.type === 'main') {
    overlay = (
      <TradeDialog
        state={state}
        dispatch={dispatch}
        onClose={() => setDialog(null)}
        onAskResponder={mode.kind === 'hotseat' ? mode.onAskResponder : undefined}
      />
    )
  } else if (myTurn && dialog === 'bank' && phase.type === 'main') {
    overlay = <BankTradeDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} />
  } else if (myTurn && dialog === 'dev') {
    overlay = <DevCardDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} />
  }

  let waitingText = ''
  if (discardPending) {
    waitingText = waitingDiscard.length > 0 ? `${waitingDiscard.join('・')}さんが捨て札を選んでいます…` : ''
  } else if (myTurn && (phase.type === 'setup' || phase.type === 'moveRobber' || phase.type === 'roadBuilding')) {
    waitingText = '盤面の光っている場所をタップ（もう一度タップで確定）'
  } else if (online && !myTurn && phase.type !== 'gameOver') {
    waitingText = `${current.name}さんの番です`
  }

  const showToast = toast && !covered && phase.type !== 'gameOver' && (toast.error || toast.turn === view.turn)

  return (
    <div className="game" style={{ '--pc': current.color } as CSSProperties}>
      <header className="topbar">
        <h1>開拓ボードゲーム</h1>
        <div className="bank" title="銀行の残り">
          🏦{' '}
          {(['wood', 'brick', 'sheep', 'wheat', 'ore'] as const).map((r) => (
            <span key={r} title={RESOURCE_LABEL[r]}>
              {RESOURCE_EMOJI[r]}
              {state.bank[r]}
            </span>
          ))}
          <span title="発展カードの山札">📜{view.devDeckCount}</span>
        </div>
        <button className="icon-button" onClick={() => setDialog('menu')} aria-label="メニュー">
          ☰
        </button>
      </header>

      <div className="layout">
        <div className="board-area">
          <div className="status">
            <div className="status-main">
              <span className="status-name">
                {current.name}
                {online && myTurn && <small>（あなた）</small>}
              </span>
              <span>{online && !myTurn ? spectatorText(state) : statusText(state, mode_)}</span>
            </div>
            {state.lastRoll && (
              <div className="dice" aria-label={`出目 ${rolled}`}>
                {diceFace(state.lastRoll[0])}
                {diceFace(state.lastRoll[1])}
                <span className="dice-sum">{rolled}</span>
              </div>
            )}
          </div>
          <BoardSvg
            state={state}
            targets={targets}
            selected={validSelection}
            onSelect={onSelect}
            rolled={phase.type === 'main' || phase.type === 'roadBuilding' ? rolled : null}
          />
          {lastEvent && <div className="last-event">{lastEvent}</div>}
        </div>

        <div className="side">
          <PlayerList view={view} viewer={covered ? null : viewer} you={online ? viewer : null} />
          {!covered && <Hand state={state} viewer={viewer} />}

          <div
            className={
              myTurn && (pending || phase.type === 'preRoll' || phase.type === 'main')
                ? 'action-bar sticky'
                : 'action-bar'
            }
          >
            {pending && myTurn ? (
              <div className="confirm">
                <button className="primary" disabled={busy} onClick={() => void confirmPending()}>
                  {pending.label}
                </button>
                <button onClick={() => setSelection(null)}>選び直す</button>
              </div>
            ) : myTurn && phase.type === 'preRoll' ? (
              <div className="buttons">
                <button className="primary big" disabled={busy} onClick={() => void dispatch({ type: 'rollDice' })}>
                  🎲 サイコロを振る
                </button>
                <button onClick={() => setDialog('dev')}>🃏 カードを使う</button>
              </div>
            ) : myTurn && phase.type === 'main' ? (
              <div className="buttons grid">
                <BuildButton
                  label="🛣️ 道"
                  cost={COSTS.road}
                  active={mode_ === 'road'}
                  disabled={!can(COSTS.road) || legalRoadEdges(state, me).length === 0}
                  onClick={() => toggleMode('road')}
                />
                <BuildButton
                  label="🏠 開拓地"
                  cost={COSTS.settlement}
                  active={mode_ === 'settlement'}
                  disabled={!can(COSTS.settlement) || legalSettlementVertices(state, me, true).length === 0}
                  onClick={() => toggleMode('settlement')}
                />
                <BuildButton
                  label="🏙️ 都市"
                  cost={COSTS.city}
                  active={mode_ === 'city'}
                  disabled={!can(COSTS.city) || legalCityVertices(state, me).length === 0}
                  onClick={() => toggleMode('city')}
                />
                <BuildButton
                  label="📜 カード購入"
                  cost={COSTS.devCard}
                  disabled={busy || !can(COSTS.devCard) || view.devDeckCount === 0}
                  onClick={() => void dispatch({ type: 'buyDevCard' })}
                />
                <button onClick={() => setDialog('dev')}>🃏 カードを使う</button>
                <button onClick={() => setDialog('trade')} className={trade ? 'attention' : undefined}>
                  🤝 交易{trade ? '（提案中）' : ''}
                </button>
                <button onClick={() => setDialog('bank')}>⚓ 海上交易</button>
                <button className="end-turn" disabled={busy} onClick={() => void dispatch({ type: 'endTurn' })}>
                  ⏭ 手番終了
                </button>
              </div>
            ) : online && myResponsePending && !showRespond ? (
              <div className="buttons">
                <button className="primary" onClick={() => setDismissedOffer(null)}>
                  📨 {current.name}さんからの交易の提案に答える
                </button>
              </div>
            ) : (
              <div className="waiting">{waitingText}</div>
            )}
          </div>

          <LogPanel state={state} logStart={view.logStart} viewer={covered ? null : viewer} />
        </div>
      </div>

      {overlay}
      {showToast && (
        <div key={`toast-${toast.id}`} className={toast.error ? 'toast error' : 'toast'} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}

function BuildButton({
  label,
  cost,
  active,
  disabled,
  onClick,
}: {
  label: string
  cost: ResourceCounts
  active?: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button className={active ? 'build active' : 'build'} disabled={disabled && !active} onClick={onClick}>
      <span>{label}</span>
      <small>
        <Counts value={cost} />
      </small>
    </button>
  )
}
