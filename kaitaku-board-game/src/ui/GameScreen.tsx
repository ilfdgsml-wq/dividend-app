import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  applyAction,
  COSTS,
  hasAtLeast,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  TOPOLOGY,
  type Action,
  type GameState,
  type PlayerId,
  type ResourceCounts,
} from '../logic/index.ts'
import { BoardSvg, type Selection, type Targets } from './board/BoardSvg.tsx'
import { Counts } from './components.tsx'
import { BankTradeDialog } from './dialogs/BankTradeDialog.tsx'
import { DevCardDialog } from './dialogs/DevCardDialog.tsx'
import { DiscardDialog } from './dialogs/DiscardDialog.tsx'
import { GameOverDialog } from './dialogs/GameOverDialog.tsx'
import { MenuDialog } from './dialogs/MenuDialog.tsx'
import { StealDialog } from './dialogs/StealDialog.tsx'
import { RespondDialog, TradeDialog } from './dialogs/TradeDialog.tsx'
import { HandoffScreen } from './HandoffScreen.tsx'
import { DEV_LABEL, RESOURCE_EMOJI, RESOURCE_LABEL, diceFace, formatLog } from './labels.ts'
import { Hand } from './panels/Hand.tsx'
import { LogPanel } from './panels/LogPanel.tsx'
import { PlayerList } from './panels/PlayerList.tsx'
import { saveGame, type SavedGame, type Settings } from './storage.ts'

type BuildMode = 'road' | 'settlement' | 'city'
type DialogName = 'trade' | 'bank' | 'dev' | 'menu'

/** 今この端末を操作すべき人（捨て札中は捨てる人、交易の返答中は答える人） */
function actorOf(state: GameState, responder: PlayerId | null): PlayerId {
  const phase = state.phase
  if (phase.type === 'discard') {
    const n = state.players.length
    for (let i = 0; i < n; i++) {
      const p = (state.currentPlayer + i) % n
      if (phase.pending[p] > 0) return p
    }
  }
  if (responder !== null && state.trade) return responder
  return state.currentPlayer
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

export function GameScreen({ initial, onQuit }: { initial: SavedGame; onQuit: () => void }) {
  const [state, setState] = useState(initial.state)
  const [settings, setSettings] = useState<Settings>(initial.settings)
  const [viewerRaw, setViewer] = useState<PlayerId>(() => actorOf(initial.state, null))
  const [responder, setResponder] = useState<PlayerId | null>(null)
  const [mode, setMode] = useState<BuildMode | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [toast, setToast] = useState<{ text: string; error: boolean; id: number } | null>(null)

  useEffect(() => saveGame({ state, settings }), [state, settings])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 3500 : 2500)
    return () => clearTimeout(t)
  }, [toast])

  const phase = state.phase
  const actor = actorOf(state, responder)
  // 初期配置中は隠す情報がないので、目隠し画面を出さない
  const privacy = settings.privacy && phase.type !== 'setup' && phase.type !== 'gameOver'
  const viewer = privacy ? viewerRaw : actor
  const handoff = privacy && viewerRaw !== actor
  const me = state.currentPlayer
  const myTurn = viewer === me && !handoff

  const notify = (text: string, error = false) => setToast({ text, error, id: Date.now() })

  const dispatch = (action: Action, player: PlayerId): boolean => {
    const result = applyAction(state, action, player, Math.random)
    if (result.error) {
      notify(result.error, true)
      return false
    }
    const next = result.state
    setState(next)
    setSelection(null)
    // 手番が変わるときは、前の人向けの通知（奪った資源など）を消す
    if (next.currentPlayer !== state.currentPlayer) setToast(null)
    if (next.phase.type !== 'main') setMode(null)
    if (action.type === 'buyDevCard') {
      const card = next.players[player].devCards.at(-1)
      if (card) notify(`📜 「${DEV_LABEL[card.type]}」を引きました`)
    }
    const last = next.log.at(-1)
    if (last?.kind === 'steal' && next.log.length > state.log.length) {
      notify(formatLog(last, next, player) ?? '')
    }
    return true
  }

  const targets = myTurn && !(phase.type === 'main' && dialog) ? targetsFor(state, mode) : null
  const pending = selection ? actionFor(state, mode, selection) : null

  const onSelect = (sel: Selection) => {
    if (selection && selection.kind === sel.kind && selection.id === sel.id && pending) {
      // 同じ場所をもう一度タップしたら確定
      dispatch(pending.action, me)
      if (phase.type === 'main') setMode(null)
      return
    }
    setSelection(sel)
  }

  const hand = state.players[me].resources
  const can = (cost: ResourceCounts) => hasAtLeast(hand, cost)
  const toggleMode = (m: BuildMode) => {
    setSelection(null)
    setMode(mode === m ? null : m)
  }

  const current = state.players[me]
  const rolled = state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : null
  const lastEvent = [...state.log]
    .reverse()
    .map((e) => formatLog(e, state, viewer))
    .find((t) => t !== null && !t.startsWith('──'))

  // 表示するダイアログ（優先度順）
  let overlay: ReactNode = null
  if (phase.type === 'gameOver') {
    overlay = <GameOverDialog state={state} onNewGame={onQuit} />
  } else if (handoff) {
    overlay = (
      <HandoffScreen
        state={state}
        player={actor}
        reason={phase.type === 'discard' ? 'discard' : responder !== null ? 'trade' : 'turn'}
        onReady={() => {
          setToast(null)
          setViewer(actor)
        }}
      />
    )
  } else if (phase.type === 'discard' && phase.pending[viewer] > 0) {
    overlay = (
      <DiscardDialog key={viewer} state={state} player={viewer} need={phase.pending[viewer]} dispatch={dispatch} />
    )
  } else if (responder !== null && state.trade && viewer === responder) {
    overlay = (
      <RespondDialog
        key={responder}
        state={state}
        player={responder}
        dispatch={dispatch}
        onDone={() => setResponder(null)}
      />
    )
  } else if (phase.type === 'steal' && myTurn) {
    overlay = <StealDialog state={state} candidates={phase.candidates} dispatch={dispatch} />
  } else if (dialog === 'menu') {
    overlay = (
      <MenuDialog settings={settings} onChangeSettings={setSettings} onQuit={onQuit} onClose={() => setDialog(null)} />
    )
  } else if (myTurn && dialog === 'trade' && phase.type === 'main') {
    overlay = (
      <TradeDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} onAskResponder={setResponder} />
    )
  } else if (myTurn && dialog === 'bank' && phase.type === 'main') {
    overlay = <BankTradeDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} />
  } else if (myTurn && dialog === 'dev') {
    overlay = <DevCardDialog state={state} dispatch={dispatch} onClose={() => setDialog(null)} />
  }

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
          <span title="発展カードの山札">📜{state.devDeck.length}</span>
        </div>
        <button className="icon-button" onClick={() => setDialog('menu')} aria-label="メニュー">
          ☰
        </button>
      </header>

      <div className="layout">
        <div className="board-area">
          <div className="status">
            <div className="status-main">
              <span className="status-name">{current.name}</span>
              <span>{statusText(state, mode)}</span>
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
            selected={selection}
            onSelect={onSelect}
            rolled={phase.type === 'main' || phase.type === 'roadBuilding' ? rolled : null}
          />
          {lastEvent && <div className="last-event">{lastEvent}</div>}
        </div>

        <div className="side">
          <PlayerList state={state} viewer={handoff ? null : viewer} />
          {!handoff && <Hand state={state} viewer={viewer} />}

          <div
            className={
              myTurn && (pending || phase.type === 'preRoll' || phase.type === 'main')
                ? 'action-bar sticky'
                : 'action-bar'
            }
          >
            {pending && myTurn ? (
              <div className="confirm">
                <button
                  className="primary"
                  onClick={() => {
                    dispatch(pending.action, me)
                    if (phase.type === 'main') setMode(null)
                  }}
                >
                  {pending.label}
                </button>
                <button onClick={() => setSelection(null)}>選び直す</button>
              </div>
            ) : myTurn && phase.type === 'preRoll' ? (
              <div className="buttons">
                <button className="primary big" onClick={() => dispatch({ type: 'rollDice' }, me)}>
                  🎲 サイコロを振る
                </button>
                <button onClick={() => setDialog('dev')}>🃏 カードを使う</button>
              </div>
            ) : myTurn && phase.type === 'main' ? (
              <div className="buttons grid">
                <BuildButton
                  label="🛣️ 道"
                  cost={COSTS.road}
                  active={mode === 'road'}
                  disabled={!can(COSTS.road) || legalRoadEdges(state, me).length === 0}
                  onClick={() => toggleMode('road')}
                />
                <BuildButton
                  label="🏠 開拓地"
                  cost={COSTS.settlement}
                  active={mode === 'settlement'}
                  disabled={!can(COSTS.settlement) || legalSettlementVertices(state, me, true).length === 0}
                  onClick={() => toggleMode('settlement')}
                />
                <BuildButton
                  label="🏙️ 都市"
                  cost={COSTS.city}
                  active={mode === 'city'}
                  disabled={!can(COSTS.city) || legalCityVertices(state, me).length === 0}
                  onClick={() => toggleMode('city')}
                />
                <BuildButton
                  label="📜 カード購入"
                  cost={COSTS.devCard}
                  disabled={!can(COSTS.devCard) || state.devDeck.length === 0}
                  onClick={() => dispatch({ type: 'buyDevCard' }, me)}
                />
                <button onClick={() => setDialog('dev')}>🃏 カードを使う</button>
                <button onClick={() => setDialog('trade')} className={state.trade ? 'attention' : undefined}>
                  🤝 交易{state.trade ? '（提案中）' : ''}
                </button>
                <button onClick={() => setDialog('bank')}>⚓ 海上交易</button>
                <button className="end-turn" onClick={() => dispatch({ type: 'endTurn' }, me)}>
                  ⏭ 手番終了
                </button>
              </div>
            ) : (
              <div className="waiting">
                {phase.type === 'discard'
                  ? '捨て札を選んでいます…'
                  : phase.type === 'setup' || phase.type === 'moveRobber' || phase.type === 'roadBuilding'
                    ? '盤面の光っている場所をタップ（もう一度タップで確定）'
                    : ''}
              </div>
            )}
          </div>

          <LogPanel state={state} viewer={handoff ? null : viewer} />
        </div>
      </div>

      {overlay}
      {toast && !handoff && phase.type !== 'gameOver' && (
        <div key={toast.id} className={toast.error ? 'toast error' : 'toast'} role="status">
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
