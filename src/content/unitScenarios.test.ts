import { describe, expect, it } from 'vitest'
import { generateMovesFrom } from '../engine'
import { UNIT_ORDER, UNIT_SCENARIOS } from './unitScenarios'

function keys(id: string, shoot = false) {
  const scenario = UNIT_SCENARIOS.find((s) => s.id === id)!
  const state = scenario.build()
  const stack = state.board.flatMap((file, f) =>
    file.flatMap((cell, r) => (cell?.some((p) => p.color === 'white') ? [{ f, r }] : [])),
  )
  const home = stack.find((sq) => (state.board[sq.f]![sq.r]?.length ?? 0) >= 1)!
  const hits = generateMovesFrom(state, home.f, home.r, shoot ? { asShoot: true } : undefined)
  return new Set(hits.map((t) => `${t.file},${t.rank}`))
}

describe('unit scenario targets', () => {
  it('lists every tab that has a scenario', () => {
    const units = new Set(UNIT_SCENARIOS.map((s) => s.unit))
    expect(UNIT_ORDER.filter((unit) => units.has(unit))).toEqual([...UNIT_ORDER])
  })

  it('teaches the fusion moves on the squares the text names', () => {
    expect(keys('dame-fusion').has('4,8')).toBe(true)
    expect(keys('dame-fusion').has('7,7')).toBe(true)
    expect(keys('edler-ritter-1').has('8,6')).toBe(true)
    expect(keys('edler-ritter-2').has('8,6')).toBe(false)
    expect(keys('edler-drache-1').has('7,7')).toBe(true)
    expect(keys('edler-drache-2').has('7,7')).toBe(false)
    expect(keys('doppelbishop-1').has('9,3')).toBe(true)
    expect(keys('doppelbishop-1').has('8,4')).toBe(true)
    expect(keys('doppelbishop-2').has('8,2')).toBe(true)
    expect(keys('doppelbishop-2').has('9,3')).toBe(false)
    expect(keys('doppelturm-1').has('2,7')).toBe(true)
    expect(keys('doppelturm-1').has('0,7')).toBe(true)
    expect(keys('doppelturm-1').has('4,6')).toBe(false)
    expect(keys('drachenritter-1').has('6,6')).toBe(true)
    expect(keys('drachenritter-1').has('7,6')).toBe(true)
    const pair = keys('doppelsoldat-1')
    expect(pair.has('4,4')).toBe(true)
    expect(pair.has('5,4')).toBe(true)
    expect(pair.has('3,2')).toBe(true)
    const split = keys('doppelsoldat-2')
    expect(split.has('5,3')).toBe(true)
    expect(split.has('5,4')).toBe(true)
  })

  it('teaches which part of a 3-stack moves, and what a shot can hit', () => {
    const ritter = keys('stack-ritter')
    expect(ritter.has('7,6')).toBe(true)
    expect(ritter.has('6,6')).toBe(false)
    const drache = keys('stack-drache')
    expect(drache.has('6,6')).toBe(true)
    expect(drache.has('4,8')).toBe(false)
    const dame = keys('stack-dame')
    expect(dame.has('4,8')).toBe(true)
    expect(dame.has('7,7')).toBe(true)
    expect(keys('stack-pair').has('8,6')).toBe(true)
    const three = keys('stack-three')
    expect(three.has('5,4')).toBe(true)
    expect(three.has('3,7')).toBe(false)
    const turmShot = keys('stack-shot-turm', true)
    expect(turmShot.has('6,4')).toBe(true)
    expect(turmShot.has('8,8')).toBe(false)
    const ritterShot = keys('stack-shot-ritter', true)
    expect(ritterShot.has('7,6')).toBe(true)
    expect(ritterShot.has('6,7')).toBe(false)
    const bishopShot = keys('stack-shot-bishop', true)
    expect(bishopShot.has('4,0')).toBe(true)
    expect(bishopShot.has('6,6')).toBe(false)
    expect(bishopShot.has('4,4')).toBe(true)
    const tall = keys('stack-shot-tall', true)
    expect(tall.has('1,4')).toBe(true)
    expect(tall.has('5,1')).toBe(true)
  })
})
