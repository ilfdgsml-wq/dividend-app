import { describe, expect, it } from 'vitest'
import { TOPOLOGY } from '../board/topology.ts'
import { counts, total } from '../resources.ts'
import { seededRng, sequenceRng } from '../rng.ts'
import { act, actError, die, mainPhase, put, setHand } from '../testing.ts'
import type { GameState } from '../types.ts'

const SEVEN = () => sequenceRng([die(3), die(4)])

function beforeRoll(): GameState {
  const s = mainPhase()
  s.phase = { type: 'preRoll' }
  return s
}

/** 盗賊の移動先：盗賊がいない、指定プレイヤーの建物に接するタイル */
const HEX_A = 0
const HEX_B = 17

describe('7 が出たとき', () => {
  it('誰も資源を受け取らない', () => {
    let s = beforeRoll()
    s.tiles = s.tiles.map((t) => (t.number === null ? t : { ...t, number: 7 }))
    put(s, TOPOLOGY.hexes[HEX_A].vertices[0], 0)
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    expect(total(s.players[0].resources)).toBe(0)
  })

  it('8枚以上の人だけが半分（切り捨て）を捨てる：7枚→0、8枚→4、9枚→4', () => {
    let s = beforeRoll()
    setHand(s, 0, { wood: 7 })
    setHand(s, 1, { wood: 4, ore: 4 })
    setHand(s, 2, { sheep: 9 })
    setHand(s, 3, { wheat: 3 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    expect(s.phase).toEqual({ type: 'discard', pending: [0, 4, 4, 0] })
  })

  it('捨てる人がいなければ盗賊の移動へ', () => {
    let s = beforeRoll()
    setHand(s, 1, { wood: 7 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    expect(s.phase).toEqual({ type: 'moveRobber', resume: 'main' })
  })

  it('全員が捨て終わるまで先に進めない（順不同）', () => {
    let s = beforeRoll()
    setHand(s, 1, { wood: 4, ore: 4 })
    setHand(s, 2, { sheep: 9 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    expect(actError(s, { type: 'moveRobber', hex: HEX_A }, 0)).toMatch('捨て札の選択中')
    expect(actError(s, { type: 'endTurn' }, 0)).toMatch('捨て札の選択中')
    expect(actError(s, { type: 'buildRoad', edge: 0 }, 0)).toMatch('捨て札の選択中')

    s = act(s, { type: 'discard', resources: counts({ sheep: 4 }) }, 2)
    expect(s.phase.type).toBe('discard')
    expect(actError(s, { type: 'discard', resources: counts({ sheep: 1 }) }, 2)).toMatch('捨てる必要がありません')

    s = act(s, { type: 'discard', resources: counts({ wood: 1, ore: 3 }) }, 1)
    expect(s.players[1].resources).toEqual(counts({ wood: 3, ore: 1 }))
    expect(s.players[2].resources).toEqual(counts({ sheep: 5 }))
    expect(s.bank.sheep).toBe(19 + 4)
    expect(s.phase).toEqual({ type: 'moveRobber', resume: 'main' })
  })

  it('捨てる枚数が違う・持っていない資源は捨てられない・対象外の人は捨てられない', () => {
    let s = beforeRoll()
    setHand(s, 1, { wood: 4, ore: 4 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    expect(actError(s, { type: 'discard', resources: counts({ wood: 3 }) }, 1)).toMatch('ちょうど4枚')
    expect(actError(s, { type: 'discard', resources: counts({ wood: 5 }) }, 1)).toMatch('ちょうど4枚')
    expect(actError(s, { type: 'discard', resources: counts({ sheep: 4 }) }, 1)).toMatch('持っていない')
    expect(actError(s, { type: 'discard', resources: counts({ wood: 4 }) }, 0)).toMatch('捨てる必要がありません')
    expect(actError(s, { type: 'discard', resources: { ...counts(), wood: -1, ore: 5 } }, 1)).toMatch('正しくありません')
  })

  it('盗賊は今と別のタイルに必ず移動する（砂漠も可）', () => {
    let s = beforeRoll()
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    expect(actError(s, { type: 'moveRobber', hex: s.robber }, 0)).toMatch('別のタイル')
    expect(actError(s, { type: 'moveRobber', hex: 19 }, 0)).toMatch('タイルの指定')
    expect(actError(s, { type: 'moveRobber', hex: HEX_A }, 1)).toMatch('手番ではありません')
    expect(actError(s, { type: 'endTurn' }, 0)).toMatch('盗賊の移動中')
    const desert = s.robber
    s = act(s, { type: 'moveRobber', hex: HEX_A }, 0)
    expect(s.robber).toBe(HEX_A)
    expect(s.phase.type).toBe('main')
    // 次の 7 で砂漠へ戻すこともできる
    s.phase = { type: 'moveRobber', resume: 'main' }
    s = act(s, { type: 'moveRobber', hex: desert }, 0)
    expect(s.robber).toBe(desert)
  })

  it('対象が1人なら自動でランダムに1枚奪う（奪った資源は当事者だけに見える）', () => {
    let s = beforeRoll()
    put(s, TOPOLOGY.hexes[HEX_A].vertices[0], 1)
    put(s, TOPOLOGY.hexes[HEX_A].vertices[3], 0) // 自分の建物は対象外
    setHand(s, 1, { brick: 2, ore: 1 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    s = act(s, { type: 'moveRobber', hex: HEX_A }, 0, seededRng(5))
    expect(total(s.players[0].resources)).toBe(1)
    expect(total(s.players[1].resources)).toBe(2)
    const entry = s.log[s.log.length - 1]
    expect(entry.kind).toBe('steal')
    if (entry.kind === 'steal') {
      expect(entry.target).toBe(1)
      expect(s.players[0].resources[entry.resource!]).toBe(1)
      expect(entry.visibleTo).toEqual([0, 1])
    }
    expect(s.phase.type).toBe('main')
  })

  it('対象の手札が0枚なら何も得られない', () => {
    let s = beforeRoll()
    put(s, TOPOLOGY.hexes[HEX_A].vertices[0], 2)
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    s = act(s, { type: 'moveRobber', hex: HEX_A }, 0)
    expect(total(s.players[0].resources)).toBe(0)
    expect(s.phase.type).toBe('main')
  })

  it('対象がいなければ奪わない', () => {
    let s = beforeRoll()
    put(s, TOPOLOGY.hexes[HEX_A].vertices[0], 0)
    setHand(s, 1, { wood: 3 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    s = act(s, { type: 'moveRobber', hex: HEX_A }, 0)
    expect(s.phase.type).toBe('main')
    expect(s.log[s.log.length - 1].kind).toBe('robber')
  })

  it('対象が複数なら選ぶ。候補以外は選べない', () => {
    let s = beforeRoll()
    put(s, TOPOLOGY.hexes[HEX_B].vertices[0], 1)
    put(s, TOPOLOGY.hexes[HEX_B].vertices[3], 3, 'city')
    setHand(s, 1, { wood: 3 })
    setHand(s, 3, { ore: 2 })
    s = act(s, { type: 'rollDice' }, 0, SEVEN())
    s = act(s, { type: 'moveRobber', hex: HEX_B }, 0)
    expect(s.phase).toEqual({ type: 'steal', candidates: [1, 3], resume: 'main' })
    expect(actError(s, { type: 'steal', target: 2 }, 0)).toMatch('奪えません')
    expect(actError(s, { type: 'endTurn' }, 0)).toMatch('奪う相手の選択中')
    s = act(s, { type: 'steal', target: 3 }, 0)
    expect(s.players[0].resources).toEqual(counts({ ore: 1 }))
    expect(s.players[3].resources).toEqual(counts({ ore: 1 }))
    expect(s.phase.type).toBe('main')
  })

  it('盗賊のいるタイルは産出しない', () => {
    let s = beforeRoll()
    const hex = HEX_A
    s.tiles[hex] = { terrain: 'forest', number: 9 }
    s.tiles = s.tiles.map((t, i) => (i === hex ? t : { ...t, number: null }))
    put(s, TOPOLOGY.hexes[hex].vertices[0], 0)
    s.robber = hex
    s = act(s, { type: 'rollDice' }, 0, sequenceRng([die(4), die(5)]))
    expect(total(s.players[0].resources)).toBe(0)
  })
})
