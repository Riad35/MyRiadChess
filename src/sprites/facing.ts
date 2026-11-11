import type { Color } from '../engine/types'

/** Eight board-absolute facings; art files use the same kebab names. */
export const SPRITE_DIRS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const

export type SpriteDir = (typeof SPRITE_DIRS)[number]

/** Who sits at the bottom of the screen (viewer looking “up” the board). */
export type ViewerOrientation = 'white-south' | 'black-south'

/** Default army facing on the board (White marches +rank / north). */
export function defaultFacing(color: Color): SpriteDir {
  return color === 'white' ? 'north' : 'south'
}

/** Map a move delta (file, rank) onto the nearest of 8 directions. */
export function facingFromDelta(dFile: number, dRank: number): SpriteDir | null {
  const sx = Math.sign(dFile)
  const sy = Math.sign(dRank)
  if (sx === 0 && sy === 0) return null
  const key = `${sx},${sy}` as const
  const map: Record<string, SpriteDir> = {
    '0,1': 'north',
    '1,1': 'north-east',
    '1,0': 'east',
    '1,-1': 'south-east',
    '0,-1': 'south',
    '-1,-1': 'south-west',
    '-1,0': 'west',
    '-1,1': 'north-west',
  }
  return map[key] ?? null
}

export function rotateDir(dir: SpriteDir, steps: number): SpriteDir {
  const i = SPRITE_DIRS.indexOf(dir)
  const n = SPRITE_DIRS.length
  return SPRITE_DIRS[((i + steps) % n + n) % n]!
}

/**
 * Remap board-absolute facing into the sprite file the viewer should see.
 * White-at-bottom: identity. Board turned for Black: rotate 180°.
 */
export function spriteDirForViewer(boardFacing: SpriteDir, viewer: ViewerOrientation): SpriteDir {
  return viewer === 'black-south' ? rotateDir(boardFacing, 4) : boardFacing
}
