import { describe, expect, it } from 'vitest'
import {
  applyAction,
  createInitialState,
  createZigzagSetup,
  algebraic,
  createEmptyPlayState,
  placeStack,
  generateMovesFrom,
  checkingThreats,
  legalTargets,
} from './index'
import type { Color, GameState } from './types'
import { soldierBaseRank } from './coords'
import { isSquareAttacked } from './moves'

function placeFile(state: GameState, color: Color, file: number, rank: number) {
  return applyAction(state, { type: 'place-soldier', color, file, rank }).state
}

function fillSoldiers(state: GameState, color: Color, rankForFile: (file: number) => number) {
  let s = state
  for (let file = 0; file < 10; file++) s = placeFile(s, color, file, rankForFile(file))
  return applyAction(s, { type: 'confirm-soldiers', color }).state
}

describe('Myriad Chess engine', () => {
  it('starts a match with no soldiers placed', () => {
    const s = createInitialState('5+3')
    expect(s.phase).toBe('setup-soldiers')
    expect(s.setupVariant).toBe('meta')
    expect(s.board.every((file) => file.every((cell) => cell === null))).toBe(true)
  })

  it('rejects a Soldat on the back rank', () => {
    const res = applyAction(createInitialState(), { type: 'place-soldier', color: 'white', file: 0, rank: 0 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/back rank/i)
  })

  it('keeps one Soldat per file when the rank changes', () => {
    let s = createInitialState()
    s = placeFile(s, 'white', 0, 1)
    s = placeFile(s, 'white', 0, 2)
    expect(s.board[0]![1]).toBeNull()
    expect(s.board[0]![2]?.length).toBe(1)
    expect(s.setup.white.soldierRanks[0]).toBe(2)
    expect(s.setup.white.soldierRanks.filter((r) => r >= 0)).toHaveLength(1)
  })

  it('accepts ranks 2 and 3, then doubles on the chosen square', () => {
    let s = createInitialState()
    s = fillSoldiers(s, 'white', (file) => (file === 0 ? 2 : 1))
    expect(s.turn).toBe('black')
    s = fillSoldiers(s, 'black', () => 7)
    expect(s.phase).toBe('setup-doubles')
    const files = [0, 1, 2, 3, 4]
    s = applyAction(s, { type: 'confirm-doubles', color: 'white', files }).state
    s = applyAction(s, { type: 'confirm-doubles', color: 'black', files }).state
    expect(s.phase).toBe('setup-mains')
    expect(s.board[0]![2]?.length).toBe(2)
    expect(s.board[0]![1]).toBeNull()
    expect(s.board[1]![1]?.length).toBe(2)
  })

  it('places a main piece only behind that file’s Soldat', () => {
    let s = createInitialState()
    s = fillSoldiers(s, 'white', (file) => (file === 0 ? 1 : 2))
    s = fillSoldiers(s, 'black', () => 8)
    const files = [0, 1, 2, 3, 4]
    s = applyAction(s, { type: 'confirm-doubles', color: 'white', files }).state
    s = applyAction(s, { type: 'confirm-doubles', color: 'black', files }).state
    const blocked = applyAction(s, { type: 'place', color: 'white', piece: 'König', file: 0, rank: 1 })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toMatch(/behind/i)
    const allowed = applyAction(s, { type: 'place', color: 'white', piece: 'König', file: 1, rank: 1 })
    expect(allowed.ok).toBe(true)
    expect(allowed.state.board[1]![1]?.[0]?.type).toBe('König')
  })

  it('places the zigzag map only for the testing preset', () => {
    const s = createZigzagSetup('5+3')
    expect(s.phase).toBe('setup-doubles')
    expect(s.setupVariant).toBe('zigzag')
    expect(soldierBaseRank('white', 0)).toBe(1) // A2
    expect(soldierBaseRank('white', 4)).toBe(1) // E2
    expect(soldierBaseRank('white', 5)).toBe(1) // F2
    expect(s.board[0]![1]?.[0]?.type).toBe('Soldat')
    expect(s.setup.white.soldierRanks[0]).toBe(1)
  })

  it('rejects doubles confirm without 5 files', () => {
    const s = createZigzagSetup()
    const res = applyAction(s, { type: 'confirm-doubles', color: 'white', files: [0, 1] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/exactly 5/i)
  })

  it('confirms doubles and advances when both done', () => {
    let s = createZigzagSetup()
    const files = [0, 1, 2, 3, 4]
    let res = applyAction(s, { type: 'confirm-doubles', color: 'white', files })
    expect(res.ok).toBe(true)
    s = res.state
    res = applyAction(s, { type: 'confirm-doubles', color: 'black', files })
    expect(res.ok).toBe(true)
    expect(res.state.phase).toBe('setup-mains')
    expect(res.state.board[0]![soldierBaseRank('white', 0)]?.length).toBe(2)
  })

  it('rejects main piece on rank 3', () => {
    let s = createZigzagSetup()
    const files = [0, 1, 2, 3, 4]
    s = applyAction(s, { type: 'confirm-doubles', color: 'white', files }).state
    s = applyAction(s, { type: 'confirm-doubles', color: 'black', files }).state
    const res = applyAction(s, {
      type: 'place',
      color: 'white',
      piece: 'König',
      file: 0,
      rank: 2,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/ranks 1–2/i)
  })

  it('algebraic labels', () => {
    expect(algebraic(0, 0)).toBe('a1')
    expect(algebraic(9, 9)).toBe('j10')
  })

  it('promotes a Soldat that reaches the back rank', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 0, 'white', ['König'])
    s = placeStack(s, 0, 9, 'black', ['König'])
    s = placeStack(s, 4, 7, 'white', ['Soldat'])
    const moved = applyAction(s, { type: 'march', fromFile: 4, fromRank: 7, toFile: 4, toRank: 9, mode: 'unit' })
    expect(moved.ok).toBe(true)
    expect(moved.state.pendingPromotion?.squares[0]).toMatchObject({ file: 4, rank: 9, isDouble: false })
    expect(moved.state.turn).toBe('white')
    const done = applyAction(moved.state, { type: 'promote', choices: ['Turm'] })
    expect(done.ok).toBe(true)
    expect(done.state.board[4]![9]![0]!.type).toBe('Turm')
    expect(done.state.pendingPromotion).toBeNull()
    expect(done.state.turn).toBe('black')
  })

  it('promotes a Doppelsoldat into Dame plus a chosen piece', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 0, 'white', ['König'])
    s = placeStack(s, 0, 9, 'black', ['König'])
    s = placeStack(s, 5, 7, 'white', ['Soldat', 'Soldat'])
    const moved = applyAction(s, { type: 'march', fromFile: 5, fromRank: 7, toFile: 5, toRank: 9, mode: 'unit' })
    expect(moved.state.pendingPromotion?.squares[0]?.isDouble).toBe(true)
    const done = applyAction(moved.state, { type: 'promote', choices: ['Bishop'] })
    expect(done.ok).toBe(true)
    const types = done.state.board[5]![9]!.map((p) => p.type)
    expect(types).toContain('Dame')
    expect(types).toContain('Bishop')
  })

  it('a Turm leaves a Soldat behind instead of dragging it', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 0, 'white', ['König'])
    s = placeStack(s, 9, 9, 'black', ['König'])
    s = placeStack(s, 4, 8, 'white', ['Soldat', 'Turm'])
    const moved = applyAction(s, {
      type: 'march',
      fromFile: 4,
      fromRank: 8,
      toFile: 4,
      toRank: 9,
      mode: 'unit',
    })
    expect(moved.ok).toBe(true)
    expect(moved.state.pendingPromotion).toBeNull()
    expect(moved.state.board[4]![8]!.map((p) => p.type)).toEqual(['Soldat'])
    expect(moved.state.board[4]![9]!.map((p) => p.type)).toEqual(['Turm'])
  })

  it('a Turm on two Soldaten leaves the pair behind', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 0, 'white', ['König'])
    s = placeStack(s, 9, 9, 'black', ['König'])
    s = placeStack(s, 4, 4, 'white', ['Soldat', 'Soldat', 'Turm'])
    const moved = applyAction(s, {
      type: 'march',
      fromFile: 4,
      fromRank: 4,
      toFile: 7,
      toRank: 4,
      mode: 'unit',
    })
    expect(moved.ok).toBe(true)
    expect(moved.state.board[4]![4]!.map((p) => p.type)).toEqual(['Soldat', 'Soldat'])
    expect(moved.state.board[7]![4]!.map((p) => p.type)).toEqual(['Turm'])
  })

  it('a Doppelbishop bounces once off a wall and does not move like a queen', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 5, 'white', ['König'])
    s = placeStack(s, 0, 9, 'black', ['König'])
    s = placeStack(s, 6, 0, 'white', ['Bishop', 'Bishop'])
    const keys = new Set(generateMovesFrom(s, 6, 0).map((t) => `${t.file},${t.rank}`))
    expect(keys.has('9,3')).toBe(true)
    expect(keys.has('8,4')).toBe(true)
    expect(keys.has('9,1')).toBe(false)
    expect(keys.has('6,4')).toBe(false)
    expect(keys.has('9,0')).toBe(false)
  })

  it('a Doppelturm slides like a rook and bends only on the outer rim', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 0, 'white', ['König'])
    s = placeStack(s, 9, 9, 'black', ['König'])
    s = placeStack(s, 2, 4, 'white', ['Turm', 'Turm'])
    s = placeStack(s, 2, 7, 'black', ['Soldat'])
    s = placeStack(s, 0, 7, 'black', ['Soldat'])
    s = placeStack(s, 4, 6, 'black', ['Soldat'])
    const hits = generateMovesFrom(s, 2, 4)
    const at = (file: number, rank: number) => hits.find((t) => t.file === file && t.rank === rank)
    expect(at(2, 7)?.kind).toBe('capture')
    expect(at(2, 8)).toBeUndefined()
    expect(at(2, 5)?.kind).toBe('move')
    expect(at(0, 7)?.kind).toBe('capture')
    expect(at(0, 8)).toBeUndefined()
    expect(at(4, 6)).toBeUndefined()
    expect(at(0, 4)?.kind).toBe('move')
  })

  it('a Doppelturm ricochet stays on the outermost squares', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 3, 2, 'white', ['König'])
    s = placeStack(s, 3, 6, 'black', ['König'])
    s = placeStack(s, 9, 4, 'white', ['Turm', 'Turm'])
    const hits = generateMovesFrom(s, 9, 4)
    const at = (file: number, rank: number) => hits.find((t) => t.file === file && t.rank === rank)
    expect(at(4, 4)?.kind).toBe('move')
    expect(at(9, 9)?.kind).toBe('move')
    expect(at(2, 9)?.kind).toBe('move')
    expect(at(5, 7)).toBeUndefined()
    expect(at(5, 8)).toBeUndefined()
  })

  it('a Doppelbishop stops on an enemy and does not bounce past it', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 5, 'white', ['König'])
    s = placeStack(s, 0, 9, 'black', ['König'])
    s = placeStack(s, 6, 0, 'white', ['Bishop', 'Bishop'])
    s = placeStack(s, 8, 2, 'black', ['Soldat'])
    const hits = generateMovesFrom(s, 6, 0)
    const at = (file: number, rank: number) => hits.find((t) => t.file === file && t.rank === rank)
    expect(at(8, 2)?.kind).toBe('capture')
    expect(at(9, 3)).toBeUndefined()
    expect(at(8, 4)).toBeUndefined()
    expect(at(7, 1)?.kind).toBe('move')
  })

  it('check light follows a rook ray and only the knight for a leap', () => {
    let ray = createEmptyPlayState('5+3')
    ray = placeStack(ray, 0, 0, 'white', ['König'])
    ray = placeStack(ray, 0, 4, 'white', ['Turm'])
    ray = placeStack(ray, 5, 4, 'black', ['König'])
    const rook = checkingThreats(ray, 'black')
    expect(rook).toEqual([
      {
        kind: 'ray',
        squares: [
          { file: 0, rank: 4 },
          { file: 1, rank: 4 },
          { file: 2, rank: 4 },
          { file: 3, rank: 4 },
          { file: 4, rank: 4 },
          { file: 5, rank: 4 },
        ],
      },
    ])

    let leap = createEmptyPlayState('5+3')
    leap = placeStack(leap, 0, 0, 'white', ['König'])
    leap = placeStack(leap, 4, 4, 'white', ['Ritter'])
    leap = placeStack(leap, 7, 6, 'black', ['König'])
    expect(checkingThreats(leap, 'black')).toEqual([{ kind: 'leap', squares: [{ file: 4, rank: 4 }] }])

    let dragon = createEmptyPlayState('5+3')
    dragon = placeStack(dragon, 0, 0, 'white', ['König'])
    dragon = placeStack(dragon, 4, 4, 'white', ['Drache'])
    dragon = placeStack(dragon, 6, 6, 'black', ['König'])
    expect(checkingThreats(dragon, 'black')).toEqual([{ kind: 'leap', squares: [{ file: 4, rank: 4 }] }])
  })

  it('a Doppelbishop check follows the bounced diagonal', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 0, 0, 'white', ['König'])
    s = placeStack(s, 6, 0, 'white', ['Bishop', 'Bishop'])
    s = placeStack(s, 8, 4, 'black', ['König'])
    expect(checkingThreats(s, 'black')).toEqual([
      {
        kind: 'ray',
        squares: [
          { file: 6, rank: 0 },
          { file: 7, rank: 1 },
          { file: 8, rank: 2 },
          { file: 9, rank: 3 },
          { file: 8, rank: 4 },
        ],
      },
    ])
  })

  it('rejects a König step onto an attacked square', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 4, 3, 'white', ['König'])
    s = placeStack(s, 4, 9, 'black', ['König'])
    s = placeStack(s, 0, 3, 'black', ['Turm'])
    const illegal = applyAction(s, { type: 'march', fromFile: 4, fromRank: 3, toFile: 3, toRank: 3 })
    expect(illegal.ok).toBe(false)
    const safe = applyAction(s, { type: 'march', fromFile: 4, fromRank: 3, toFile: 4, toRank: 4 })
    expect(safe.ok).toBe(true)
  })

  it('a pinned piece cannot leave the ray', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 4, 0, 'white', ['König'])
    s = placeStack(s, 4, 9, 'black', ['König'])
    s = placeStack(s, 4, 2, 'white', ['Turm'])
    s = placeStack(s, 4, 7, 'black', ['Turm'])
    const stack = s.board[4]![2]
    const moves = legalTargets(s, 4, 2)
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every((m) => m.file === 4)).toBe(true)
    expect(moves.some((m) => m.rank === 3)).toBe(true)
    expect(s.board[4]![2]).toBe(stack)
  })

  it('counts a Soldat forward step as an attack on the empty square', () => {
    let s = createEmptyPlayState('5+3')
    s = placeStack(s, 4, 1, 'white', ['Soldat'])
    expect(isSquareAttacked(s, 4, 2, 'white')).toBe(true)
    expect(isSquareAttacked(s, 4, 3, 'white')).toBe(true)
    expect(isSquareAttacked(s, 3, 2, 'white')).toBe(false)
  })

  it('subtracts elapsed time on a tick and flags at zero', () => {
    let s = createEmptyPlayState('5+3')
    s = { ...s, clocksMs: { white: 1500, black: 1500 } }
    const next = applyAction(s, { type: 'tick', nowMs: 0, side: 'white', elapsedMs: 400 }).state
    expect(next.clocksMs.white).toBe(1100)
    expect(next.phase).toBe('play')
    const flagged = applyAction(next, { type: 'tick', nowMs: 0, side: 'white', elapsedMs: 1100 }).state
    expect(flagged.clocksMs.white).toBe(0)
    expect(flagged.phase).toBe('ended')
    expect(flagged.result).toBe('black')
  })
})
