import type { Color, GameState, Piece, PieceType, Stack } from './types'
import {
  BLACK_SOLDIER_RANKS_1,
  WHITE_SOLDIER_RANKS_1,
  cloneBoard,
  emptyBoard,
  makePiece,
  setPieceIdCounter,
  soldierBaseRank,
} from './coords'
import { TIME_CONTROLS, type TimeControlId } from './types'

export function createInitialState(timeControl: TimeControlId = '10+5'): GameState {
  setPieceIdCounter(1)
  const tc = TIME_CONTROLS[timeControl]
  const board = emptyBoard()

  placeBaseSoldiers(board, 'white')
  placeBaseSoldiers(board, 'black')

  return {
    board,
    turn: 'white',
    phase: 'setup-doubles',
    reserve: {
      white: ['Tower', 'Schütze', 'Kavallerie', 'Infanterie'],
      black: ['Tower', 'Schütze', 'Kavallerie', 'Infanterie'],
    },
    setup: {
      white: {
        passed: false,
        doublesConfirmed: false,
        doubleFiles: [],
        pool: {
          Volk: 1,
          Jugend: 1,
          Tower: 2,
          Schütze: 2,
          Kavallerie: 2,
          Infanterie: 2,
        },
      },
      black: {
        passed: false,
        doublesConfirmed: false,
        doubleFiles: [],
        pool: {
          Volk: 1,
          Jugend: 1,
          Tower: 2,
          Schütze: 2,
          Kavallerie: 2,
          Infanterie: 2,
        },
      },
    },
    shotReady: new Set(),
    clocksMs: { white: tc.initialMs, black: tc.initialMs },
    timeControl: tc,
    result: null,
    endReason: null,
    log: [
      {
        id: 1,
        level: 'system',
        message: 'Setup: choose 5 double-Soldat files (White first). Base pawns are fixed.',
        at: Date.now(),
      },
    ],
    positionHistory: [],
    nextPieceId: 100,
    pendingPromotion: null,
  }
}

function placeBaseSoldiers(board: (Stack | null)[][], color: Color): void {
  const ranks = color === 'white' ? WHITE_SOLDIER_RANKS_1 : BLACK_SOLDIER_RANKS_1
  for (let file = 0; file < 10; file++) {
    const rank = ranks[file]! - 1
    board[file]![rank] = [makePiece('Soldat', color)]
  }
}

export function applyDoublesToBoard(state: GameState, color: Color): GameState {
  const board = cloneBoard(state.board)
  const files = state.setup[color].doubleFiles
  let nextId = state.nextPieceId
  for (const file of files) {
    const rank = soldierBaseRank(color, file)
    const cell = board[file]![rank]
    if (!cell || cell.length !== 1 || cell[0]!.type !== 'Soldat') continue
    cell.push(makePiece('Soldat', color, nextId))
    nextId += 1
  }
  return { ...state, board, nextPieceId: nextId }
}

export function countOnBoard(state: GameState, color: Color, type: PieceType): number {
  let n = 0
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack) continue
      for (const p of stack) {
        if (p.color === color && p.type === type) n++
      }
    }
  }
  return n
}

export function hasMinimumArmy(state: GameState, color: Color): boolean {
  if (countOnBoard(state, color, 'Volk') < 1) return false
  if (countOnBoard(state, color, 'Jugend') < 1) return false
  for (const t of ['Tower', 'Schütze', 'Kavallerie', 'Infanterie'] as PieceType[]) {
    if (countOnBoard(state, color, t) < 2) return false
  }
  // 15 soldiers after doubles confirmed
  if (countOnBoard(state, color, 'Soldat') < 15) return false
  return true
}

export function stackAt(state: GameState, file: number, rank: number): Stack | null {
  return state.board[file]?.[rank] ?? null
}

export function findVolk(state: GameState, color: Color): { file: number; rank: number } | null {
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack) continue
      if (stack.some((p) => p.type === 'Volk' && p.color === color)) {
        return { file: f, rank: r }
      }
    }
  }
  return null
}

export function appendLog(
  state: GameState,
  level: GameState['log'][0]['level'],
  message: string,
): GameState {
  const id = (state.log.at(-1)?.id ?? 0) + 1
  return {
    ...state,
    log: [...state.log, { id, level, message, at: Date.now() }],
  }
}

export function piecesInStackTypes(stack: Stack): PieceType[] {
  return stack.map((p) => p.type)
}

export function isRoyalTop(piece: Piece | undefined): boolean {
  return piece?.type === 'Volk' || piece?.type === 'Jugend'
}
