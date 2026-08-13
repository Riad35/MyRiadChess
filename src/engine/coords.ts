import type { Color, Piece, PieceType, Stack } from './types'

export const FILES = 10
export const RANKS = 10
export const FILE_CHARS = 'abcdefghij'

export function inBounds(file: number, rank: number): boolean {
  return file >= 0 && file < FILES && rank >= 0 && rank < RANKS
}

export function sqKey(file: number, rank: number): string {
  return `${file},${rank}`
}

export function parseKey(key: string): { file: number; rank: number } {
  const [f, r] = key.split(',').map(Number)
  return { file: f, rank: r }
}

export function algebraic(file: number, rank: number): string {
  return `${FILE_CHARS[file]}${rank + 1}`
}

export function enemy(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

export function forwardDir(color: Color): number {
  return color === 'white' ? 1 : -1
}

/** Last rank index for promotion (0-based). */
export function promotionRank(color: Color): number {
  return color === 'white' ? 9 : 0
}

/** White soldier base ranks (1-based): A2 B3 C2 D3 E2 F2 G3 H2 I3 J2 */
export const WHITE_SOLDIER_RANKS_1 = [2, 3, 2, 3, 2, 2, 3, 2, 3, 2]
/** Black mirrors: A9 B8 C9 D8 E9 F9 G8 H9 I8 J9 */
export const BLACK_SOLDIER_RANKS_1 = [9, 8, 9, 8, 9, 9, 8, 9, 8, 9]

export function soldierBaseRank(color: Color, file: number): number {
  const list = color === 'white' ? WHITE_SOLDIER_RANKS_1 : BLACK_SOLDIER_RANKS_1
  return list[file] - 1
}

/** Setup: mains only on ranks 1–2 (white) / 10–9 (black). */
export function isMainSetupRank(color: Color, rank: number): boolean {
  if (color === 'white') return rank === 0 || rank === 1
  return rank === 8 || rank === 9
}

export function isCampRank(color: Color, rank: number): boolean {
  if (color === 'white') return rank >= 0 && rank <= 2
  return rank >= 7 && rank <= 9
}

export function isMidfield(rank: number): boolean {
  return rank >= 3 && rank <= 6
}

export function top(stack: Stack | null | undefined): Piece | null {
  if (!stack || stack.length === 0) return null
  return stack[stack.length - 1]!
}

export function cloneStack(stack: Stack | null): Stack | null {
  if (!stack) return null
  return stack.map((p) => ({ ...p }))
}

export function emptyBoard(): (Stack | null)[][] {
  return Array.from({ length: FILES }, () =>
    Array.from({ length: RANKS }, () => null),
  )
}

export function cloneBoard(board: (Stack | null)[][]): (Stack | null)[][] {
  return board.map((file) => file.map((cell) => cloneStack(cell)))
}

let _id = 1
export function resetPieceIds(start = 1): void {
  _id = start
}

export function makePiece(type: PieceType, color: Color, id?: number): Piece {
  const n = id ?? _id++
  if (id != null) _id = Math.max(_id, id + 1)
  return { id: `${color[0]}-${type}-${n}`, type, color }
}

export function setPieceIdCounter(n: number): void {
  _id = n
}

export function getPieceIdCounter(): number {
  return _id
}
