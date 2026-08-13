import { describe, expect, it } from 'vitest'
import { applyAction, createInitialState, algebraic } from './index'
import { soldierBaseRank } from './coords'

describe('Schach 2 engine', () => {
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
      piece: 'Volk',
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
})
