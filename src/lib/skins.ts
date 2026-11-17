import type { PieceType } from '../engine/types'
import type { FusionId } from '../view/sprites'

export type MoveAnim = 'none' | 'hop' | 'slide'
export type VfxId = 'none' | 'spark'

export interface SkinPack {
  id: string
  name: string
  description: string
  sprites?: Partial<Record<PieceType, string>>
  fusions?: Partial<Record<FusionId, string>>
  moveAnim: MoveAnim
  sfx: { move: boolean; capture: boolean; fuse: boolean }
  vfx: VfxId
}

export const SKINS: SkinPack[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The current sprites. No extra motion, sound, or flashes.',
    moveAnim: 'none',
    sfx: { move: false, capture: false, fuse: false },
    vfx: 'none',
  },
  {
    id: 'signal',
    name: 'Signal',
    description: 'Same sprites, a short hop, a blip, and sparks when a stack captures or fuses.',
    moveAnim: 'hop',
    sfx: { move: true, capture: true, fuse: true },
    vfx: 'spark',
  },
  {
    id: 'chessmen',
    name: 'Chessmen',
    description: 'Carved figures for Bishop, Dame, Ritter, Soldat, Doppelsoldat, Doppelturm, and Doppelbishop. The other figures stay classic.',
    sprites: {
      Bishop: 'skins/chessmen/bishop',
      Dame: 'skins/chessmen/dame',
      Ritter: 'skins/chessmen/ritter',
      Soldat: 'skins/chessmen/soldat',
    },
    fusions: {
      doppelsoldat: 'skins/chessmen/doppelsoldat',
      doppelturm: 'skins/chessmen/doppelturm',
      doppelbishop: 'skins/chessmen/doppelbishop',
    },
    moveAnim: 'none',
    sfx: { move: false, capture: false, fuse: false },
    vfx: 'none',
  },
]

export function skinById(id: string): SkinPack {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0]!
}
