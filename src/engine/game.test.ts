import { describe, expect, it } from 'vitest'
import { applyAction, createInitialState, algebraic, createEmptyPlayState, placeStack } from './index'
import { soldierBaseRank } from './coords'

describe('Myriad Chess engine', () => {
  it('places fixed soldier zigzag for white', () => {
    const s = createInitialState('5+3')
    expect(soldierBaseRank('white', 0)).toBe(1) // A2
    expect(soldierBaseRank('white', 4)).toBe(1) // E2
    expect(soldierBaseRank('white', 5)).toBe(1) // F2
    expect(s.board[0]![1]?.[0]?.type).toBe('Soldat')
  })

  it('rejects doubles confirm without 5 files', () => {
    const s = createInitialState()
    const res = applyAction(s, { type: 'confirm-doubles', color: 'white', files: [0, 1] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/exactly 5/i)
  })

  it('confirms doubles and advances when both done', () => {
    let s = createInitialState()
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
    let s = createInitialState()
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
})
