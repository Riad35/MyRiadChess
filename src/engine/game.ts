import type { Action, ApplyResult, Color, GameState, PieceType, Stack } from './types'
import {
  algebraic,
  cloneBoard,
  enemy,
  inBounds,
  isMainSetupRank,
  isMidfield,
  makePiece,
  soldierBaseRank,
  sqKey,
  top,
} from './coords'
// isMainSetupRank used by setupPlaceSquares
import {
  appendLog,
  applyDoublesToBoard,
  createInitialState,
  hasMinimumArmy,
} from './state'
import {
  generateMovesFrom,
  isSquareAttacked,
  isVolkInCheck,
  wouldLeaveVolkInCheck,
} from './moves'

function fail(state: GameState, reason: string): ApplyResult {
  return { ok: false, reason, state: appendLog(state, 'illegal', `Illegal: ${reason}`) }
}

function ok(state: GameState, message?: string): ApplyResult {
  const s = message ? appendLog(state, 'move', message) : state
  return { ok: true, state: s }
}

export function applyAction(state: GameState, action: Action): ApplyResult {
  if (action.type === 'new-game') {
    return ok(createInitialState(action.timeControl), `New game (${action.timeControl})`)
  }

  if (state.phase === 'ended') {
    return fail(state, 'Game is over')
  }

  if (action.type === 'tick') {
    if (state.phase !== 'play' || state.result) return { ok: true, state }
    const clocks = { ...state.clocksMs }
    clocks[action.side] = Math.max(0, clocks[action.side]! - 100)
    let next = { ...state, clocksMs: clocks }
    if (clocks[action.side] <= 0) {
      next = {
        ...next,
        phase: 'ended',
        result: enemy(action.side),
        endReason: `${action.side} flagged`,
      }
      next = appendLog(next, 'system', `Flag: ${action.side} ran out of time.`)
    }
    return { ok: true, state: next }
  }

  switch (action.type) {
    case 'toggle-double-file':
      return toggleDouble(state, action.color, action.file)
    case 'confirm-doubles':
      return confirmDoubles(state, action.color, action.files)
    case 'place':
      return placeMain(state, action.color, action.piece, action.file, action.rank)
    case 'pass-setup':
      return passSetup(state, action.color)
    case 'march':
      return march(state, action)
    case 'shoot':
      return shoot(state, action.fromFile, action.fromRank, action.toFile, action.toRank)
    case 'drop':
      return dropReserve(state, action)
    case 'promote':
      return promote(state, action.choices)
    default:
      return fail(state, 'Unknown action')
  }
}

function toggleDouble(state: GameState, color: Color, file: number): ApplyResult {
  if (state.phase !== 'setup-doubles') return fail(state, 'Not in doubles setup phase')
  if (state.setup[color].doublesConfirmed) return fail(state, 'Doubles already confirmed')
  // White chooses first fully, then black — simplify: current chooser is first unconfirmed
  const chooser: Color = !state.setup.white.doublesConfirmed
    ? 'white'
    : !state.setup.black.doublesConfirmed
      ? 'black'
      : color
  if (color !== chooser) return fail(state, `Waiting for ${chooser} to choose doubles`)

  const cur = [...state.setup[color].doubleFiles]
  const idx = cur.indexOf(file)
  if (idx >= 0) cur.splice(idx, 1)
  else {
    if (cur.length >= 5) return fail(state, 'Already selected 5 double files')
    cur.push(file)
  }
  const setup = {
    ...state.setup,
    [color]: { ...state.setup[color], doubleFiles: cur },
  }
  return {
    ok: true,
    state: appendLog(
      { ...state, setup },
      'info',
      `${color} double-file ${algebraic(file, soldierBaseRank(color, file))} → ${cur.length}/5`,
    ),
  }
}

function confirmDoubles(state: GameState, color: Color, files: number[]): ApplyResult {
  if (state.phase !== 'setup-doubles') return fail(state, 'Not in doubles setup phase')
  const unique = [...new Set(files)]
  if (unique.length !== 5) return fail(state, 'Select exactly 5 files for double Soldaten')
  if (unique.some((f) => f < 0 || f > 9)) return fail(state, 'Invalid file')

  let next: GameState = {
    ...state,
    setup: {
      ...state.setup,
      [color]: { ...state.setup[color], doubleFiles: unique, doublesConfirmed: true },
    },
  }
  next = applyDoublesToBoard(next, color)
  next = appendLog(next, 'system', `${color} confirmed double Soldaten on files ${unique.map((f) => 'abcdefghij'[f]).join(',')}`)

  if (next.setup.white.doublesConfirmed && next.setup.black.doublesConfirmed) {
    next = {
      ...next,
      phase: 'setup-mains',
      turn: 'white',
    }
    next = appendLog(next, 'system', 'Place main pieces (White). Minimum: V, J, 2× each T/S/K/I. Pass when ready.')
  }
  return ok(next)
}

function placeMain(
  state: GameState,
  color: Color,
  piece: PieceType,
  file: number,
  rank: number,
): ApplyResult {
  if (state.phase !== 'setup-mains') return fail(state, 'Not in main-piece setup')
  if (state.setup[color].passed) return fail(state, 'You already passed setup')
  if (state.turn !== color) return fail(state, `Not ${color}'s turn to place`)
  if (piece === 'Soldat') return fail(state, 'Soldaten are already placed')
  if (!inBounds(file, rank)) return fail(state, 'Off the board')
  if (!isMainSetupRank(color, rank)) {
    return fail(state, 'Main pieces only on your ranks 1–2 (White) or 10–9 (Black)')
  }
  if (state.board[file]![rank]) return fail(state, 'Square occupied')

  const poolLeft = state.setup[color].pool[piece] ?? 0
  const inRes = state.reserve[color].filter((p) => p === piece).length
  const fromPool = poolLeft > 0
  const fromReserve = !fromPool && inRes > 0
  if (!fromPool && !fromReserve) {
    return fail(state, `No ${piece} left to place`)
  }

  const board = cloneBoard(state.board)
  const id = state.nextPieceId
  board[file]![rank] = [makePiece(piece, color, id)]

  const pool = { ...state.setup[color].pool }
  let reserve = { ...state.reserve, [color]: [...state.reserve[color]] }
  if (fromPool) {
    pool[piece] = poolLeft - 1
  } else {
    const idx = reserve[color].indexOf(piece)
    reserve[color].splice(idx, 1)
  }

  let next: GameState = {
    ...state,
    board,
    reserve,
    setup: {
      ...state.setup,
      [color]: { ...state.setup[color], pool },
    },
    nextPieceId: id + 1,
    turn: enemy(color),
  }

  // If opponent passed, turn stays with current player if they haven't passed
  if (next.setup[enemy(color)].passed && !next.setup[color].passed) {
    next = { ...next, turn: color }
  } else if (next.setup[color].passed) {
    next = { ...next, turn: enemy(color) }
  }

  next = appendLog(
    next,
    'move',
    `Setup ${color}: ${piece} → ${algebraic(file, rank)}`,
  )
  return tryEndSetup(next)
}

function passSetup(state: GameState, color: Color): ApplyResult {
  if (state.phase !== 'setup-mains') return fail(state, 'Not in setup')
  if (!hasMinimumArmy(state, color)) {
    return fail(
      state,
      'Cannot pass until Volk, Jugend, 15 Soldaten, and 2× each Tower/Schütze/Kavallerie/Infanterie are placed',
    )
  }
  let next: GameState = {
    ...state,
    setup: {
      ...state.setup,
      [color]: { ...state.setup[color], passed: true },
    },
    turn: enemy(color),
  }
  next = appendLog(next, 'system', `${color} passed setup (remaining pieces stay in reserve).`)
  if (next.setup[enemy(color)].passed) {
    // both passed
  } else if (!next.setup[enemy(color)].passed) {
    next = { ...next, turn: enemy(color) }
  }
  return tryEndSetup(next)
}

function tryEndSetup(state: GameState): ApplyResult {
  if (state.setup.white.passed && state.setup.black.passed) {
    let next: GameState = {
      ...state,
      phase: 'play',
      turn: 'white',
      positionHistory: [positionKey(state)],
    }
    next = appendLog(next, 'system', 'Play begins. White to move.')
    return ok(next)
  }
  // Auto-pass opponent turn skip already handled
  if (state.setup.white.passed && !state.setup.black.passed) {
    return ok({ ...state, turn: 'black' })
  }
  if (state.setup.black.passed && !state.setup.white.passed) {
    return ok({ ...state, turn: 'white' })
  }
  return ok(state)
}

function positionKey(state: GameState): string {
  const rows: string[] = []
  for (let r = 0; r < 10; r++) {
    for (let f = 0; f < 10; f++) {
      const s = state.board[f]![r]
      if (!s) continue
      rows.push(`${f}${r}:${s.map((p) => p.color[0] + p.type[0]).join('')}`)
    }
  }
  const res = (c: Color) => [...state.reserve[c]].sort().join(',')
  return `${rows.sort().join('|')}|W:${res('white')}|B:${res('black')}|T:${state.turn}`
}

function finalizeMove(state: GameState, note: string): ApplyResult {
  const mover = state.turn
  const clocks = { ...state.clocksMs }
  clocks[mover] = clocks[mover]! + state.timeControl.incrementMs

  let next: GameState = {
    ...state,
    clocksMs: clocks,
    turn: enemy(mover),
  }
  next = appendLog(next, 'move', note)

  // check / mate / stash / threefold
  const opp = next.turn
  const inCheck = isVolkInCheck(next, opp)
  if (inCheck) {
    next = appendLog(next, 'info', `Check to ${opp} Volk!`)
  }

  const key = positionKey(next)
  const history = [...next.positionHistory, key]
  next = { ...next, positionHistory: history }
  const reps = history.filter((h) => h === key).length
  if (reps >= 3) {
    next = {
      ...next,
      phase: 'ended',
      result: 'draw',
      endReason: 'Threefold repetition',
    }
    return ok(appendLog(next, 'system', 'Draw: threefold repetition'))
  }

  if (!hasAnyLegalPlayMove(next, opp)) {
    if (inCheck) {
      next = {
        ...next,
        phase: 'ended',
        result: mover,
        endReason: 'Schachmatt',
      }
      return ok(appendLog(next, 'system', `Schachmatt! ${mover} wins.`))
    }
    next = {
      ...next,
      phase: 'ended',
      result: 'draw',
      endReason: 'Patt',
    }
    return ok(appendLog(next, 'system', 'Patt — draw.'))
  }

  return { ok: true, state: next }
}

function hasAnyLegalPlayMove(state: GameState, color: Color): boolean {
  // drops
  for (const piece of state.reserve[color]) {
    for (let f = 0; f < 10; f++) {
      for (let r = 0; r < 10; r++) {
        if (canDrop(state, color, piece, f, r).ok) return true
      }
    }
  }
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const stack = state.board[f]![r]
      if (!stack || top(stack)?.color !== color) continue
      const moves = generateMovesFrom(state, f, r)
      for (const m of moves) {
        if (
          !wouldLeaveVolkInCheck(state, color, (draft) => {
            applyMarchMut(draft, f, r, m.file, m.rank, m.mode ?? 'unit', m.kind)
          })
        ) {
          return true
        }
      }
      if (stack.length === 3 && state.shotReady.has(sqKey(f, r))) {
        const shots = generateMovesFrom(state, f, r, { asShoot: true })
        if (shots.some((s) => !wouldLeaveVolkInCheck(state, color, (d) => applyShotMut(d, f, r, s.file, s.rank)))) {
          return true
        }
      }
    }
  }
  return false
}

function canDrop(
  state: GameState,
  color: Color,
  piece: PieceType,
  file: number,
  rank: number,
): { ok: true } | { ok: false; reason: string } {
  if (!state.reserve[color].includes(piece)) return { ok: false, reason: `No ${piece} in reserve` }
  if (!inBounds(file, rank)) return { ok: false, reason: 'Off board' }
  const stack = state.board[file]![rank]
  if (!stack) {
    if (!isMidfield(rank)) return { ok: false, reason: 'Empty drop only on midfield ranks 4–7' }
    return { ok: true }
  }
  if (top(stack)!.color !== color) return { ok: false, reason: 'Cannot drop on enemy stack' }
  if (stack.length >= 3) return { ok: false, reason: 'Stack already height 3' }
  if (stack.some((p) => p.type === 'Volk' || p.type === 'Jugend')) {
    return { ok: false, reason: 'Cannot drop onto Volk or Jugend' }
  }
  if (piece === 'Volk' && stack.some((p) => p.type === 'Soldat')) {
    return { ok: false, reason: 'Volk cannot stack onto Soldaten' }
  }
  return { ok: true }
}

function march(
  state: GameState,
  action: Extract<Action, { type: 'march' }>,
): ApplyResult {
  if (state.phase !== 'play') return fail(state, 'Not in play phase')
  if (state.pendingPromotion) return fail(state, 'Resolve promotion first')
  const { fromFile, fromRank, toFile, toRank, mode } = action
  const stack = state.board[fromFile]?.[fromRank]
  if (!stack) return fail(state, 'No stack on from-square')
  if (top(stack)!.color !== state.turn) return fail(state, 'Not your piece')

  const moves = generateMovesFrom(state, fromFile, fromRank, {
    mode: mode === 'infanterie' || mode === 'kavallerie' ? mode : undefined,
  })
  const hit = moves.find((m) => m.file === toFile && m.rank === toRank && (!mode || !m.mode || m.mode === mode || mode === 'unit'))
  // allow matching by coordinates; if mode split requested, prefer split
  const preferred =
    mode === 'split'
      ? moves.find((m) => m.file === toFile && m.rank === toRank && m.kind === 'split')
      : mode === 'unit'
        ? moves.find((m) => m.file === toFile && m.rank === toRank && m.mode === 'unit')
        : hit ?? moves.find((m) => m.file === toFile && m.rank === toRank)

  if (!preferred) return fail(state, 'That destination is not legal for this stack')

  if (
    wouldLeaveVolkInCheck(state, state.turn, (draft) => {
      applyMarchMut(draft, fromFile, fromRank, toFile, toRank, preferred.mode ?? 'unit', preferred.kind)
    })
  ) {
    return fail(state, 'Volk would move into check / leave Volk in check')
  }

  const board = cloneBoard(state.board)
  const draft: GameState = { ...state, board, shotReady: new Set(state.shotReady) }
  applyMarchMut(draft, fromFile, fromRank, toFile, toRank, preferred.mode ?? 'unit', preferred.kind)

  // 3-stack formation: cannot threaten enemy Volk
  const formed3 = draft.board[toFile]![toRank]?.length === 3
  if (formed3) {
    draft.shotReady.add(sqKey(toFile, toRank))
    if (isSquareAttacked(draft, findEnemyVolk(draft)!.file, findEnemyVolk(draft)!.rank, state.turn) &&
        /* only illegal if NEW threat from forming 3er — approximate: if enemy volk in check */ isVolkInCheck(draft, enemy(state.turn))) {
      // Rule: forming 3-stack must not threaten enemy Volk
      // Check if the attack comes from this square's pattern
      const shots = generateMovesFrom(draft, toFile, toRank)
      const volk = findEnemyVolk(draft)!
      if (shots.some((t) => t.file === volk.file && t.rank === volk.rank && (t.kind === 'capture' || t.kind === 'move'))) {
        return fail(state, 'Cannot form a 3-stack that threatens the enemy Volk')
      }
    }
  }

  // clear shot on from if moved away
  draft.shotReady.delete(sqKey(fromFile, fromRank))

  const note = `${state.turn}: ${algebraic(fromFile, fromRank)} → ${algebraic(toFile, toRank)}${preferred.kind === 'split' ? ' (split)' : preferred.kind === 'fuse' ? ' ↑' : preferred.kind === 'capture' ? ' x' : ''}`
  return finalizeMove(draft, note)
}

function findEnemyVolk(state: GameState): { file: number; rank: number } | null {
  const c = enemy(state.turn)
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      const s = state.board[f]![r]
      if (s?.some((p) => p.type === 'Volk' && p.color === c)) return { file: f, rank: r }
    }
  }
  return null
}

function applyMarchMut(
  state: GameState,
  fromFile: number,
  fromRank: number,
  toFile: number,
  toRank: number,
  _mode: string,
  kind: string,
): void {
  const from = state.board[fromFile]![fromRank]!
  const to = state.board[toFile]![toRank]

  if (kind === 'split') {
    const moving = from.pop()!
    if (from.length === 0) state.board[fromFile]![fromRank] = null
    if (to && top(to)!.color !== moving.color) {
      // capture
      state.board[toFile]![toRank] = [moving]
    } else if (to && top(to)!.color === moving.color && top(to)!.type === 'Soldat') {
      to.push(moving)
    } else {
      state.board[toFile]![toRank] = [moving]
    }
    return
  }

  // move entire stack
  const moving = from
  state.board[fromFile]![fromRank] = null
  if (!to) {
    state.board[toFile]![toRank] = moving
  } else if (top(to)!.color !== top(moving)!.color) {
    state.board[toFile]![toRank] = moving // capture replaces
  } else {
    // fuse
    state.board[toFile]![toRank] = [...to, ...moving]
  }
}

function applyShotMut(
  state: GameState,
  fromFile: number,
  fromRank: number,
  toFile: number,
  toRank: number,
): void {
  const target = state.board[toFile]![toRank]
  if (!target) return
  if (target.length >= 3) {
    // remove bottom two
    state.board[toFile]![toRank] = [target[target.length - 1]!]
  } else {
    state.board[toFile]![toRank] = null
  }
  state.shotReady.delete(sqKey(fromFile, fromRank))
}

function shoot(
  state: GameState,
  fromFile: number,
  fromRank: number,
  toFile: number,
  toRank: number,
): ApplyResult {
  if (state.phase !== 'play') return fail(state, 'Not in play')
  if (!state.shotReady.has(sqKey(fromFile, fromRank))) {
    return fail(state, 'No shot available on this 3-stack (already used or not a charged 3-stack)')
  }
  const stack = state.board[fromFile]![fromRank]
  if (!stack || stack.length !== 3) return fail(state, 'Shoot requires a 3-stack')
  if (top(stack)!.color !== state.turn) return fail(state, 'Not your stack')

  const shots = generateMovesFrom(state, fromFile, fromRank, { asShoot: true })
  if (!shots.some((s) => s.file === toFile && s.rank === toRank)) {
    return fail(state, 'Illegal shot target (blocked or out of pattern)')
  }
  const target = state.board[toFile]![toRank]
  if (target?.some((p) => p.type === 'Volk')) return fail(state, 'Cannot shoot the enemy Volk')

  if (
    wouldLeaveVolkInCheck(state, state.turn, (d) => applyShotMut(d, fromFile, fromRank, toFile, toRank))
  ) {
    return fail(state, 'Shot would leave Volk in check')
  }

  const board = cloneBoard(state.board)
  const draft: GameState = { ...state, board, shotReady: new Set(state.shotReady) }
  applyShotMut(draft, fromFile, fromRank, toFile, toRank)
  return finalizeMove(draft, `${state.turn}: shot ${algebraic(fromFile, fromRank)}*${algebraic(toFile, toRank)}`)
}

function dropReserve(
  state: GameState,
  action: Extract<Action, { type: 'drop' }>,
): ApplyResult {
  if (state.phase !== 'play') return fail(state, 'Not in play')
  const color = state.turn
  const check = canDrop(state, color, action.piece, action.file, action.rank)
  if (!check.ok) return fail(state, check.reason)

  const board = cloneBoard(state.board)
  const piece = makePiece(action.piece, color, state.nextPieceId)
  const existing = board[action.file]![action.rank]
  const nextStack: Stack = existing ? [...existing, piece] : [piece]
  board[action.file]![action.rank] = nextStack

  const reserve = { ...state.reserve, [color]: [...state.reserve[color]] }
  const idx = reserve[color].indexOf(action.piece)
  reserve[color].splice(idx, 1)

  let draft: GameState = {
    ...state,
    board,
    reserve,
    nextPieceId: state.nextPieceId + 1,
    shotReady: new Set(state.shotReady),
  }

  if (nextStack.length === 3) {
    // cannot threaten enemy volk
    const volk = findEnemyVolk({ ...draft, turn: color })
    if (volk) {
      const attacks = generateMovesFrom(draft, action.file, action.rank)
      if (attacks.some((t) => t.file === volk.file && t.rank === volk.rank && t.kind === 'capture')) {
        return fail(state, 'Cannot form a 3-stack that threatens the enemy Volk')
      }
    }
    draft.shotReady.add(sqKey(action.file, action.rank))

    if (action.shootFile != null && action.shootRank != null) {
      const shots = generateMovesFrom(draft, action.file, action.rank, { asShoot: true })
      if (!shots.some((s) => s.file === action.shootFile && s.rank === action.shootRank)) {
        return fail(state, 'Illegal immediate shot after drop')
      }
      applyShotMut(draft, action.file, action.rank, action.shootFile, action.shootRank)
      return finalizeMove(
        draft,
        `${color}: Res-${action.piece[0]}${algebraic(action.file, action.rank)} then shot *${algebraic(action.shootFile, action.shootRank)}`,
      )
    }
  }

  if (wouldLeaveVolkInCheck(state, color, () => {})) {
    /* drop itself rarely checks own volk */
  }
  if (isVolkInCheck({ ...draft, turn: color }, color)) {
    return fail(state, 'Drop leaves Volk in check')
  }

  return finalizeMove(draft, `${color}: Res-${action.piece} → ${algebraic(action.file, action.rank)}`)
}

function promote(state: GameState, _choices: PieceType[]): ApplyResult {
  if (!state.pendingPromotion) return fail(state, 'No pending promotion')
  return fail(state, 'Use promotion UI choices (pending wiring)')
}

export function legalTargets(
  state: GameState,
  fromFile: number,
  fromRank: number,
): { file: number; rank: number; kind: string; mode?: string }[] {
  if (state.phase !== 'play') return []
  const stack = state.board[fromFile]?.[fromRank]
  if (!stack || top(stack)?.color !== state.turn) return []
  const raw = generateMovesFrom(state, fromFile, fromRank)
  const seen = new Set<string>()
  const out: { file: number; rank: number; kind: string; mode?: string }[] = []
  for (const m of raw) {
    const key = `${m.file},${m.rank},${m.kind},${m.mode ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    if (
      wouldLeaveVolkInCheck(state, state.turn, (d) =>
        applyMarchMut(d, fromFile, fromRank, m.file, m.rank, m.mode ?? 'unit', m.kind),
      )
    ) {
      continue
    }
    out.push({ file: m.file, rank: m.rank, kind: m.kind, mode: m.mode })
  }
  return out
}

/** Legal empty / fuse squares for setup placement of `piece`. */
export function setupPlaceSquares(
  state: GameState,
  color: Color,
  piece: PieceType,
): { file: number; rank: number }[] {
  if (state.phase !== 'setup-mains') return []
  const out: { file: number; rank: number }[] = []
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      if (!isMainSetupRank(color, r)) continue
      if (state.board[f]![r]) continue
      const poolLeft = state.setup[color].pool[piece] ?? 0
      const inRes = state.reserve[color].filter((p) => p === piece).length
      if (poolLeft <= 0 && inRes <= 0) continue
      out.push({ file: f, rank: r })
    }
  }
  return out
}

export { createInitialState }
export { TIME_CONTROLS } from './types'
