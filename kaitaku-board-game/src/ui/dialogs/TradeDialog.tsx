import { useState, type CSSProperties } from 'react'
import { counts, total, RESOURCES, type GameState, type PlayerId, type ResourceCounts } from '../../logic/index.ts'
import { Counts, ResourceStepper, Sheet } from '../components.tsx'
import type { Dispatch } from './types.ts'

/** 渡す／もらうの入力欄。give = 自分が渡す、get = 自分がもらう */
function TermsEditor({
  hand,
  give,
  get,
  onChange,
}: {
  hand: ResourceCounts
  give: ResourceCounts
  get: ResourceCounts
  onChange: (give: ResourceCounts, get: ResourceCounts) => void
}) {
  return (
    <div className="terms">
      <div>
        <h3>渡す</h3>
        <ResourceStepper value={give} onChange={(g) => onChange(g, get)} max={(r) => (get[r] > 0 ? 0 : hand[r])} />
      </div>
      <div>
        <h3>もらう</h3>
        <ResourceStepper value={get} onChange={(g) => onChange(give, g)} max={(r) => (give[r] > 0 ? 0 : 19)} />
      </div>
    </div>
  )
}

const valid = (give: ResourceCounts, get: ResourceCounts) =>
  total(give) > 0 && total(get) > 0 && RESOURCES.every((r) => give[r] === 0 || get[r] === 0)

/** 手番プレイヤーの交易画面：提案の作成と、各プレイヤーの返答の確認 */
export function TradeDialog({
  state,
  dispatch,
  onClose,
  onAskResponder,
}: {
  state: GameState
  dispatch: Dispatch
  onClose: () => void
  onAskResponder: (p: PlayerId) => void
}) {
  const me = state.currentPlayer
  const [give, setGive] = useState(counts())
  const [get, setGet] = useState(counts())
  const trade = state.trade
  const confirm = (partner: PlayerId) => {
    if (dispatch({ type: 'confirmTrade', partner }, me)) onClose()
  }

  if (!trade) {
    return (
      <Sheet title="プレイヤーと交易" onClose={onClose}>
        <p className="muted">手番のプレイヤーとだけ交易できます。タダであげる・同じ資源同士の交換はできません。</p>
        <TermsEditor
          hand={state.players[me].resources}
          give={give}
          get={get}
          onChange={(g, t) => {
            setGive(g)
            setGet(t)
          }}
        />
        <div className="sheet-actions">
          <button
            className="primary"
            disabled={!valid(give, get)}
            onClick={() => dispatch({ type: 'proposeTrade', give, get }, me)}
          >
            みんなに提案する
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="交易の提案中" onClose={onClose}>
      <p className="offer">
        渡す <Counts value={trade.give} /> ⇄ もらう <Counts value={trade.get} />
      </p>
      <ul className="responses">
        {trade.responses.map((res, p) => {
          if (!res) return null
          const player = state.players[p]
          return (
            <li key={p} style={{ '--pc': player.color } as CSSProperties}>
              <span className="response-name">{player.name}</span>
              {res.status === 'pending' && <button onClick={() => onAskResponder(p)}>{player.name}さんが答える</button>}
              {res.status === 'rejected' && (
                <>
                  <span className="muted">断りました</span>
                  <button className="link" onClick={() => onAskResponder(p)}>
                    もう一度聞く
                  </button>
                </>
              )}
              {res.status === 'accepted' && (
                <button className="primary" onClick={() => confirm(p)}>
                  応じてくれました：交換する
                </button>
              )}
              {res.status === 'countered' && res.counter && (
                <div className="counter">
                  <span>
                    対案：渡す <Counts value={res.counter.give} /> ⇄ もらう <Counts value={res.counter.get} />
                  </span>
                  <button className="primary" onClick={() => confirm(p)}>
                    対案で交換する
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="sheet-actions">
        <button onClick={() => dispatch({ type: 'cancelTrade' }, me)}>提案を取り下げる</button>
      </div>
    </Sheet>
  )
}

/** 手番以外のプレイヤーが提案に答える画面（その人の目線で「渡す／もらう」を表示） */
export function RespondDialog({
  state,
  player,
  dispatch,
  onDone,
}: {
  state: GameState
  player: PlayerId
  dispatch: Dispatch
  onDone: () => void
}) {
  const trade = state.trade!
  const proposer = state.players[state.currentPlayer]
  const hand = state.players[player].resources
  const [countering, setCountering] = useState(false)
  // 自分目線：渡す = 手番プレイヤーがもらう分
  const [myGive, setMyGive] = useState(trade.get)
  const [myGet, setMyGet] = useState(trade.give)

  const respond = (accept: boolean) => {
    if (dispatch({ type: 'respondTrade', accept }, player)) onDone()
  }

  return (
    <Sheet title={`${state.players[player].name}さん：交易の提案`}>
      <p>
        {proposer.name}さんからの提案：あなたが渡す <Counts value={trade.get} /> ⇄ あなたがもらう{' '}
        <Counts value={trade.give} />
      </p>
      {!countering ? (
        <div className="sheet-actions">
          <button className="primary" onClick={() => respond(true)}>
            応じる
          </button>
          <button onClick={() => setCountering(true)}>対案を出す</button>
          <button onClick={() => respond(false)}>断る</button>
        </div>
      ) : (
        <>
          <TermsEditor
            hand={hand}
            give={myGive}
            get={myGet}
            onChange={(g, t) => {
              setMyGive(g)
              setMyGet(t)
            }}
          />
          <div className="sheet-actions">
            <button
              className="primary"
              disabled={!valid(myGive, myGet)}
              onClick={() => {
                // 手番プレイヤー目線に直して送る
                if (dispatch({ type: 'counterTrade', give: myGet, get: myGive }, player)) onDone()
              }}
            >
              対案を出す
            </button>
            <button onClick={() => setCountering(false)}>戻る</button>
          </div>
        </>
      )}
    </Sheet>
  )
}
