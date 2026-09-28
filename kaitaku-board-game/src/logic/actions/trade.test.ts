import { describe, expect, it } from 'vitest'
import { TOPOLOGY } from '../board/topology.ts'
import { counts } from '../resources.ts'
import { tradeRates } from '../rules/ports.ts'
import { act, actError, mainPhase, put, setHand } from '../testing.ts'
import type { GameState, PortKind } from '../types.ts'

/** 指定した種類の港に接する交差点にプレイヤー0の開拓地を置く */
function onPort(s: GameState, kind: PortKind): void {
  const port = s.ports.find((p) => p.kind === kind)!
  put(s, TOPOLOGY.edges[port.edge].vertices[0], 0)
}

describe('海上交易', () => {
  it('港がなければ常に4:1', () => {
    let s = mainPhase()
    setHand(s, 0, { wood: 4 })
    expect(tradeRates(s, 0)).toEqual({ wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 })
    s = act(s, { type: 'bankTrade', give: counts({ wood: 4 }), get: counts({ ore: 1 }) }, 0)
    expect(s.players[0].resources).toEqual(counts({ ore: 1 }))
    expect(s.bank.wood).toBe(23)
    expect(s.bank.ore).toBe(18)
  })

  it('3:1港に建物があれば、どの資源も3枚→1枚', () => {
    let s = mainPhase()
    onPort(s, 'any')
    setHand(s, 0, { sheep: 3 })
    expect(tradeRates(s, 0)).toEqual({ wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 3 })
    s = act(s, { type: 'bankTrade', give: counts({ sheep: 3 }), get: counts({ brick: 1 }) }, 0)
    expect(s.players[0].resources).toEqual(counts({ brick: 1 }))
  })

  it('2:1専用港はその資源だけ2:1（他の資源は4:1のまま）', () => {
    const s = mainPhase()
    onPort(s, 'sheep')
    expect(tradeRates(s, 0)).toEqual({ wood: 4, brick: 4, sheep: 2, wheat: 4, ore: 4 })
  })

  it('2:1港と3:1港の両方があれば、それ以外の資源は3:1', () => {
    const s = mainPhase()
    onPort(s, 'ore')
    onPort(s, 'any')
    expect(tradeRates(s, 0)).toEqual({ wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 2 })
  })

  it('複数口まとめて交換できる（鉄2:1港で鉄4枚→任意2枚）', () => {
    let s = mainPhase()
    onPort(s, 'ore')
    setHand(s, 0, { ore: 4 })
    s = act(s, { type: 'bankTrade', give: counts({ ore: 4 }), get: counts({ wood: 1, wheat: 1 }) }, 0)
    expect(s.players[0].resources).toEqual(counts({ wood: 1, wheat: 1 }))
  })

  it('枚数の単位・受け取る枚数・同じ資源・手札・銀行の在庫を検証する', () => {
    const s = mainPhase()
    setHand(s, 0, { wood: 8, ore: 1 })
    const trade = (give: object, get: object) =>
      actError(s, { type: 'bankTrade', give: counts(give), get: counts(get) }, 0)
    expect(trade({ wood: 3 }, { ore: 1 })).toMatch('4枚単位')
    expect(trade({ wood: 8 }, { ore: 1 })).toMatch('受け取れるのは2枚')
    expect(trade({ wood: 4 }, { wood: 1 })).toMatch('同じ資源')
    expect(trade({ brick: 4 }, { ore: 1 })).toMatch('手札が足りません')
    expect(trade({}, { ore: 1 })).toMatch('タダ')
    s.bank.sheep = 0
    expect(trade({ wood: 4 }, { sheep: 1 })).toMatch('銀行')
  })

  it('自分の手番の交易・建設中のみ', () => {
    const s = mainPhase()
    setHand(s, 0, { wood: 4 })
    setHand(s, 1, { wood: 4 })
    expect(actError(s, { type: 'bankTrade', give: counts({ wood: 4 }), get: counts({ ore: 1 }) }, 1)).toMatch('手番')
    s.phase = { type: 'preRoll' }
    expect(actError(s, { type: 'bankTrade', give: counts({ wood: 4 }), get: counts({ ore: 1 }) }, 0)).toMatch(
      'サイコロを振る前',
    )
  })

  it('建てたばかりの開拓地の港もその手番中に使える', () => {
    let s = mainPhase()
    const port = s.ports.find((p) => p.kind === 'any')!
    const [v, w] = TOPOLOGY.edges[port.edge].vertices
    const inland = TOPOLOGY.vertices[w].edges.find((e) => e !== port.edge)!
    put(
      s,
      TOPOLOGY.edges[inland].vertices.find((x) => x !== w)!,
      0,
    )
    s.roads[inland] = 0
    s.roads[port.edge] = 0
    setHand(s, 0, { wood: 4, brick: 1, sheep: 1, wheat: 1 })
    s = act(s, { type: 'buildSettlement', vertex: v }, 0)
    s = act(s, { type: 'bankTrade', give: counts({ wood: 3 }), get: counts({ ore: 1 }) }, 0)
    expect(s.players[0].resources).toEqual(counts({ ore: 1 }))
  })
})

describe('プレイヤー間交易', () => {
  function ready() {
    const s = mainPhase()
    setHand(s, 0, { wood: 2 })
    setHand(s, 1, { ore: 1 })
    setHand(s, 2, { ore: 3 })
    return s
  }
  const offer = { type: 'proposeTrade', give: counts({ wood: 2 }), get: counts({ ore: 1 }) } as const

  it('提案 → 相手が承認 → 手番プレイヤーが確定で成立', () => {
    let s = act(ready(), offer, 0)
    expect(s.trade?.responses).toEqual([null, { status: 'pending' }, { status: 'pending' }, { status: 'pending' }])
    s = act(s, { type: 'respondTrade', accept: true }, 1)
    s = act(s, { type: 'respondTrade', accept: false }, 2)
    expect(actError(s, { type: 'confirmTrade', partner: 2 }, 0)).toMatch('応じていません')
    expect(actError(s, { type: 'confirmTrade', partner: 3 }, 0)).toMatch('応じていません')
    s = act(s, { type: 'confirmTrade', partner: 1 }, 0)
    expect(s.players[0].resources).toEqual(counts({ ore: 1 }))
    expect(s.players[1].resources).toEqual(counts({ wood: 2 }))
    expect(s.trade).toBeNull()
  })

  it('手番プレイヤーとだけ交易できる（手番以外は提案・確定できない）', () => {
    const s = ready()
    expect(actError(s, { ...offer }, 1)).toMatch('手番ではありません')
    const t = act(s, offer, 0)
    const accepted = act(t, { type: 'respondTrade', accept: true }, 1)
    expect(actError(accepted, { type: 'confirmTrade', partner: 1 }, 2)).toMatch('手番ではありません')
    expect(actError(t, { type: 'respondTrade', accept: true }, 0)).toMatch('自分の提案')
  })

  it('タダであげる・同じ資源同士の交換は禁止', () => {
    const s = ready()
    expect(actError(s, { type: 'proposeTrade', give: counts({ wood: 1 }), get: counts() }, 0)).toMatch('タダ')
    expect(actError(s, { type: 'proposeTrade', give: counts(), get: counts({ ore: 1 }) }, 0)).toMatch('タダ')
    expect(
      actError(s, { type: 'proposeTrade', give: counts({ wood: 2 }), get: counts({ wood: 1, ore: 1 }) }, 0),
    ).toMatch('同じ資源')
  })

  it('持っていない資源は提案・承認できない', () => {
    const s = ready()
    expect(actError(s, { type: 'proposeTrade', give: counts({ wood: 3 }), get: counts({ ore: 1 }) }, 0)).toMatch(
      '手札が足りません',
    )
    const t = act(s, offer, 0)
    expect(actError(t, { type: 'respondTrade', accept: true }, 3)).toMatch('手札が足りません')
  })

  it('対案を出せて、手番プレイヤーが選べば対案の条件で成立', () => {
    let s = act(ready(), offer, 0)
    // プレイヤー2の対案：木材1枚で鉄鉱石2枚を渡す（手番プレイヤーから見て give 木材1 / get 鉄2）
    s = act(s, { type: 'counterTrade', give: counts({ wood: 1 }), get: counts({ ore: 2 }) }, 2)
    expect(s.trade?.responses[2]?.status).toBe('countered')
    s = act(s, { type: 'confirmTrade', partner: 2 }, 0)
    expect(s.players[0].resources).toEqual(counts({ wood: 1, ore: 2 }))
    expect(s.players[2].resources).toEqual(counts({ wood: 1, ore: 1 }))
  })

  it('手番プレイヤーが取り下げたら不成立。手番終了でも消える', () => {
    let s = act(ready(), offer, 0)
    s = act(s, { type: 'respondTrade', accept: true }, 1)
    const cancelled = act(s, { type: 'cancelTrade' }, 0)
    expect(cancelled.trade).toBeNull()
    expect(actError(cancelled, { type: 'confirmTrade', partner: 1 }, 0)).toMatch('提案がありません')
    expect(act(s, { type: 'endTurn' }, 0).trade).toBeNull()
  })

  it('確定時に手札が足りなくなっていれば成立しない', () => {
    let s = act(ready(), offer, 0)
    s = act(s, { type: 'respondTrade', accept: true }, 1)
    s.players[1].resources = counts()
    expect(actError(s, { type: 'confirmTrade', partner: 1 }, 0)).toMatch('相手の手札')
  })
})
