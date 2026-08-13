import type { Color, PieceType } from '../engine/types'
import { buildScenarioBoard } from '../engine/presets'
import type { GameState } from '../engine/types'

export interface UnitScenario {
  id: string
  unit: string
  title: string
  description: string
  build: () => GameState
}

function sc(
  id: string,
  unit: string,
  title: string,
  description: string,
  placements: { file: number; rank: number; color: Color; types: PieceType[] }[],
  opts?: { chargeShots?: boolean },
): UnitScenario {
  return {
    id,
    unit,
    title,
    description,
    build: () => buildScenarioBoard(placements, '10+5', opts),
  }
}

/** Interactive teaching maps for Testing → Guide → Units. */
export const UNIT_SCENARIOS: UnitScenario[] = [
  sc(
    'volk-1',
    'Volk',
    '1 · One-step king',
    'Volk moves one square any direction. It may not step onto a threatened square.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Volk'] },
      { file: 6, rank: 6, color: 'black', types: ['Tower'] },
    ],
  ),
  sc(
    'jugend-1',
    'Jugend',
    '1 · Queen rays',
    'Jugend slides any distance orthogonally or diagonally (like a chess queen).',
    [
      { file: 3, rank: 3, color: 'white', types: ['Jugend'] },
      { file: 7, rank: 3, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'tower-1',
    'Tower',
    '1 · Rook lines',
    'Tower slides orthogonally. Blocked by pieces on the path.',
    [
      { file: 0, rank: 4, color: 'white', types: ['Tower'] },
      { file: 5, rank: 4, color: 'black', types: ['Infanterie'] },
    ],
  ),
  sc(
    'schuetze-1',
    'Schütze',
    '1 · Bishop diagonals',
    'Schütze slides diagonally only.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Schütze'] },
      { file: 6, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'kav-1',
    'Kavallerie',
    '1 · (3,2) jump',
    'Kavallerie jumps in a 3+2 L. It cannot be blocked mid-jump. Capture the enemy Infanterie if in range.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Kavallerie'] },
      { file: 7, rank: 6, color: 'black', types: ['Infanterie'] },
    ],
  ),
  sc(
    'kav-2',
    'Kavallerie',
    '2 · Jump over blockers',
    'Same jump with a friendly Soldat in between — Kavallerie still reaches the far square.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Kavallerie'] },
      { file: 3, rank: 3, color: 'white', types: ['Soldat'] },
      { file: 5, rank: 4, color: 'black', types: ['Tower'] },
    ],
  ),
  sc(
    'inf-1',
    'Infanterie',
    '1 · (2,2) diagonal jump',
    'Infanterie jumps two diagonally. Not blocked by intervening pieces.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Infanterie'] },
      { file: 6, rank: 6, color: 'black', types: ['Kavallerie'] },
    ],
  ),
  sc(
    'soldat-1',
    'Soldat',
    '1 · March & diagonal capture',
    'Soldat moves 1–2 forward if clear; captures diagonally forward or backward.',
    [
      { file: 4, rank: 3, color: 'white', types: ['Soldat'] },
      { file: 5, rank: 4, color: 'black', types: ['Soldat'] },
      { file: 3, rank: 2, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'soldat-2',
    'Soldat',
    '2 · Doppelsoldat unit',
    'Double Soldat can march together or capture as a unit. Try split mode by clicking orthogonal empty / diagonal capture (engine uses split kind).',
    [
      { file: 4, rank: 3, color: 'white', types: ['Soldat', 'Soldat'] },
      { file: 5, rank: 4, color: 'black', types: ['Schütze'] },
    ],
  ),
  sc(
    'fuse-dk',
    'Fusions',
    '1 · Doppelkavallerie',
    'Two Kavallerie stacked (DK) make two (3,2) jumps; the mid square must be empty.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Kavallerie', 'Kavallerie'] },
      { file: 7, rank: 5, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'fuse-ts',
    'Fusions',
    '2 · Tower + Schütze',
    'Tower+Schütze stack moves like Jugend (all rays).',
    [
      { file: 4, rank: 4, color: 'white', types: ['Schütze', 'Tower'] },
      { file: 4, rank: 8, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'fuse-ki',
    'Fusions',
    '3 · Kavallerie + Infanterie',
    'KI stack can use either (3,2) or (2,2) jumps — both patterns are shown as legal targets.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Infanterie', 'Kavallerie'] },
      { file: 6, rank: 6, color: 'black', types: ['Soldat'] },
      { file: 7, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'fuse-3shot',
    'Fusions',
    '4 · Triple stack shot',
    'A charged 3-stack can shoot along the top piece’s pattern (not at Volk). Select the stack and use shot buttons.',
    [
      { file: 1, rank: 4, color: 'white', types: ['Soldat', 'Tower', 'Tower'] },
      { file: 6, rank: 4, color: 'black', types: ['Schütze'] },
      { file: 8, rank: 8, color: 'black', types: ['Volk'] },
    ],
    { chargeShots: true },
  ),
]

export const RULES_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Board & camps',
    body: '10×10 (a1–j10). White camp ranks 1–3, Black 8–10. Midfield 4–7 is for reserve drops. Main pieces setup only on ranks 1–2 / 10–9.',
  },
  {
    title: 'Army',
    body: '15 Soldaten on board (0 in reserve). Must place Volk, Jugend, and 2× each Tower/Schütze/Kavallerie/Infanterie. One of each standard may stay in reserve (or be placed as a 3rd in setup).',
  },
  {
    title: 'Turns',
    body: 'One action: march (move/capture/fuse/split/shoot) or reinforce from reserve. No castling / en passant. Clocks use Fischer increment (5+3 or 10+5).',
  },
  {
    title: 'Stacks',
    body: 'Max height 3. Top piece sets the move (with fusion exceptions). Volk/Jugend must stay on top; nothing stacks onto them. Identical pairs generally cannot unstack.',
  },
  {
    title: 'Check',
    body: 'If Volk is attacked, you must resolve check. Illegal moves that leave Volk in check are rejected and logged.',
  },
]
