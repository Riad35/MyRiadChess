/** Schach 2 — shared engine types (renderer-agnostic). */

export type Color = 'white' | 'black'

export type PieceType =
  | 'Volk'
  | 'Jugend'
  | 'Tower'
  | 'Schütze'
  | 'Kavallerie'
  | 'Infanterie'
  | 'Soldat'

export const PIECE_LETTER: Record<PieceType, string> = {
  Volk: 'V',
  Jugend: 'J',
  Tower: 'T',
  Schütze: 'S',
  Kavallerie: 'K',
  Infanterie: 'I',
  Soldat: 'P',
}

export const STANDARD_TYPES: PieceType[] = [
  'Tower',
  'Schütze',
  'Kavallerie',
  'Infanterie',
]

export interface Piece {
  id: string
  type: PieceType
  color: Color
}

/** Bottom = index 0, top = last. */
export type Stack = Piece[]

export type Phase = 'setup-doubles' | 'setup-mains' | 'play' | 'ended'

export type TimeControlId = '5+3' | '10+5'

export interface TimeControl {
  id: TimeControlId
  initialMs: number
  incrementMs: number
}

export const TIME_CONTROLS: Record<TimeControlId, TimeControl> = {
  '5+3': { id: '5+3', initialMs: 5 * 60_000, incrementMs: 3_000 },
  '10+5': { id: '10+5', initialMs: 10 * 60_000, incrementMs: 5_000 },
}

export type LogLevel = 'info' | 'move' | 'illegal' | 'system'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  at: number
}

export type GameResult = 'white' | 'black' | 'draw' | null

export interface SetupSide {
  passed: boolean
  doublesConfirmed: boolean
  /** File indices 0–9 marked as double soldiers. */
  doubleFiles: number[]
  /** Remaining mandatory placements (not yet on board). */
  pool: Partial<Record<PieceType, number>>
}

export interface GameState {
  board: (Stack | null)[][] // [file 0-9][rank 0-9]
  turn: Color
  phase: Phase
  reserve: Record<Color, PieceType[]>
  setup: Record<Color, SetupSide>
  /** Squares "file,rank" that have an unused 3-stack shot. */
  shotReady: Set<string>
  clocksMs: Record<Color, number>
  timeControl: TimeControl
  result: GameResult
  endReason: string | null
  log: LogEntry[]
  positionHistory: string[]
  nextPieceId: number
  pendingPromotion: null | {
    color: Color
    squares: { file: number; rank: number; isDouble: boolean }[]
  }
}

export type Action =
  | { type: 'confirm-doubles'; color: Color; files: number[] }
  | { type: 'toggle-double-file'; color: Color; file: number }
  | { type: 'place'; color: Color; piece: PieceType; file: number; rank: number }
  | { type: 'pass-setup'; color: Color }
  | {
      type: 'march'
      fromFile: number
      fromRank: number
      toFile: number
      toRank: number
      /** For Kavallerie+Infanterie choice, or multi-step paths. */
      mode?: 'kavallerie' | 'infanterie' | 'split' | 'unit'
      path?: { file: number; rank: number }[]
    }
  | {
      type: 'shoot'
      fromFile: number
      fromRank: number
      toFile: number
      toRank: number
    }
  | {
      type: 'drop'
      piece: PieceType
      file: number
      rank: number
      /** After forming 3-stack via drop: shoot immediately instead of ending turn as drop-only. */
      shootFile?: number
      shootRank?: number
    }
  | {
      type: 'promote'
      choices: PieceType[]
    }
  | { type: 'tick'; nowMs: number; side: Color }
  | { type: 'new-game'; timeControl: TimeControlId }

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string; state: GameState }
