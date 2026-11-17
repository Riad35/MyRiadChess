import type { Color, GameState, PieceType, SetupSide, SetupVariant, Stack } from './types'
import {
  blankSoldierRanks,
  cloneBoard,
  emptyBoard,
  makePiece,
  setPieceIdCounter,
  zigzagSoldierRanks,
} from './coords'
import { TIME_CONTROLS, type TimeControlId } from './types'

function freshSetupSide(): SetupSide {
  return {
    passed: false,
    soldiersConfirmed: false,
    soldierRanks: blankSoldierRanks(),
    doublesConfirmed: false,
    doubleFiles: [],
    pool: {
      König: 1,
      Dame: 1,
      Turm: 2,
      Bishop: 2,
      Ritter: 2,
      Drache: 2,
    },
  }
}

/** Real match: players place Soldaten. The zigzag map is not used. */
export function createInitialState(timeControl: TimeControlId = '10+5'): GameState {
  setPieceIdCounter(1)
  const tc = TIME_CONTROLS[timeControl]

  return {
    board: emptyBoard(),
    turn: 'white',
    phase: 'setup-soldiers',
    setupVariant: 'meta',
    reserve: {
      white: ['Turm', 'Bishop', 'Ritter', 'Drache'],
      black: ['Turm', 'Bishop', 'Ritter', 'Drache'],
    },
    setup: {
      white: freshSetupSide(),
      black: freshSetupSide(),
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
        message: 'Setup: place one Soldat on each file (White first). Ranks 2–3 for White, 8–9 for Black. Not the back rank.',
        at: Date.now(),
      },
    ],
    positionHistory: [],
    nextPieceId: 1,
    pendingPromotion: null,
  }
}

/** Testing shortcut: 10 singles already on the zigzag, then the doubles phase. */
export function createZigzagSetup(timeControl: TimeControlId = '10+5'): GameState {
  const base = createInitialState(timeControl)
  const board = emptyBoard()
  placeBaseSoldiers(board, 'white')
  placeBaseSoldiers(board, 'black')
  return {
    ...base,
    board,
    phase: 'setup-doubles',
    setupVariant: 'zigzag',
    turn: 'white',
    setup: {
      white: {
        ...base.setup.white,
        soldiersConfirmed: true,
        soldierRanks: zigzagSoldierRanks('white'),
      },
      black: {
        ...base.setup.black,
        soldiersConfirmed: true,
        soldierRanks: zigzagSoldierRanks('black'),
      },
    },
    nextPieceId: 100,
    log: [
      {
        id: 1,
        level: 'system',
        message: 'Testing: zigzag soldier map. Choose 5 double-Soldat files (White first).',
        at: Date.now(),
      },
    ],
  }
}

function placeBaseSoldiers(board: (Stack | null)[][], color: Color): void {
  const ranks = zigzagSoldierRanks(color)
  for (let file = 0; file < 10; file++) {
    board[file]![ranks[file]!] = [makePiece('Soldat', color)]
  }
}

/** Fill fields missing from an older saved session. */
export function normalizeGameState(state: GameState): GameState {
  const variant: SetupVariant =
    state.setupVariant === 'meta' || state.setupVariant === 'zigzag'
      ? state.setupVariant
      : state.phase === 'setup-soldiers'
        ? 'meta'
        : 'zigzag'
  return {
    ...state,
    setupVariant: variant,
    setup: {
      white: normalizeSide(state, 'white', variant),
      black: normalizeSide(state, 'black', variant),
    },
  }
}

function normalizeSide(state: GameState, color: Color, variant: SetupVariant): SetupSide {
  const side = state.setup[color]
  const ranks =
    side.soldierRanks?.length === 10 ? side.soldierRanks : variant === 'zigzag' ? zigzagSoldierRanks(color) : blankSoldierRanks()
  return {
    passed: side.passed,
    soldiersConfirmed: side.soldiersConfirmed ?? state.phase !== 'setup-soldiers',
    soldierRanks: ranks,
    doublesConfirmed: side.doublesConfirmed,
    doubleFiles: side.doubleFiles ?? [],
    pool: side.pool,
  }
}

export function applyDoublesToBoard(state: GameState, color: Color): GameState {
  const board = cloneBoard(state.board)
  const files = state.setup[color].doubleFiles
  let nextId = state.nextPieceId
  for (const file of files) {
    const rank = state.setup[color].soldierRanks[file] ?? -1
    if (rank < 0) continue
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
  if (countOnBoard(state, color, 'König') < 1) return false
  if (countOnBoard(state, color, 'Dame') < 1) return false
  for (const t of ['Turm', 'Bishop', 'Ritter', 'Drache'] as PieceType[]) {
    if (countOnBoard(state, color, t) < 2) return false
  }
  // 15 soldiers after doubles confirmed
  if (countOnBoard(state, color, 'Soldat') < 15) return false
  return true
}

export function findKoenig(state: GameState, color: Color): { file: number; rank: number } | null {
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack) continue
      if (stack.some((p) => p.type === 'König' && p.color === color)) {
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

