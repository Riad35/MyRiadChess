/**
 * Movement patterns & attack generation for Myriad Chess.
 * Pure functions — no React.
 */
import type { Color, GameState, PieceType, Stack } from './types'
import {
  enemy,
  forwardDir,
  inBounds,
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
  combo: 'none' | 'bishop-turm' | 'drache-ritter' | 'double-ritter' | 'double-drache' | 'double-bishop' | 'double-turm' | 'double-dame'
} {
  const topP = stack[stack.length - 1]!
  if (stack.length >= 2) {
    const a = stack[stack.length - 1]!.type
    const b = stack[stack.length - 2]!.type
    if (a === 'Ritter' && b === 'Ritter') return { primary: a, combo: 'double-ritter' }
    if (a === 'Drache' && b === 'Drache') return { primary: a, combo: 'double-drache' }
    if (a === 'Bishop' && b === 'Bishop') return { primary: a, combo: 'double-bishop' }
    if (a === 'Turm' && b === 'Turm') return { primary: a, combo: 'double-turm' }
    if (a === 'Dame' && b === 'Dame') return { primary: a, combo: 'double-dame' }
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
  'double-dame',
])

function lockedFigure(stack: Stack): boolean {
  return LOCKED_FIGURES.has(effectiveMover(stack).combo)
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
    return 'König/Dame cannot share a stack (Doppeldame only via promotion)'
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

function doubleTurmTargets(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  moving: Stack,
): Target[] {
  const out: Target[] = []
  // First leg ortho any distance, then exactly one 90° turn, second leg.
  for (const [df1, dr1] of ORTHO) {
    let f = file + df1
    let r = rank + dr1
    const path1: { file: number; rank: number }[] = []
    while (inBounds(f, r)) {
      const occ = cell(state, f, r)
      if (occ) {
        if (top(occ)!.color === color) break
        // capture stops here — no second leg
        out.push({
          file: f,
          rank: r,
          kind: 'capture',
          path: [...path1, { file: f, rank: r }],
        })
        break
      }
      path1.push({ file: f, rank: r })
      // From this empty bend point, second leg perpendicular
      const bends: [number, number][] =
        df1 !== 0
          ? [
              [0, 1],
              [0, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
            ]
      for (const [df2, dr2] of bends) {
        let f2 = f + df2
        let r2 = r + dr2
        const path2 = [...path1]
        while (inBounds(f2, r2)) {
          // disallow returning to start
          if (f2 === file && r2 === rank) break
          const occ2 = cell(state, f2, r2)
          if (!occ2) {
            path2.push({ file: f2, rank: r2 })
            out.push({ file: f2, rank: r2, kind: 'move', path: [...path2] })
          } else if (top(occ2)!.color !== color) {
            path2.push({ file: f2, rank: r2 })
            out.push({ file: f2, rank: r2, kind: 'capture', path: [...path2] })
            break
          } else {
            const err = canFuseOnto(moving, occ2)
            if (!err) {
              path2.push({ file: f2, rank: r2 })
              out.push({ file: f2, rank: r2, kind: 'fuse', path: [...path2] })
            }
            break
          }
          f2 += df2
          r2 += dr2
        }
      }
      f += df1
      r += dr1
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

export function generateMovesFrom(
  state: GameState,
  file: number,
  rank: number,
  opts?: { mode?: 'ritter' | 'drache'; asShoot?: boolean },
): Target[] {
  const stack = cell(state, file, rank)
  if (!stack || stack.length === 0) return []
  const color = top(stack)!.color
  const { primary, combo } = effectiveMover(stack)
  const shoot = !!opts?.asShoot

  if (shoot) {
    // shoot uses top pattern; cannot hit enemy König
    let raw: Target[] = []
    if (combo === 'double-bishop' || combo === 'bishop-turm' || primary === 'Dame') {
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

  if (primary === 'Soldat' || (stack.every((p) => p.type === 'Soldat') && stack.length <= 2)) {
    if (top(stack)!.type === 'Soldat') return soldatTargets(state, color, file, rank, stack)
  }

  switch (combo) {
    case 'double-turm':
      return doubleTurmTargets(state, color, file, rank, stack)
    case 'double-ritter':
      return doubleJumpTargets(state, color, file, rank, KAV_OFFSETS, stack)
    case 'double-drache':
      return doubleJumpTargets(state, color, file, rank, INF_OFFSETS, stack)
    case 'double-bishop':
    case 'bishop-turm':
      return slide(state, color, file, rank, ALL8, stack)
    case 'double-dame':
      // simplified: two queen-legs same modality generated as two-step slides
      return doubleDameTargets(state, color, file, rank, stack)
    case 'drache-ritter': {
      // Show both patterns — no manual mode toggle (chess-like click-to-move).
      if (opts?.mode === 'drache') {
        return jumps(state, color, file, rank, INF_OFFSETS, stack).map((t) => ({
          ...t,
          mode: 'drache' as const,
        }))
      }
      if (opts?.mode === 'ritter') {
        return jumps(state, color, file, rank, KAV_OFFSETS, stack).map((t) => ({
          ...t,
          mode: 'ritter' as const,
        }))
      }
      return [
        ...jumps(state, color, file, rank, KAV_OFFSETS, stack).map((t) => ({
          ...t,
          mode: 'ritter' as const,
        })),
        ...jumps(state, color, file, rank, INF_OFFSETS, stack).map((t) => ({
          ...t,
          mode: 'drache' as const,
        })),
      ]
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
          const err = canFuseOnto(stack, occ)
          if (!err) out.push({ file: f, rank: r, kind: 'fuse' })
        }
      }
      return out
    }
    case 'Dame':
      return slide(state, color, file, rank, ALL8, stack)
    case 'Turm':
      return slide(state, color, file, rank, ORTHO, stack)
    case 'Bishop':
      return slide(state, color, file, rank, DIAG, stack)
    case 'Ritter':
      return jumps(state, color, file, rank, KAV_OFFSETS, stack)
    case 'Drache':
      return jumps(state, color, file, rank, INF_OFFSETS, stack)
    case 'Soldat':
      return soldatTargets(state, color, file, rank, stack)
    default:
      return []
  }
}

function doubleDameTargets(
  state: GameState,
  color: Color,
  file: number,
  rank: number,
  moving: Stack,
): Target[] {
  // Generate all positions reachable in 1 queen move, then from there another of SAME modality
  const out: Target[] = []
  const firstOrtho = slide(state, color, file, rank, ORTHO, moving)
  const firstDiag = slide(state, color, file, rank, DIAG, moving)

  const expand = (first: Target[], dirs: readonly (readonly [number, number])[]) => {
    for (const t of first) {
      // stop early options (one leg only)
      out.push(t)
      if (t.kind === 'capture' || t.kind === 'fuse') continue
      // second leg from empty landing
      const second = slide(state, color, t.file, t.rank, dirs, moving)
      for (const s of second) {
        if (s.file === file && s.rank === rank) continue
        out.push({
          ...s,
          path: [
            { file: t.file, rank: t.rank },
            { file: s.file, rank: s.rank },
          ],
        })
      }
    }
  }
  expand(firstOrtho, ORTHO)
  expand(firstDiag, DIAG)
  return out
}

/** Squares attacked by color (for check / König safety). Shoots do not attack König. */
export function attackedSquares(state: GameState, by: Color): Set<string> {
  const set = new Set<string>()
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack || top(stack)?.color !== by) continue
      // Use capture/move generation but treat as attacks: generateMoves and take capture+move onto enemy/empty
      // For attack map we need any square the piece could capture onto (including empty for rays — actually attack = can capture if enemy there)
      const moves = generateMovesFrom(state, f, r)
      for (const m of moves) {
        if (m.kind === 'split') continue
        // attack squares = where an enemy piece would be captured
        if (m.kind === 'capture' || m.kind === 'move' || m.kind === 'fuse') {
          // For check, only capture matters; for "threatened square" for König, empty squares that are attacked count
          if (m.kind === 'fuse') continue
          set.add(sqKey(m.file, m.rank))
        }
      }
      // Also add pseudo-attacks for sliding onto empty (already in move)
    }
  }
  return set
}

export function isSquareAttacked(state: GameState, file: number, rank: number, by: Color): boolean {
  return attackedSquares(state, by).has(sqKey(file, rank))
}

export function isKoenigInCheck(state: GameState, color: Color): boolean {
  const pos = findKoenig(state, color)
  if (!pos) return false
  return isSquareAttacked(state, pos.file, pos.rank, enemy(color))
}

/** Detach top N pieces as moving stack for unstack moves — handled in apply. */
export function wouldLeaveKoenigInCheck(
  state: GameState,
  color: Color,
  mutate: (s: GameState) => void,
): boolean {
  const draft: GameState = {
    ...state,
    board: state.board.map((file) => file.map((c) => (c ? c.map((p) => ({ ...p })) : null))),
    shotReady: new Set(state.shotReady),
  }
  mutate(draft)
  return isKoenigInCheck(draft, color)
}
