import type { Color, GameState, PieceType, Stack, TimeControlId } from './types'
import { TIME_CONTROLS } from './types'
import {
  cloneBoard,
  emptyBoard,
  makePiece,
  setPieceIdCounter,
  soldierBaseRank,
} from './coords'
import { createInitialState, appendLog } from './state'
import { WHITE_SOLDIER_RANKS_1, BLACK_SOLDIER_RANKS_1 } from './coords'

function emptyPools() {
  return {
    Volk: 0,
    Jugend: 0,
    Tower: 0,
    Schütze: 0,
    Kavallerie: 0,
    Infanterie: 0,
  }
}

function put(board: (Stack | null)[][], file: number, rank: number, types: PieceType[], color: Color, id: { n: number }) {
  const stack = types.map((t) => {
    const p = makePiece(t, color, id.n)
    id.n += 1
    return p
  })
  board[file]![rank] = stack
}

/** Standard mirrored opening that skips all setup → Battle Phase. */
export function createMirroredQuickStart(timeControl: TimeControlId = '10+5'): GameState {
  setPieceIdCounter(1)
  const tc = TIME_CONTROLS[timeControl]
  const board = emptyBoard()
  const id = { n: 1 }

  // Soldiers: all 10 files single + doubles on 0,2,4,5,7 (5 doubles) both sides
  const doubleFiles = [0, 2, 4, 5, 7]
  for (let file = 0; file < 10; file++) {
    const wr = WHITE_SOLDIER_RANKS_1[file]! - 1
    const br = BLACK_SOLDIER_RANKS_1[file]! - 1
    const wStack: PieceType[] = doubleFiles.includes(file) ? ['Soldat', 'Soldat'] : ['Soldat']
    const bStack: PieceType[] = doubleFiles.includes(file) ? ['Soldat', 'Soldat'] : ['Soldat']
    put(board, file, wr, wStack, 'white', id)
    put(board, file, br, bStack, 'black', id)
  }

  // Mains on back ranks — mirrored
  // White rank 1 (0): T S K I V J I K S T  roughly classic-ish stretch
  const back: PieceType[] = ['Tower', 'Schütze', 'Kavallerie', 'Infanterie', 'Volk', 'Jugend', 'Infanterie', 'Kavallerie', 'Schütze', 'Tower']
  for (let f = 0; f < 10; f++) {
    put(board, f, 0, [back[f]!], 'white', id)
    put(board, f, 9, [back[f]!], 'black', id)
  }

  const base = createInitialState(timeControl)
  let state: GameState = {
    ...base,
    board,
    phase: 'play',
    turn: 'white',
    reserve: {
      white: ['Tower', 'Schütze', 'Kavallerie', 'Infanterie'],
      black: ['Tower', 'Schütze', 'Kavallerie', 'Infanterie'],
    },
    setup: {
      white: {
        passed: true,
        doublesConfirmed: true,
        doubleFiles,
        pool: emptyPools(),
      },
      black: {
        passed: true,
        doublesConfirmed: true,
        doubleFiles,
        pool: emptyPools(),
      },
    },
    shotReady: new Set(),
    clocksMs: { white: tc.initialMs, black: tc.initialMs },
    timeControl: tc,
    nextPieceId: id.n,
    log: [],
    positionHistory: [],
    result: null,
    endReason: null,
    pendingPromotion: null,
  }
  state = appendLog(state, 'system', 'Quick start: mirrored armies — Setting Phase skipped.')
  return state
}

export function createEmptyPlayState(timeControl: TimeControlId = '10+5'): GameState {
  setPieceIdCounter(1)
  const tc = TIME_CONTROLS[timeControl]
  const base = createInitialState(timeControl)
  return {
    ...base,
    board: emptyBoard(),
    phase: 'play',
    turn: 'white',
    reserve: { white: [], black: [] },
    setup: {
      white: { passed: true, doublesConfirmed: true, doubleFiles: [], pool: emptyPools() },
      black: { passed: true, doublesConfirmed: true, doubleFiles: [], pool: emptyPools() },
    },
    shotReady: new Set(),
    clocksMs: { white: tc.initialMs, black: tc.initialMs },
    timeControl: tc,
    nextPieceId: 1,
    log: [
      {
        id: 1,
        level: 'system',
        message: 'Testmap: empty board. Use tools to spawn / clear pieces.',
        at: Date.now(),
      },
    ],
    positionHistory: [],
  }
}

export function placeStack(
  state: GameState,
  file: number,
  rank: number,
  color: Color,
  types: PieceType[],
): GameState {
  const board = cloneBoard(state.board)
  let nextId = state.nextPieceId
  board[file]![rank] = types.map((t) => {
    const p = makePiece(t, color, nextId)
    nextId += 1
    return p
  })
  return { ...state, board, nextPieceId: nextId }
}

export function clearBoard(state: GameState): GameState {
  return { ...state, board: emptyBoard(), shotReady: new Set() }
}

export function clearColor(state: GameState, color: Color): GameState {
  const board = cloneBoard(state.board)
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const s = board[f]![r]
      if (!s) continue
      if (s[0]?.color === color) board[f]![r] = null
    }
  }
  return { ...state, board }
}

export function buildScenarioBoard(
  placements: { file: number; rank: number; color: Color; types: PieceType[] }[],
  timeControl: TimeControlId = '10+5',
  opts?: { chargeShots?: boolean },
): GameState {
  let s = createEmptyPlayState(timeControl)
  const shotReady = new Set<string>()
  for (const p of placements) {
    s = placeStack(s, p.file, p.rank, p.color, p.types)
    if (opts?.chargeShots && p.types.length === 3) {
      shotReady.add(`${p.file},${p.rank}`)
    }
  }
  s = { ...s, shotReady }
  s = appendLog(s, 'system', 'Guide scenario loaded. Click pieces to explore legal moves.')
  return s
}

/** Apply a saved composition onto setup for that side (from doubles onward). */
export function applyCompositionToSetup(
  state: GameState,
  side: Color,
  doubleFiles: number[],
  placements: { file: number; rank: number; type: PieceType }[],
): GameState {
  // Rebuild from initial, confirm doubles for both, place composition pieces for side
  const tc = state.timeControl.id
  let next = createInitialState(tc)
  const other: Color = side === 'white' ? 'black' : 'white'
  const otherDoubles =
    state.setup[other].doubleFiles.length === 5 ? state.setup[other].doubleFiles : [1, 3, 4, 6, 8]
  // apply doubles via board mutation helper from state
  next = {
    ...next,
    setup: {
      ...next.setup,
      [side]: { ...next.setup[side], doubleFiles, doublesConfirmed: true },
      [other]: { ...next.setup[other], doubleFiles: otherDoubles, doublesConfirmed: true },
    },
  }
  // Apply soldier doubles on board
  const board = cloneBoard(next.board)
  let nid = next.nextPieceId
  for (const color of [side, other] as Color[]) {
    const files = color === side ? doubleFiles : otherDoubles
    for (const file of files) {
      const rank = soldierBaseRank(color, file)
      const cell = board[file]![rank]
      if (cell && cell.length === 1) {
        cell.push(makePiece('Soldat', color, nid++))
      }
    }
  }
  next = { ...next, board, nextPieceId: nid, phase: 'setup-mains', turn: side }

  for (const pl of placements) {
    if (board[pl.file]![pl.rank]) continue
    const pool = { ...next.setup[side].pool }
    const left = pool[pl.type] ?? 0
    let reserve = { ...next.reserve, [side]: [...next.reserve[side]] }
    if (left > 0) pool[pl.type] = left - 1
    else {
      const idx = reserve[side].indexOf(pl.type)
      if (idx >= 0) reserve[side].splice(idx, 1)
      else continue
    }
    board[pl.file]![pl.rank] = [makePiece(pl.type, side, nid++)]
    next = {
      ...next,
      board: cloneBoard(board),
      reserve,
      setup: { ...next.setup, [side]: { ...next.setup[side], pool } },
      nextPieceId: nid,
    }
  }

  return appendLog(next, 'system', `Loaded composition for ${side}.`)
}
