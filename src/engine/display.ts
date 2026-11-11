import type { Piece, PieceType, Stack } from './types'
import { PIECE_LETTER } from './types'
import { effectiveMover } from './moves'
import { displayName } from '../sprites/catalog'

/** Single glyph / short code for UI (fusions get their own identity). */
export function stackBadge(stack: Stack): { code: string; title: string; fused: boolean } {
  const { combo, primary } = effectiveMover(stack)
  switch (combo) {
    case 'double-kav':
      return { code: 'DK', title: 'Doppelkavallerie', fused: true }
    case 'double-inf':
      return { code: 'DI', title: 'Doppelinfanterie', fused: true }
    case 'double-schuetze':
      return { code: 'DS', title: 'Doppelschütze', fused: true }
    case 'double-tower':
      return { code: 'DT', title: 'Doppeltower', fused: true }
    case 'double-jugend':
      return { code: 'DJ', title: 'Doppeljugend', fused: true }
    case 'tower-schuetze':
      return { code: 'TS', title: 'Turm+Bishop', fused: true }
    case 'kav-inf':
      return { code: 'KI', title: 'Ritter+Drache', fused: true }
    default:
      break
  }
  if (stack.length === 2 && stack.every((p) => p.type === 'Soldat')) {
    return { code: 'PP', title: 'Doppelsoldat', fused: true }
  }
  if (stack.length >= 2) {
    // Show top letter prominently; height as dots in UI
    return {
      code: PIECE_LETTER[primary],
      title: stack.map((p) => displayName(p.type)).join(' / '),
      fused: false,
    }
  }
  return {
    code: PIECE_LETTER[primary],
    title: displayName(primary),
    fused: false,
  }
}

export function pieceLetter(type: PieceType): string {
  return PIECE_LETTER[type]
}

export function topPiece(stack: Stack): Piece {
  return stack[stack.length - 1]!
}
