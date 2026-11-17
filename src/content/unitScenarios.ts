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

/** Tab order in Testing → Guide → Units. Each fusion is its own tab. */
export const UNIT_ORDER = [
  'König',
  'Dame',
  'Turm',
  'Bishop',
  'Ritter',
  'Drache',
  'Soldat',
  'Edler Ritter',
  'Edler Drache',
  'Doppelbishop',
  'Doppelturm',
  'Drachenritter',
  'Doppelsoldat',
  '3-stack',
] as const

/** Interactive teaching maps for Testing → Guide → Units. */
export const UNIT_SCENARIOS: UnitScenario[] = [
  sc(
    'koenig-1',
    'König',
    '1 · One-step king',
    'König moves one square any direction. It may not step onto a threatened square.',
    [
      { file: 4, rank: 4, color: 'white', types: ['König'] },
      { file: 6, rank: 6, color: 'black', types: ['Turm'] },
    ],
  ),
  sc(
    'jugend-1',
    'Dame',
    '1 · Queen rays',
    'Dame slides any distance orthogonally or diagonally (like a chess queen).',
    [
      { file: 3, rank: 3, color: 'white', types: ['Dame'] },
      { file: 7, rank: 3, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'dame-fusion',
    'Dame',
    '2 · Bishop + Turm',
    'Bishop and Turm together are one Dame. The pair slides on every ray, orthogonal and diagonal, and does not unstack.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Bishop', 'Turm'] },
      { file: 4, rank: 8, color: 'black', types: ['Soldat'] },
      { file: 7, rank: 7, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'tower-1',
    'Turm',
    '1 · Rook lines',
    'Turm slides orthogonally. Blocked by pieces on the path.',
    [
      { file: 0, rank: 4, color: 'white', types: ['Turm'] },
      { file: 5, rank: 4, color: 'black', types: ['Drache'] },
    ],
  ),
  sc(
    'schuetze-1',
    'Bishop',
    '1 · Bishop diagonals',
    'Bishop slides diagonally only.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Bishop'] },
      { file: 6, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'kav-1',
    'Ritter',
    '1 · (3,2) jump',
    'Ritter jumps in a 3+2 L. It cannot be blocked mid-jump. Capture the enemy Drache if in range.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Ritter'] },
      { file: 7, rank: 6, color: 'black', types: ['Drache'] },
    ],
  ),
  sc(
    'kav-2',
    'Ritter',
    '2 · Jump over blockers',
    'Same jump with a friendly Soldat in between — Ritter still reaches the far square.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Ritter'] },
      { file: 3, rank: 3, color: 'white', types: ['Soldat'] },
      { file: 5, rank: 4, color: 'black', types: ['Turm'] },
    ],
  ),
  sc(
    'inf-1',
    'Drache',
    '1 · (2,2) diagonal jump',
    'Drache jumps two diagonally. Not blocked by intervening pieces.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Drache'] },
      { file: 6, rank: 6, color: 'black', types: ['Ritter'] },
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
    'edler-ritter-1',
    'Edler Ritter',
    '1 · Two jumps, capture on the end',
    'Two Ritter jump twice in (3,2) steps. The middle square must be empty. Only the end square can capture.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Ritter', 'Ritter'] },
      { file: 8, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'edler-ritter-2',
    'Edler Ritter',
    '2 · Blocked middle',
    'A piece on the first landing blocks that jump. The soldier beyond it is not a target.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Ritter', 'Ritter'] },
      { file: 5, rank: 4, color: 'white', types: ['Soldat'] },
      { file: 8, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'edler-drache-1',
    'Edler Drache',
    '1 · Two diagonal jumps',
    'Two Drache jump twice in (2,2) steps. The middle square must be empty. Capture only on the end square.',
    [
      { file: 3, rank: 3, color: 'white', types: ['Drache', 'Drache'] },
      { file: 7, rank: 7, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'edler-drache-2',
    'Edler Drache',
    '2 · Blocked middle',
    'A piece on the first landing blocks that diagonal. The soldier beyond it stays safe.',
    [
      { file: 3, rank: 3, color: 'white', types: ['Drache', 'Drache'] },
      { file: 5, rank: 5, color: 'white', types: ['Soldat'] },
      { file: 7, rank: 7, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'doppelbishop-1',
    'Doppelbishop',
    '1 · Bounce off the edge',
    'Two Bishop slide on one diagonal. Hitting the board edge flips that axis once, so the ray can bend.',
    [{ file: 6, rank: 0, color: 'white', types: ['Bishop', 'Bishop'] }],
  ),
  sc(
    'doppelbishop-2',
    'Doppelbishop',
    '2 · Stop on an enemy',
    'An enemy piece ends the ray. The Doppelbishop does not bounce past it.',
    [
      { file: 6, rank: 0, color: 'white', types: ['Bishop', 'Bishop'] },
      { file: 8, rank: 2, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'doppelturm-1',
    'Doppelturm',
    '1 · Rook slide, then one bounce off the wall',
    'Two Turm slide like a rook. A 90° turn is only from an outermost square that slide reaches, and the bent path stays on the outermost squares. The soldier straight ahead is a rook capture and stops the ray. The soldier on the a-file is reached by riding that file. The one around a mid-board corner is safe.',
    [
      { file: 2, rank: 4, color: 'white', types: ['Turm', 'Turm'] },
      { file: 2, rank: 7, color: 'black', types: ['Soldat'] },
      { file: 0, rank: 7, color: 'black', types: ['Soldat'] },
      { file: 4, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'drachenritter-1',
    'Drachenritter',
    '1 · Either jump',
    'Drache and Ritter together may use a (3,2) jump or a (2,2) jump. Both soldiers are legal targets.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Drache', 'Ritter'] },
      { file: 6, rank: 6, color: 'black', types: ['Soldat'] },
      { file: 7, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'doppelsoldat-1',
    'Doppelsoldat',
    '1 · March together',
    'The pair steps one or two squares forward, and captures one diagonal step forward or back. The pair stays a pair.',
    [
      { file: 4, rank: 3, color: 'white', types: ['Soldat', 'Soldat'] },
      { file: 5, rank: 4, color: 'black', types: ['Bishop'] },
      { file: 3, rank: 2, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'doppelsoldat-2',
    'Doppelsoldat',
    '2 · Split',
    'Only the top Soldat leaves. It can step to an empty orthogonal neighbour, or capture one diagonal step. A quiet diagonal step is illegal. The bottom Soldat stays.',
    [
      { file: 4, rank: 3, color: 'white', types: ['Soldat', 'Soldat'] },
      { file: 5, rank: 4, color: 'black', types: ['Bishop'] },
    ],
  ),
  sc(
    'stack-ritter',
    '3-stack',
    '1 · Ritter on top',
    'Soldat, Bishop, and Ritter. Only the Ritter leaves, with a (3,2) jump. The diagonal soldier is not a Bishop move.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Soldat', 'Bishop', 'Ritter'] },
      { file: 6, rank: 6, color: 'black', types: ['Soldat'] },
      { file: 7, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'stack-drache',
    '3-stack',
    '2 · Drache on top',
    'Soldat, Turm, and Drache. Only the Drache leaves, with a (2,2) jump. The soldier straight ahead is not a Turm move.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Soldat', 'Turm', 'Drache'] },
      { file: 6, rank: 6, color: 'black', types: ['Soldat'] },
      { file: 4, rank: 8, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'stack-dame',
    '3-stack',
    '3 · Dame on top',
    'Soldat, Ritter, and Dame. The Dame slides on every ray and leaves the other two behind.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Soldat', 'Ritter', 'Dame'] },
      { file: 4, rank: 8, color: 'black', types: ['Soldat'] },
      { file: 7, rank: 7, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'stack-pair',
    '3-stack',
    '4 · Edler Ritter on a Soldat',
    'When the top two match and the bottom piece is different, those two move together. The Ritter pair jumps and leaves the Soldat.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Soldat', 'Ritter', 'Ritter'] },
      { file: 8, rank: 6, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'stack-three',
    '3-stack',
    '5 · Three Turm',
    'Three identical pieces: only the top one leaves, as a single Turm. The soldier around the corner is not a Doppelturm bend.',
    [
      { file: 0, rank: 4, color: 'white', types: ['Turm', 'Turm', 'Turm'] },
      { file: 5, rank: 4, color: 'black', types: ['Soldat'] },
      { file: 3, rank: 7, color: 'black', types: ['Soldat'] },
    ],
  ),
  sc(
    'stack-shot-turm',
    '3-stack',
    '6 · Turm shot',
    'A charged 3-stack shoots with the top piece and does not move. This Turm shoots orthogonally. The König is not a target. Select the stack, then a shot button.',
    [
      { file: 1, rank: 4, color: 'white', types: ['Soldat', 'Turm', 'Turm'] },
      { file: 6, rank: 4, color: 'black', types: ['Bishop'] },
      { file: 8, rank: 8, color: 'black', types: ['König'] },
    ],
    { chargeShots: true },
  ),
  sc(
    'stack-shot-ritter',
    '3-stack',
    '7 · Ritter shot',
    'The Ritter on top shoots a (3,2) jump. The piece between the squares does not block it. A König on a jump square is not a shot target.',
    [
      { file: 4, rank: 4, color: 'white', types: ['Turm', 'Soldat', 'Ritter'] },
      { file: 5, rank: 5, color: 'black', types: ['Soldat'] },
      { file: 7, rank: 6, color: 'black', types: ['Bishop'] },
      { file: 6, rank: 7, color: 'black', types: ['König'] },
    ],
    { chargeShots: true },
  ),
  sc(
    'stack-shot-bishop',
    '3-stack',
    '8 · Bishop shot',
    'The Bishop on top shoots diagonally. A piece on the ray blocks everything behind it. The open diagonal is a target.',
    [
      { file: 2, rank: 2, color: 'white', types: ['Soldat', 'Ritter', 'Bishop'] },
      { file: 4, rank: 4, color: 'black', types: ['Soldat'] },
      { file: 6, rank: 6, color: 'black', types: ['Turm'] },
      { file: 4, rank: 0, color: 'black', types: ['Drache'] },
    ],
    { chargeShots: true },
  ),
  sc(
    'stack-shot-tall',
    '3-stack',
    '9 · What a shot removes',
    'A height-1 target is removed. A height-3 target keeps only its top piece. Both are on this Turm’s shot.',
    [
      { file: 1, rank: 1, color: 'white', types: ['Soldat', 'Soldat', 'Turm'] },
      { file: 1, rank: 4, color: 'black', types: ['Bishop'] },
      { file: 5, rank: 1, color: 'black', types: ['Soldat', 'Bishop', 'Drache'] },
    ],
    { chargeShots: true },
  ),
]

export const RULES_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Board & camps',
    body: '10×10 (a1–j10). White camp ranks 1–3, Black 8–10. In a match each player places one Soldat per file on ranks 2–3 (White) or 8–9 (Black), never the back rank. The zigzag map is a testing preset. Main pieces go only behind those Soldaten, on ranks 1–2 / 10–9. Midfield 4–7 is for reserve drops.',
  },
  {
    title: 'Army',
    body: '15 Soldaten on the board after choosing 5 doubles (0 in reserve). Must place König, Dame, and 2× each Turm/Bishop/Ritter/Drache. One of each standard may stay in reserve (or be placed as a 3rd in setup).',
  },
  {
    title: 'Turns',
    body: 'One action: march (move/capture/fuse/split/shoot) or reinforce from reserve. No castling / en passant. Clocks use Fischer increment (5+3 or 10+5).',
  },
  {
    title: 'Stacks',
    body: 'Max height 3. Top piece sets the move (with fusion exceptions). König/Dame must stay on top; nothing stacks onto them. Identical pairs generally cannot unstack.',
  },
  {
    title: 'Check',
    body: 'If König is attacked, you must resolve check. Illegal moves that leave König in check are rejected and logged.',
  },
]
