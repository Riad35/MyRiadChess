import { describe, expect, it } from 'vitest'
import {
  defaultFacing,
  facingFromDelta,
  rotateDir,
  spriteDirForViewer,
} from './facing'

describe('facing helpers', () => {
  it('defaults White north / Black south', () => {
    expect(defaultFacing('white')).toBe('north')
    expect(defaultFacing('black')).toBe('south')
  })

  it('maps deltas to 8 dirs', () => {
    expect(facingFromDelta(0, 1)).toBe('north')
    expect(facingFromDelta(2, 2)).toBe('north-east')
    expect(facingFromDelta(-3, 0)).toBe('west')
    expect(facingFromDelta(0, 0)).toBeNull()
  })

  it('remaps 180° when board is turned for Black', () => {
    expect(spriteDirForViewer('north', 'white-south')).toBe('north')
    expect(spriteDirForViewer('north', 'black-south')).toBe('south')
    expect(spriteDirForViewer('north-east', 'black-south')).toBe('south-west')
    expect(rotateDir('west', 2)).toBe('north')
  })
})
