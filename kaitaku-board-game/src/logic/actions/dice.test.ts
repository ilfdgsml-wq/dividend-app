import { describe, expect, it } from 'vitest'
import { TOPOLOGY } from '../board/topology.ts'
import { counts, total } from '../resources.ts'
import { sequenceRng } from '../rng.ts'
import { act, die, mainPhase, put } from '../testing.ts'
import type { GameState, Terrain } from '../types.ts'
import { computeProduction } from './dice.ts'

/** 盤面の数字をすべて外し、指定したタイルだけに数字を置いた、サイコロ前の状態 */
function board(spec: { hex: number; terrain: Terrain; number: number }[]): GameState {
  const s = mainPhase()
  s.phase = { type: 'preRoll' }
  s.tiles = s.tiles.map((t) => ({ ...t, number: null }))
  for (const { hex, terrain, number } of spec) s.tiles[hex] = { terrain, number }
  s.robber = 18
  return s
}

const HEX = 9
const [V0, , V2, , V4] = TOPOLOGY.hexes[HEX].vertices

describe('資源産出', () => {
  it('開拓地は1枚、都市は2枚。手番以外の人も受け取る', () => {
    const s = board([{ hex: HEX, terrain: 'forest', number: 5 }])
    put(s, V0, 0)
    put(s, V2, 1, 'city')
    const { gains, shortage } = computeProduction(s, 5)
    expect(gains[0]).toEqual(counts({ wood: 1 }))
    expect(gains[1]).toEqual(counts({ wood: 2 }))
    expect(gains[2]).toEqual(counts())
    expect(shortage).toEqual([])
  })

  it('出目と違う数字・盗賊のいるタイル・砂漠は産出しない', () => {
    const s = board([
      { hex: HEX, terrain: 'forest', number: 5 },
      { hex: 0, terrain: 'hills', number: 6 },
    ])
    put(s, V0, 0)
    put(s, TOPOLOGY.hexes[0].vertices[0], 0)
    expect(computeProduction(s, 6).gains[0]).toEqual(counts({ brick: 1 }))
    s.robber = HEX
    expect(computeProduction(s, 5).gains[0]).toEqual(counts())
  })

  it('1つの交差点が複数の産出タイルに接していれば、それぞれから受け取る', () => {
    const v = TOPOLOGY.vertices.find((x) => x.hexes.length === 3)!
    const s = board(
      v.hexes.map((hex, i) => ({ hex, terrain: (['forest', 'fields', 'mountains'] as Terrain[])[i], number: 8 })),
    )
    put(s, v.id, 2, 'city')
    expect(computeProduction(s, 8).gains[2]).toEqual(counts({ wood: 2, wheat: 2, ore: 2 }))
  })

  it('サイコロを振ると手札と銀行に反映され、交易・建設フェーズへ', () => {
    let s = board([{ hex: HEX, terrain: 'fields', number: 5 }])
    put(s, V0, 0)
    put(s, V2, 3)
    s = act(s, { type: 'rollDice' }, 0, sequenceRng([die(2), die(3)]))
    expect(s.lastRoll).toEqual([2, 3])
    expect(s.players[0].resources.wheat).toBe(1)
    expect(s.players[3].resources.wheat).toBe(1)
    expect(s.bank.wheat).toBe(17)
    expect(s.phase.type).toBe('main')
  })
})

describe('資源不足時の配布', () => {
  it('銀行が足りていれば全員が受け取る（ちょうどの場合も）', () => {
    const s = board([{ hex: HEX, terrain: 'forest', number: 5 }])
    put(s, V0, 0)
    put(s, V2, 1, 'city')
    s.bank.wood = 3
    const { gains, shortage } = computeProduction(s, 5)
    expect(gains[0].wood + gains[1].wood).toBe(3)
    expect(shortage).toEqual([])
  })

  it('複数人が受け取る資源で銀行が足りなければ、その資源は誰も受け取らない', () => {
    const s = board([{ hex: HEX, terrain: 'forest', number: 5 }])
    put(s, V0, 0)
    put(s, V2, 1, 'city')
    s.bank.wood = 2
    const { gains, shortage } = computeProduction(s, 5)
    expect(gains[0].wood).toBe(0)
    expect(gains[1].wood).toBe(0)
    expect(shortage).toEqual(['wood'])
  })

  it('受け取るのが1人だけなら、銀行に残っている分だけ渡す', () => {
    const s = board([{ hex: HEX, terrain: 'forest', number: 5 }])
    put(s, V0, 0, 'city')
    put(s, V2, 0, 'city')
    s.bank.wood = 3
    const { gains, shortage } = computeProduction(s, 5)
    expect(gains[0].wood).toBe(3)
    expect(shortage).toEqual(['wood'])
  })

  it('他の種類の資源の配布には影響しない', () => {
    const other = TOPOLOGY.hexes[0]
    const s = board([
      { hex: HEX, terrain: 'forest', number: 5 },
      { hex: other.id, terrain: 'pasture', number: 5 },
    ])
    put(s, V0, 0)
    put(s, V4, 1)
    put(s, other.vertices[0], 2)
    s.bank.wood = 1
    const { gains } = computeProduction(s, 5)
    expect(gains[0].wood + gains[1].wood).toBe(0)
    expect(gains[2].sheep).toBe(1)
  })

  it('銀行が0枚の資源は1人でも受け取れない。サイコロ経由でも銀行はマイナスにならない', () => {
    let s = board([{ hex: HEX, terrain: 'mountains', number: 5 }])
    put(s, V0, 0)
    s.bank.ore = 0
    s = act(s, { type: 'rollDice' }, 0, sequenceRng([die(1), die(4)]))
    expect(s.players[0].resources.ore).toBe(0)
    expect(s.bank.ore).toBe(0)
    expect(total(s.bank)).toBe(19 * 4)
  })
})
