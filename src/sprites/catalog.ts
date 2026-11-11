import type { PieceType } from '../engine/types'
import { PIECE_LETTER } from '../engine/types'

/** Locked UI / asset identity — engine `PieceType` stays rules-facing. */
export interface UnitCatalogEntry {
  /** Engine rules key. */
  type: PieceType
  /** Locked display name (folder under sprites). */
  displayName: string
  /** Folder under `public/sprites/<skin>/<color>/`. */
  spriteFolder: string
  /** Letter fallback when art is missing. */
  letter: string
  /** Stable fusion / skin slot key (base unit). */
  skinKey: string
}

/**
 * Stable unit catalog: skins & fusions hang off these keys without churning the engine.
 * Display folders: König / Dame / Bishop / Ritter / Drache / Soldat / Turm.
 */
export const UNIT_CATALOG: Record<PieceType, UnitCatalogEntry> = {
  Volk: {
    type: 'Volk',
    displayName: 'König',
    spriteFolder: 'König',
    letter: PIECE_LETTER.Volk,
    skinKey: 'koenig',
  },
  Jugend: {
    type: 'Jugend',
    displayName: 'Dame',
    spriteFolder: 'Dame',
    letter: PIECE_LETTER.Jugend,
    skinKey: 'dame',
  },
  Tower: {
    type: 'Tower',
    displayName: 'Turm',
    spriteFolder: 'Turm',
    letter: PIECE_LETTER.Tower,
    skinKey: 'turm',
  },
  Schütze: {
    type: 'Schütze',
    displayName: 'Bishop',
    spriteFolder: 'Bishop',
    letter: PIECE_LETTER.Schütze,
    skinKey: 'bishop',
  },
  Kavallerie: {
    type: 'Kavallerie',
    displayName: 'Ritter',
    spriteFolder: 'Ritter',
    letter: PIECE_LETTER.Kavallerie,
    skinKey: 'ritter',
  },
  Infanterie: {
    type: 'Infanterie',
    displayName: 'Drache',
    spriteFolder: 'Drache',
    letter: PIECE_LETTER.Infanterie,
    skinKey: 'drache',
  },
  Soldat: {
    type: 'Soldat',
    displayName: 'Soldat',
    spriteFolder: 'Soldat',
    letter: PIECE_LETTER.Soldat,
    skinKey: 'soldat',
  },
}

/** Fusion codes already used by `stackBadge` — reserved skin slots (art later). */
export const FUSION_SKIN_SLOTS = ['DK', 'DI', 'DS', 'DT', 'DJ', 'TS', 'KI', 'PP'] as const

export type FusionSkinSlot = (typeof FUSION_SKIN_SLOTS)[number]

export const DEFAULT_SKIN_ID = 'classic'

export function unitEntry(type: PieceType): UnitCatalogEntry {
  return UNIT_CATALOG[type]
}

export function displayName(type: PieceType): string {
  return UNIT_CATALOG[type].displayName
}
