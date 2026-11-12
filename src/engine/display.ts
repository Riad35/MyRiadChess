import type { Piece, PieceType, Stack } from './types'
import { PIECE_LETTER } from './types'
import { effectiveMover } from './moves'

/** Single glyph / short code for UI (fusions get their own identity). */
export function stackBadge(stack: Stack): { code: string; title: string; fused: boolean } {
  const { combo, primary } = effectiveMover(stack)
  switch (combo) {
    case 'double-ritter':
      return { code: 'RR', title: 'Edler Ritter', fused: true }
    case 'double-drache':
      return { code: 'DrDr', title: 'Edler Drache', fused: true }
    case 'double-bishop':
      return { code: 'BB', title: 'Pope', fused: true }
    case 'double-turm':
      return { code: 'TT', title: 'Doppelturm', fused: true }
    case 'double-dame':
      return { code: 'DD', title: 'Doppeldame', fused: true }
    case 'bishop-turm':
      return { code: 'D', title: 'Dame', fused: true }
    case 'drache-ritter':
      return { code: 'DrR', title: 'Drachenritter', fused: true }
    default:
      break
  }
  if (stack.length === 2 && stack.every((p) => p.type === 'Soldat')) {
    return { code: 'SS', title: 'Doppelsoldat', fused: true }
  }
  if (stack.length >= 2) {
    // Show top letter prominently; height as dots in UI
    return {
      code: PIECE_LETTER[primary],
      title: stack.map((p) => p.type).join(' / '),
      fused: false,
    }
  }
  return {
    code: PIECE_LETTER[primary],
    title: primary,
    fused: false,
  }
}

export function pieceLetter(type: PieceType): string {
  return PIECE_LETTER[type]
}

export function topPiece(stack: Stack): Piece {
  return stack[stack.length - 1]!
}
