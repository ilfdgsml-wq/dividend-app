import { describe, expect, it } from 'vitest'
import { counts, total } from '../resources.ts'
import { sequenceRng } from '../rng.ts'
import { updateLargestArmy } from '../rules/largestArmy.ts'
import { legalRoadEdges } from '../rules/placement.ts'
import { victoryPoints } from '../rules/victory.ts'
import { act, actError, coastalPath, die, mainPhase, put, putRoads, setHand } from '../testing.ts'
import type { DevCardType, GameState, PlayerId } from '../types.ts'

function withCard(s: GameState, player: PlayerId, type: DevCardType, boughtTurn = 0): GameState {
  s.players[player].devCards.push({ type, boughtTurn })
  return s
}

describe('発展カードの購入', () => {
  it('山札の一番上を引き、資源を銀行に払う', () => {
    let s = mainPhase()
    s.devDeck = ['knight', 'monopoly']
    setHand(s, 0, { ore: 1, sheep: 1, wheat: 1 })
    s = act(s, { type: 'buyDevCard' }, 0)
    expect(s.players[0].devCards).toEqual([{ type: 'monopoly', boughtTurn: 1 }])
    expect(s.devDeck).toEqual(['knight'])
    expect(total(s.players[0].resources)).toBe(0)
  })

  it('山札が尽きたら買えない', () => {
    const s = mainPhase()
    s.devDeck = []
    setHand(s, 0, { ore: 1, sheep: 1, wheat: 1 })
    expect(actError(s, { type: 'buyDevCard' }, 0)).toMatch('山札')
  })

  it('山札は25枚（騎士14・街道建設2・収穫2・独占2・勝利点5）', () => {
    const s = mainPhase()
    const tally: Record<string, number> = {}
    for (const c of s.devDeck) tally[c] = (tally[c] ?? 0) + 1
    expect(tally).toEqual({ knight: 14, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2, victoryPoint: 5 })
  })
})

describe('発展カードの使用制限', () => {
  it('買ったその手番には使えず、次の自分の手番から使える', () => {
    let s = mainPhase()
    s.devDeck = ['monopoly']
    setHand(s, 0, { ore: 1, sheep: 1, wheat: 1 })
    s = act(s, { type: 'buyDevCard' }, 0)
    expect(actError(s, { type: 'playMonopoly', resource: 'ore' }, 0)).toMatch('買ったばかり')
    s.turn += 4
    s = act(s, { type: 'playMonopoly', resource: 'ore' }, 0)
    expect(s.players[0].devCards).toEqual([])
  })

  it('1手番に1枚まで', () => {
    let s = withCard(withCard(mainPhase(), 0, 'monopoly'), 0, 'yearOfPlenty')
    s = act(s, { type: 'playMonopoly', resource: 'wood' }, 0)
    expect(actError(s, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] }, 0)).toMatch('1手番に1枚')
    s = act(s, { type: 'endTurn' }, 0)
    expect(s.devCardPlayedThisTurn).toBe(false)
  })

  it('持っていないカード・他人の手番では使えない', () => {
    const s = withCard(mainPhase(), 1, 'knight')
    expect(actError(s, { type: 'playKnight' }, 0)).toMatch('持っていません')
    expect(actError(s, { type: 'playKnight' }, 1)).toMatch('手番ではありません')
  })
})

describe('騎士', () => {
  it('サイコロの前に使える。盗賊を動かして奪い、サイコロ前に戻る', () => {
    let s = withCard(mainPhase(), 0, 'knight')
    s.phase = { type: 'preRoll' }
    put(s, 0, 1)
    setHand(s, 1, { wheat: 1 })
    setHand(s, 2, { wood: 9 }) // 騎士では捨て札は発生しない
    s = act(s, { type: 'playKnight' }, 0)
    expect(s.phase).toEqual({ type: 'moveRobber', resume: 'preRoll' })
    s = act(s, { type: 'moveRobber', hex: 0 }, 0)
    expect(s.players[0].resources).toEqual(counts({ wheat: 1 }))
    expect(s.players[2].resources.wood).toBe(9)
    expect(s.phase).toEqual({ type: 'preRoll' })
    expect(s.players[0].knightsPlayed).toBe(1)
    s = act(s, { type: 'rollDice' }, 0, sequenceRng([die(2), die(2)]))
    expect(s.phase.type).toBe('main')
  })

  it('サイコロの後に使うと、交易・建設に戻る', () => {
    let s = withCard(mainPhase(), 0, 'knight')
    s = act(s, { type: 'playKnight' }, 0)
    s = act(s, { type: 'moveRobber', hex: 0 }, 0)
    expect(s.phase).toEqual({ type: 'main' })
  })
})

describe('最大騎士力', () => {
  it('3枚以上で最初の人が獲得し、同数では奪えず、多く使った人が奪う', () => {
    const s = mainPhase()
    s.players[0].knightsPlayed = 2
    updateLargestArmy(s, 0)
    expect(s.largestArmy.holder).toBeNull()
    s.players[0].knightsPlayed = 3
    updateLargestArmy(s, 0)
    expect(s.largestArmy.holder).toBe(0)
    s.players[1].knightsPlayed = 3
    updateLargestArmy(s, 1)
    expect(s.largestArmy.holder).toBe(0)
    s.players[1].knightsPlayed = 4
    updateLargestArmy(s, 1)
    expect(s.largestArmy.holder).toBe(1)
    expect(victoryPoints(s, 1, false)).toBe(2)
  })

  it('騎士を使ったときに更新される', () => {
    let s = withCard(mainPhase(), 0, 'knight')
    s.players[0].knightsPlayed = 2
    s = act(s, { type: 'playKnight' }, 0)
    expect(s.largestArmy.holder).toBe(0)
  })
})

describe('街道建設', () => {
  function roadReady() {
    const s = withCard(mainPhase(), 0, 'roadBuilding')
    const p = coastalPath(0, 3)
    put(s, p.vertices[0], 0)
    return { s, p }
  }

  it('資源を使わずに道を2本置ける', () => {
    const ready = roadReady()
    const p = ready.p
    let s = act(ready.s, { type: 'playRoadBuilding' }, 0)
    expect(s.phase).toEqual({ type: 'roadBuilding', remaining: 2, resume: 'main' })
    expect(actError(s, { type: 'buildRoad', edge: p.edges[0] }, 0)).toMatch('街道建設')
    s = act(s, { type: 'placeFreeRoad', edge: p.edges[0] }, 0)
    expect(s.phase).toEqual({ type: 'roadBuilding', remaining: 1, resume: 'main' })
    s = act(s, { type: 'placeFreeRoad', edge: p.edges[1] }, 0)
    expect(s.phase).toEqual({ type: 'main' })
    expect(s.roads[p.edges[0]]).toBe(0)
    expect(s.roads[p.edges[1]]).toBe(0)
  })

  it('通常のルールに従う（つながっていない辺には置けない）', () => {
    const s = act(roadReady().s, { type: 'playRoadBuilding' }, 0)
    const far = coastalPath(15, 1).edges[0]
    expect(actError(s, { type: 'placeFreeRoad', edge: far }, 0)).toMatch('つながっていない')
  })

  it('道の在庫が1本なら1本だけ', () => {
    const ready = roadReady()
    putRoads(ready.s, coastalPath(10, 14).edges, 0)
    let s = act(ready.s, { type: 'playRoadBuilding' }, 0)
    expect(s.phase).toEqual({ type: 'roadBuilding', remaining: 1, resume: 'main' })
    s = act(s, { type: 'placeFreeRoad', edge: ready.p.edges[0] }, 0)
    expect(s.phase).toEqual({ type: 'main' })
  })

  it('道を置ける場所がなければ使えない', () => {
    const s = withCard(mainPhase(), 0, 'roadBuilding')
    expect(legalRoadEdges(s, 0)).toEqual([])
    expect(actError(s, { type: 'playRoadBuilding' }, 0)).toMatch('置ける場所')
    expect(s.players[0].devCards).toHaveLength(1)
  })
})

describe('収穫', () => {
  it('銀行から好きな資源を2枚（同じ種類でも可）', () => {
    let s = withCard(mainPhase(), 0, 'yearOfPlenty')
    s = act(s, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] }, 0)
    expect(s.players[0].resources).toEqual(counts({ ore: 2 }))
    expect(s.bank.ore).toBe(17)
  })

  it('銀行に無い資源は取れない（カードも消費しない）', () => {
    const s = withCard(mainPhase(), 0, 'yearOfPlenty')
    s.bank.brick = 1
    expect(actError(s, { type: 'playYearOfPlenty', resources: ['brick', 'brick'] }, 0)).toMatch('銀行')
  })
})

describe('独占', () => {
  it('他の全員からその資源を全部受け取る', () => {
    let s = withCard(mainPhase(), 0, 'monopoly')
    setHand(s, 0, { wheat: 1 })
    setHand(s, 1, { wheat: 3, ore: 1 })
    setHand(s, 2, { wood: 2 })
    setHand(s, 3, { wheat: 2 })
    s = act(s, { type: 'playMonopoly', resource: 'wheat' }, 0)
    expect(s.players[0].resources).toEqual(counts({ wheat: 6 }))
    expect(s.players[1].resources).toEqual(counts({ ore: 1 }))
    expect(s.players[3].resources).toEqual(counts())
    expect(s.log[s.log.length - 1]).toEqual({ kind: 'monopoly', player: 0, resource: 'wheat', count: 5 })
  })
})

describe('勝利点カード', () => {
  it('使用操作はなく、本人の点数にだけ含まれる', () => {
    const s = withCard(mainPhase(), 0, 'victoryPoint')
    expect(victoryPoints(s, 0, true)).toBe(1)
    expect(victoryPoints(s, 0, false)).toBe(0)
  })

  it('買ったその手番でも、10点に達すれば勝利', () => {
    let s = mainPhase()
    ;[0, 2, 4, 6].forEach((v) => put(s, v * 5, 0, 'city'))
    put(s, 45, 0)
    expect(victoryPoints(s, 0, true)).toBe(9)
    s.devDeck = ['victoryPoint']
    setHand(s, 0, { ore: 1, sheep: 1, wheat: 1 })
    s = act(s, { type: 'buyDevCard' }, 0)
    expect(s.winner).toBe(0)
    expect(s.phase.type).toBe('gameOver')
  })
})
