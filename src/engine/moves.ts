/**
 * Movement patterns & attack generation for Myriad Chess.
 * Pure functions — no React.
 */
import type { Color, GameState, PieceType, Stack } from './types'
import {
  enemy,
  FILES,
  forwardDir,
  inBounds,
  RANKS,
  sqKey,
  top,
} from './coords'
import { findKoenig } from './state'

export interface Target {
  file: number
  rank: number
  kind: 'move' | 'capture' | 'fuse' | 'split' | 'shoot'
  /** Optional path squares for multi-leg moves (exclusive of start, inclusive of end). */
  path?: { file: number; rank: number }[]
  mode?: 'ritter' | 'drache' | 'split' | 'unit'
}

export type CheckThreat = {
  kind: 'ray' | 'leap'
  /** Ray: attacker through the path to the König. Leap: the attacker only. */
  squares: { file: number; rank: number }[]
}

function cell(state: GameState, f: number, r: number): Stack | null {
  if (!inBounds(f, r)) return null
  return state.board[f]![r] ?? null
}

function occupiedBy(state: GameState, f: number, r: number, color: Color): boolean {
  const t = top(cell(state, f, r))
  return !!t && t.color === color
}

function occupiedEnemy(state: GameState, f: number, r: number, color: Color): boolean {
  const t = top(cell(state, f, r))
  return !!t && t.color === enemy(color)
}

function empty(state: GameState, f: number, r: number): boolean {
  return !cell(state, f, r)
}

/** Effective move identity of a stack (top + special combos). */
export function effectiveMover(stack: Stack): {
  primary: PieceType
  combo: 'none' | 'bishop-turm' | 'drache-ritter' | 'double-ritter' | 'double-drache' | 'double-bishop' | 'double-turm'
} {
  const topP = stack[stack.length - 1]!
  if (stack.length >= 2) {
    const a = stack[stack.length - 1]!.type
    const b = stack[stack.length - 2]!.type
    if (a === 'Ritter' && b === 'Ritter') return { primary: a, combo: 'double-ritter' }
    if (a === 'Drache' && b === 'Drache') return { primary: a, combo: 'double-drache' }
    if (a === 'Bishop' && b === 'Bishop') return { primary: a, combo: 'double-bishop' }
    if (a === 'Turm' && b === 'Turm') return { primary: a, combo: 'double-turm' }
    const types = new Set(stack.map((p) => p.type))
    if (types.has('Turm') && types.has('Bishop') && !types.has('König') && !types.has('Dame')) {
      // physical 2-stack Bishop+Turm (order irrelevant for move)
      if (stack.length === 2 && ((a === 'Turm' && b === 'Bishop') || (a === 'Bishop' && b === 'Turm'))) {
        return { primary: 'Dame', combo: 'bishop-turm' }
      }
    }
    if (
      stack.length === 2 &&
      ((a === 'Ritter' && b === 'Drache') || (a === 'Drache' && b === 'Ritter'))
    ) {
      return { primary: a, combo: 'drache-ritter' }
    }
  }
  return { primary: topP.type, combo: 'none' }
}

const LOCKED_FIGURES = new Set([
  'double-drache',
  'double-ritter',
  'double-bishop',
  'bishop-turm',
  'drache-ritter',
  'double-turm',
])

function lockedFigure(stack: Stack): boolean {
  return LOCKED_FIGURES.has(effectiveMover(stack).combo)
}

/**
 * Pieces that actually leave the square.
 * Locked pairs and a Doppelsoldat move together. Otherwise only the top
 * group leaves, and whatever sits underneath stays where it is.
 */
export function carriedStack(stack: Stack): Stack {
  if (stack.length <= 1) return stack
  if (stack.length === 2) {
    if (lockedFigure(stack) || stack.every((p) => p.type === 'Soldat')) return stack
    return [stack[1]!]
  }
  const bottom = stack[0]!
  const mid = stack[stack.length - 2]!
  const topPiece = stack[stack.length - 1]!
  if (mid.type === topPiece.type && bottom.type !== topPiece.type) return [mid, topPiece]
  return [topPiece]
}

function canFuseOnto(moving: Stack, target: Stack): string | null {
  if (lockedFigure(moving) || lockedFigure(target)) return 'This figure stays as it is'
  if (target.length + moving.length > 3) return 'Cannot stack above height 3'
  const tTop = top(target)!
  if (tTop.type === 'König' || tTop.type === 'Dame') return 'Cannot stack onto König or Dame'
  const mTop = top(moving)!
  if (mTop.type === 'König' && target.some((p) => p.type === 'Soldat')) {
    return 'König cannot stack onto Soldaten'
  }
  if (
    (mTop.type === 'König' || mTop.type === 'Dame') &&
    target.some((p) => p.type === 'König' || p.type === 'Dame')
  ) {
    return 'König and Dame cannot share a stack'
  }
  // identical royals already covered
  return null
}

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const
const ALL8 = [...ORTHO, ...DIAG] as const

function slide(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  dirs: readonly (readonly [number, number])[],
  moving: Stack,
  kindShoot = false,
): Target[] {
  const out: Target[] = []
  for (const [df, dr] of dirs) {
    let f = file + df
    let r = rank + dr
    while (inBounds(f, r)) {
      const occ = cell(state, f, r)
      if (!occ) {
        out.push({ file: f, rank: r, kind: kindShoot ? 'shoot' : 'move' })
      } else {
        const t = top(occ)!
        if (t.color === color) {
          if (!kindShoot) {
            const err = canFuseOnto(moving, occ)
            if (!err) out.push({ file: f, rank: r, kind: 'fuse' })
          }
        } else {
          out.push({ file: f, rank: r, kind: kindShoot ? 'shoot' : 'capture' })
        }
        break
      }
      f += df
      r += dr
    }
  }
  return out
}

function jumps(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  offsets: [number, number][],
  moving: Stack,
  kindShoot = false,
): Target[] {
  const out: Target[] = []
  for (const [df, dr] of offsets) {
    const f = file + df
    const r = rank + dr
    if (!inBounds(f, r)) continue
    const occ = cell(state, f, r)
    if (!occ) {
      out.push({ file: f, rank: r, kind: kindShoot ? 'shoot' : 'move' })
    } else if (top(occ)!.color !== color) {
      out.push({ file: f, rank: r, kind: kindShoot ? 'shoot' : 'capture' })
    } else if (!kindShoot) {
      const err = canFuseOnto(moving, occ)
      if (!err) out.push({ file: f, rank: r, kind: 'fuse' })
    }
  }
  return out
}

const KAV_OFFSETS: [number, number][] = [
  [3, 2],
  [3, -2],
  [-3, 2],
  [-3, -2],
  [2, 3],
  [2, -3],
  [-2, 3],
  [-2, -3],
]
const INF_OFFSETS: [number, number][] = [
  [2, 2],
  [2, -2],
  [-2, 2],
  [-2, -2],
]

function soldatTargets(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  stack: Stack,
): Target[] {
  const out: Target[] = []
  const dir = forwardDir(color)
  const isDouble = stack.length === 2 && stack.every((p) => p.type === 'Soldat')
  const isPassiveBase =
    stack.length >= 2 &&
    stack[0]!.type === 'Soldat' &&
    stack[stack.length - 1]!.type !== 'Soldat'

  if (isPassiveBase) return out // soldier rights extinguished

  // Unit forward 1 / 2
  const f1 = file
  const r1 = rank + dir
  if (inBounds(f1, r1) && empty(state, f1, r1)) {
    out.push({ file: f1, rank: r1, kind: 'move', mode: 'unit' })
    const r2 = rank + 2 * dir
    if (inBounds(f1, r2) && empty(state, f1, r2)) {
      out.push({ file: f1, rank: r2, kind: 'move', mode: 'unit' })
    }
  }

  // Unit diagonal captures (single or double as unit)
  for (const df of [-1, 1]) {
    for (const dr of [dir, -dir]) {
      const f = file + df
      const r = rank + dr
      if (!inBounds(f, r)) continue
      if (occupiedEnemy(state, f, r, color)) {
        out.push({ file: f, rank: r, kind: 'capture', mode: 'unit' })
      }
    }
  }

  // Split options (double only): top moves
  if (isDouble) {
    for (const df of [-1, 1]) {
      for (const dr of [dir, -dir]) {
        const f = file + df
        const r = rank + dr
        if (!inBounds(f, r)) continue
        if (occupiedEnemy(state, f, r, color)) {
          out.push({ file: f, rank: r, kind: 'split', mode: 'split' })
        }
      }
    }
    for (const [df, dr] of ORTHO) {
      const f = file + df
      const r = rank + dr
      if (!inBounds(f, r)) continue
      if (empty(state, f, r)) {
        out.push({ file: f, rank: r, kind: 'split', mode: 'split' })
      } else if (
        occupiedBy(state, f, r, color) &&
        cell(state, f, r)!.length === 1 &&
        top(cell(state, f, r))!.type === 'Soldat'
      ) {
        // rare: land on own single soldier via orthogonal? rules say empty ortho only for free split
        // backward diagonal capture onto own soldier creates new double — that's diagonal split capture path
      }
    }
    // Split capture onto own soldier (backward/forward diagonal) → new double
    for (const df of [-1, 1]) {
      for (const dr of [dir, -dir]) {
        const f = file + df
        const r = rank + dr
        if (!inBounds(f, r)) continue
        const occ = cell(state, f, r)
        if (
          occ &&
          occ.length === 1 &&
          occ[0]!.type === 'Soldat' &&
          occ[0]!.color === color
        ) {
          out.push({ file: f, rank: r, kind: 'split', mode: 'split' })
        }
      }
    }
  }

  return out
}

function onRim(file: number, rank: number) {
  return file === 0 || rank === 0 || file === FILES - 1 || rank === RANKS - 1
}

/**
 * Chess-rook slide, plus one 90° turn from an empty outermost square that slide reaches.
 * That turn stays on the outermost squares. A capture or a fusion ends the move.
 * There is no second bounce and no castling.
 */
function doubleTurmTargets(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  moving: Stack,
  kindShoot = false,
): Target[] {
  const out: Target[] = []
  const stopOn = (f: number, r: number, occ: Stack, path: { file: number; rank: number }[]) => {
    if (top(occ)!.color !== color) {
      out.push({
        file: f,
        rank: r,
        kind: kindShoot ? 'shoot' : 'capture',
        path: [...path, { file: f, rank: r }],
      })
      return
    }
    if (kindShoot) return
    const err = canFuseOnto(moving, occ)
    if (!err) {
      out.push({ file: f, rank: r, kind: 'fuse', path: [...path, { file: f, rank: r }] })
    }
  }

  for (const [df, dr] of ORTHO) {
    let f = file + df
    let r = rank + dr
    const path: { file: number; rank: number }[] = []
    while (inBounds(f, r)) {
      const occ = cell(state, f, r)
      if (occ) {
        stopOn(f, r, occ, path)
        break
      }
      path.push({ file: f, rank: r })
      if (!kindShoot) out.push({ file: f, rank: r, kind: 'move', path: [...path] })
      if (onRim(f, r)) {
        const turns: [number, number][] =
          df !== 0
            ? [
                [0, 1],
                [0, -1],
              ]
            : [
                [1, 0],
                [-1, 0],
              ]
        for (const [df2, dr2] of turns) {
          let f2 = f + df2
          let r2 = r + dr2
          const path2 = [...path]
          while (inBounds(f2, r2)) {
            if (f2 === file && r2 === rank) break
            if (!onRim(f2, r2)) break
            const occ2 = cell(state, f2, r2)
            if (occ2) {
              stopOn(f2, r2, occ2, path2)
              break
            }
            path2.push({ file: f2, rank: r2 })
            if (!kindShoot) out.push({ file: f2, rank: r2, kind: 'move', path: [...path2] })
            f2 += df2
            r2 += dr2
          }
        }
      }
      f += df
      r += dr
    }
  }
  return out
}

function doubleJumpTargets(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  offsets: [number, number][],
  moving: Stack,
): Target[] {
  const out: Target[] = []
  for (const [df1, dr1] of offsets) {
    const m1f = file + df1
    const m1r = rank + dr1
    if (!inBounds(m1f, m1r) || !empty(state, m1f, m1r)) continue
    for (const [df2, dr2] of offsets) {
      const m2f = m1f + df2
      const m2r = m1r + dr2
      if (!inBounds(m2f, m2r)) continue
      if (m2f === file && m2r === rank) continue
      const occ = cell(state, m2f, m2r)
      const path = [
        { file: m1f, rank: m1r },
        { file: m2f, rank: m2r },
      ]
      if (!occ) {
        out.push({ file: m2f, rank: m2r, kind: 'move', path })
      } else if (top(occ)!.color !== color) {
        out.push({ file: m2f, rank: m2r, kind: 'capture', path })
      } else {
        const err = canFuseOnto(moving, occ)
        if (!err) out.push({ file: m2f, rank: m2r, kind: 'fuse', path })
      }
    }
  }
  return out
}

/** One diagonal slide. A board edge flips the axis that hit it, once. Pieces stop the ray. */
function doppelbishopTargets(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  moving: Stack,
  kindShoot = false,
): Target[] {
  const out: Target[] = []
  for (const [df0, dr0] of DIAG) {
    let df: number = df0
    let dr: number = dr0
    let f = file
    let r = rank
    let bounced = false
    const path: { file: number; rank: number }[] = []
    const visited = new Set<string>([sqKey(file, rank)])
    while (path.length < FILES * RANKS) {
      const nf = f + df
      const nr = r + dr
      if (!inBounds(nf, nr)) {
        if (bounced || path.length === 0) break
        const ndf = nf < 0 || nf >= FILES ? -df : df
        const ndr = nr < 0 || nr >= RANKS ? -dr : dr
        if (ndf === df && ndr === dr) break
        df = ndf
        dr = ndr
        bounced = true
        continue
      }
      const key = sqKey(nf, nr)
      if (visited.has(key)) break
      visited.add(key)
      const occ = cell(state, nf, nr)
      path.push({ file: nf, rank: nr })
      if (!occ) {
        if (!kindShoot) out.push({ file: nf, rank: nr, kind: 'move', path: [...path] })
      } else {
        const t = top(occ)!
        if (t.color === color) {
          if (!kindShoot) {
            const err = canFuseOnto(moving, occ)
            if (!err) out.push({ file: nf, rank: nr, kind: 'fuse', path: [...path] })
          }
        } else {
          out.push({ file: nf, rank: nr, kind: kindShoot ? 'shoot' : 'capture', path: [...path] })
        }
        break
      }
      f = nf
      r = nr
    }
  }
  return out
}

const moveCache = new WeakMap<(Stack | null)[][], Map<string, Target[]>>()

export function generateMovesFrom(
  state: GameState,
  file: number,
  rank: number,
  opts?: { mode?: 'ritter' | 'drache'; asShoot?: boolean },
): Target[] {
  if (opts?.asShoot || opts?.mode) return collectMoves(state, file, rank, opts)
  let bySquare = moveCache.get(state.board)
  if (!bySquare) {
    bySquare = new Map()
    moveCache.set(state.board, bySquare)
  }
  const key = sqKey(file, rank)
  const hit = bySquare.get(key)
  if (hit) return hit
  const moves = collectMoves(state, file, rank)
  bySquare.set(key, moves)
  return moves
}

function collectMoves(
  state: GameState,
  file: number,
  rank: number,
  opts?: { mode?: 'ritter' | 'drache'; asShoot?: boolean },
): Target[] {
  const stack = cell(state, file, rank)
  if (!stack || stack.length === 0) return []
  const color = top(stack)!.color
  const shoot = !!opts?.asShoot

  if (shoot) {
    const { primary, combo } = effectiveMover(stack)
    // shoot uses top pattern; cannot hit enemy König
    let raw: Target[] = []
    if (combo === 'double-bishop') {
      raw = doppelbishopTargets(state, color, file, rank, stack, true)
    } else if (combo === 'double-turm') {
      raw = doubleTurmTargets(state, color, file, rank, stack, true)
    } else if (combo === 'bishop-turm' || primary === 'Dame') {
      raw = slide(state, color, file, rank, ALL8, stack, true)
    } else if (primary === 'Turm') {
      raw = slide(state, color, file, rank, ORTHO, stack, true)
    } else if (primary === 'Bishop') {
      raw = slide(state, color, file, rank, DIAG, stack, true)
    } else if (primary === 'König') {
      for (const [df, dr] of ALL8) {
        const f = file + df
        const r = rank + dr
        if (!inBounds(f, r)) continue
        const occ = cell(state, f, r)
        if (occ && top(occ)!.color !== color) {
          raw.push({ file: f, rank: r, kind: 'shoot' })
        }
      }
    } else if (primary === 'Ritter' || combo === 'double-ritter') {
      raw = jumps(state, color, file, rank, KAV_OFFSETS, stack, true)
    } else if (primary === 'Drache' || combo === 'double-drache') {
      raw = jumps(state, color, file, rank, INF_OFFSETS, stack, true)
    } else if (combo === 'drache-ritter') {
      const mode = opts?.mode ?? 'ritter'
      raw = jumps(
        state,
        color,
        file,
        rank,
        mode === 'drache' ? INF_OFFSETS : KAV_OFFSETS,
        stack,
        true,
      )
    }
    return raw.filter((t) => {
      const occ = cell(state, t.file, t.rank)
      if (!occ) return false
      if (occ.some((p) => p.type === 'König' && p.color !== color)) return false
      return top(occ)!.color !== color
    })
  }

  const moving = carriedStack(stack)
  const { primary, combo } = effectiveMover(moving)
  const finish = (targets: Target[]) =>
    moving.length < stack.length ? targets.filter((t) => t.kind !== 'split') : targets

  if (primary === 'Soldat' || (moving.every((p) => p.type === 'Soldat') && moving.length <= 2)) {
    if (top(moving)!.type === 'Soldat') return finish(soldatTargets(state, color, file, rank, moving))
  }

  switch (combo) {
    case 'double-turm':
      return finish(doubleTurmTargets(state, color, file, rank, moving))
    case 'double-ritter':
      return finish(doubleJumpTargets(state, color, file, rank, KAV_OFFSETS, moving))
    case 'double-drache':
      return finish(doubleJumpTargets(state, color, file, rank, INF_OFFSETS, moving))
    case 'double-bishop':
      return finish(doppelbishopTargets(state, color, file, rank, moving))
    case 'bishop-turm':
      return finish(slide(state, color, file, rank, ALL8, moving))
    case 'drache-ritter': {
      // Show both patterns — no manual mode toggle (chess-like click-to-move).
      if (opts?.mode === 'drache') {
        return finish(
          jumps(state, color, file, rank, INF_OFFSETS, moving).map((t) => ({
            ...t,
            mode: 'drache' as const,
          })),
        )
      }
      if (opts?.mode === 'ritter') {
        return finish(
          jumps(state, color, file, rank, KAV_OFFSETS, moving).map((t) => ({
            ...t,
            mode: 'ritter' as const,
          })),
        )
      }
      return finish([
        ...jumps(state, color, file, rank, KAV_OFFSETS, moving).map((t) => ({
          ...t,
          mode: 'ritter' as const,
        })),
        ...jumps(state, color, file, rank, INF_OFFSETS, moving).map((t) => ({
          ...t,
          mode: 'drache' as const,
        })),
      ])
    }
    default:
      break
  }

  switch (primary) {
    case 'König': {
      const out: Target[] = []
      for (const [df, dr] of ALL8) {
        const f = file + df
        const r = rank + dr
        if (!inBounds(f, r)) continue
        const occ = cell(state, f, r)
        if (!occ) out.push({ file: f, rank: r, kind: 'move' })
        else if (top(occ)!.color !== color) out.push({ file: f, rank: r, kind: 'capture' })
        else {
          const err = canFuseOnto(moving, occ)
          if (!err) out.push({ file: f, rank: r, kind: 'fuse' })
        }
      }
      return finish(out)
    }
    case 'Dame':
      return finish(slide(state, color, file, rank, ALL8, moving))
    case 'Turm':
      return finish(slide(state, color, file, rank, ORTHO, moving))
    case 'Bishop':
      return finish(slide(state, color, file, rank, DIAG, moving))
    case 'Ritter':
      return finish(jumps(state, color, file, rank, KAV_OFFSETS, moving))
    case 'Drache':
      return finish(jumps(state, color, file, rank, INF_OFFSETS, moving))
    case 'Soldat':
      return finish(soldatTargets(state, color, file, rank, moving))
    default:
      return []
  }
}

function countsAsAttack(kind: Target['kind']): boolean {
  return kind === 'capture' || kind === 'move'
}

/** Squares a side can move or capture onto. Shots are not attacks. */
export function attackedSquares(state: GameState, by: Color): Set<string> {
  const set = new Set<string>()
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack || top(stack)?.color !== by) continue
      for (const m of generateMovesFrom(state, f, r)) {
        if (countsAsAttack(m.kind)) set.add(sqKey(m.file, m.rank))
      }
    }
  }
  return set
}

export function isSquareAttacked(state: GameState, file: number, rank: number, by: Color): boolean {
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack || top(stack)?.color !== by) continue
      for (const m of generateMovesFrom(state, f, r)) {
        if (countsAsAttack(m.kind) && m.file === file && m.rank === rank) return true
      }
    }
  }
  return false
}

export function isKoenigInCheck(state: GameState, color: Color): boolean {
  const pos = findKoenig(state, color)
  if (!pos) return false
  return isSquareAttacked(state, pos.file, pos.rank, enemy(color))
}

function isLeapThreat(stack: Stack): boolean {
  const { primary, combo } = effectiveMover(carriedStack(stack))
  if (combo === 'double-ritter' || combo === 'double-drache' || combo === 'drache-ritter') return true
  if (combo !== 'none') return false
  return primary === 'Ritter' || primary === 'Drache'
}

function alignedLine(
  from: { file: number; rank: number },
  to: { file: number; rank: number },
): { file: number; rank: number }[] | null {
  const df = Math.sign(to.file - from.file)
  const dr = Math.sign(to.rank - from.rank)
  const stepsF = Math.abs(to.file - from.file)
  const stepsR = Math.abs(to.rank - from.rank)
  if (stepsF !== 0 && stepsR !== 0 && stepsF !== stepsR) return null
  const n = Math.max(stepsF, stepsR)
  const out: { file: number; rank: number }[] = []
  for (let i = 0; i <= n; i++) out.push({ file: from.file + df * i, rank: from.rank + dr * i })
  return out
}

/** Attacker, then every square of the move, through to the landing square. */
function attackSquares(
  start: { file: number; rank: number },
  move: Target,
): { file: number; rank: number }[] {
  const end = { file: move.file, rank: move.rank }
  const marks = move.path && move.path.length > 0 ? move.path : [end]
  const squares = [start]
  let prev = start
  for (const mark of marks) {
    const seg = alignedLine(prev, mark)
    if (seg) squares.push(...seg.slice(1))
    else if (prev.file !== mark.file || prev.rank !== mark.rank) squares.push(mark)
    prev = mark
  }
  if (prev.file !== end.file || prev.rank !== end.rank) {
    const seg = alignedLine(prev, end)
    if (seg) squares.push(...seg.slice(1))
    else squares.push(end)
  }
  return squares
}

/** Enemy pieces that attack this color's König, with the squares the check light follows. */
export function checkingThreats(state: GameState, color: Color): CheckThreat[] {
  const king = findKoenig(state, color)
  if (!king) return []
  const by = enemy(color)
  const threats: CheckThreat[] = []
  for (let f = 0; f < FILES; f++) {
    for (let r = 0; r < RANKS; r++) {
      const stack = state.board[f]![r]
      if (!stack || top(stack)?.color !== by) continue
      const hits = generateMovesFrom(state, f, r).filter(
        (m) => m.kind === 'capture' && m.file === king.file && m.rank === king.rank,
      )
      if (hits.length === 0) continue
      if (isLeapThreat(stack)) {
        threats.push({ kind: 'leap', squares: [{ file: f, rank: r }] })
        continue
      }
      let best: { file: number; rank: number }[] | null = null
      for (const hit of hits) {
        const path = attackSquares({ file: f, rank: r }, hit)
        if (!best || path.length < best.length) best = path
      }
      if (best) threats.push({ kind: 'ray', squares: best })
    }
  }
  return threats
}

export function wouldLeaveKoenigInCheck(
  state: GameState,
  color: Color,
  mutate: (s: GameState) => void,
  touch: { file: number; rank: number }[] = [],
): boolean {
  const board = state.board.map((file) => file.slice())
  const seen = new Set<number>()
  const squares = touch.length > 0 ? touch : allSquares()
  for (const sq of squares) {
    const id = sq.file * 10 + sq.rank
    if (seen.has(id)) continue
    seen.add(id)
    const cell = state.board[sq.file]?.[sq.rank]
    if (cell) board[sq.file]![sq.rank] = cell.map((p) => ({ ...p }))
  }
  const draft: GameState = { ...state, board, shotReady: new Set(state.shotReady) }
  mutate(draft)
  return isKoenigInCheck(draft, color)
}

function allSquares(): { file: number; rank: number }[] {
  const squares: { file: number; rank: number }[] = []
  for (let file = 0; file < FILES; file++) {
    for (let rank = 0; rank < RANKS; rank++) squares.push({ file, rank })
  }
  return squares
}
