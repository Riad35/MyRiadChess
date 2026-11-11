import type { Color, PieceType } from '../engine/types'
import { DEFAULT_SKIN_ID, UNIT_CATALOG } from './catalog'
import type { SpriteDir } from './facing'

/** Public URL for a unit idle frame, or null if the catalog has no folder. */
export function spriteUrl(
  color: Color,
  type: PieceType,
  dir: SpriteDir,
  skinId: string = DEFAULT_SKIN_ID,
): string {
  const folder = UNIT_CATALOG[type].spriteFolder
  const segments = ['sprites', skinId, color, folder, 'Idle', 'rotations', `${dir}.png`]
  return '/' + segments.map(encodeURIComponent).join('/')
}
