import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyAction,
  createInitialState,
  legalTargets,
  setupPlaceSquares,
  algebraic,
  top,
  soldierBaseRank,
  PIECE_LETTER,
  STANDARD_TYPES,
  hasMinimumArmy,
  generateMovesFrom,
  isVolkInCheck,
  stackBadge,
  createMirroredQuickStart,
  createEmptyPlayState,
  placeStack,
  clearBoard,
  clearColor,
  applyCompositionToSetup,
  type GameState,
  type PieceType,
  type TimeControlId,
  type Color,
  type Action,
} from './engine'
import {
  loadSettings,
  saveSettings,
  loadCompositions,
  upsertComposition,
  deleteComposition,
  DEFAULT_SETTINGS,
  type AppSettings,
  type SavedComposition,
} from './lib/prefs'
import { RULES_SECTIONS, UNIT_SCENARIOS } from './content/unitScenarios'
import {
  PieceSprite,
  defaultFacing,
  displayName,
  facingFromDelta,
  spriteDirForViewer,
  type SpriteDir,
  type ViewerOrientation,
} from './sprites'

type Screen = 'menu' | 'settings' | 'testing' | 'compositions' | 'game'
type TestingTab = 'guide-rules' | 'guide-units' | 'testmap'
type Sel =
  | null
  | { kind: 'board'; file: number; rank: number }
  | { kind: 'reserve'; piece: PieceType }

const PASS_HELP =
  'Condition: Volk and Jugend set, and at least 2 of each Tower / Schütze / Kavallerie / Infanterie on the board (plus 15 Soldaten). You may keep up to 4 standard figures in reserve for the Battle Phase.'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [compositions, setCompositions] = useState<SavedComposition[]>(() => loadCompositions())
  const [timeControl, setTimeControl] = useState<TimeControlId>(settings.timeControlDefault)
  const [state, setState] = useState<GameState>(() => createInitialState('10+5'))
  const [sel, setSel] = useState<Sel>(null)
  const [placePiece, setPlacePiece] = useState<PieceType>('Volk')
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerKey, setBannerKey] = useState(0)
  const [passHelpOpen, setPassHelpOpen] = useState(false)
  const [testingTab, setTestingTab] = useState<TestingTab>('guide-rules')
  const [unitFilter, setUnitFilter] = useState('Volk')
  const [spawnType, setSpawnType] = useState<PieceType>('Kavallerie')
  const [spawnColor, setSpawnColor] = useState<Color>('white')
  const [spawnHeight, setSpawnHeight] = useState(1)
  const [gameMode, setGameMode] = useState<'match' | 'sandbox'>('match')
  /** Board-absolute facing per piece id; missing → default by color. */
  const [facingById, setFacingById] = useState<Record<string, SpriteDir>>({})
  /** Hot-seat White-at-bottom today; remaps when the board is turned. */
  const viewerOrientation: ViewerOrientation = 'white-south'

  const rememberFacing = useCallback((pieceIds: string[], dir: SpriteDir | null) => {
    if (!dir || pieceIds.length === 0) return
    setFacingById((prev) => {
      const next = { ...prev }
      for (const id of pieceIds) next[id] = dir
      return next
    })
  }, [])

  const announce = useCallback(
    (text: string) => {
      if (!settings.showPhaseBanners) return
      setBanner(text)
      setBannerKey((k) => k + 1)
    },
    [settings.showPhaseBanners],
  )

  const dispatch = useCallback((action: Action) => {
    setState((prev) => applyAction(prev, action).state)
    setSel(null)
  }, [])

  const applyTheme = useCallback((s: AppSettings) => {
    const root = document.documentElement
    root.style.setProperty('--light', s.boardLight)
    root.style.setProperty('--dark', s.boardDark)
    root.style.setProperty('--gold', s.accent)
    root.style.setProperty('--white-piece', s.pieceWhite)
    root.style.setProperty('--black-piece', s.pieceBlack)
  }, [])

  useEffect(() => {
    applyTheme(settings)
  }, [settings, applyTheme])

  const startGame = () => {
    setGameMode('match')
    const s = createInitialState(timeControl)
    setState(s)
    setSel(null)
    setFacingById({})
    setPlacePiece('Volk')
    setScreen('game')
    announce('SETTING PHASE')
  }

  const startMirrored = () => {
    setGameMode('match')
    const s = createMirroredQuickStart(timeControl)
    setState(s)
    setSel(null)
    setFacingById({})
    setScreen('game')
    announce('BATTLE PHASE')
  }

  const openScenario = (build: () => GameState) => {
    setGameMode('sandbox')
    setState(build())
    setSel(null)
    setFacingById({})
    setTestingTab('guide-units')
    setScreen('game')
    announce('GUIDE SCENARIO')
  }

  const openTestmap = () => {
    setGameMode('sandbox')
    setState(createEmptyPlayState(timeControl))
    setSel(null)
    setFacingById({})
    setTestingTab('testmap')
    setScreen('game')
    announce('TESTMAP')
  }

  useEffect(() => {
    if (screen !== 'game' || gameMode === 'sandbox') return
    if (state.phase === 'setup-doubles') announce('SETTING PHASE — Double Soldaten')
    else if (state.phase === 'setup-mains') announce('SETTING PHASE — Main Forces')
    else if (state.phase === 'play') announce('BATTLE PHASE')
    else if (state.phase === 'ended') announce(state.endReason?.toUpperCase() ?? 'GAME OVER')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, screen, gameMode])

  useEffect(() => {
    if (state.phase !== 'play' || state.result || gameMode === 'sandbox') return
    const id = window.setInterval(() => {
      setState((prev) => applyAction(prev, { type: 'tick', nowMs: Date.now(), side: prev.turn }).state)
    }, 100)
    return () => clearInterval(id)
  }, [state.phase, state.result, state.turn, gameMode])

  const targets = useMemo(() => {
    if (!sel || sel.kind !== 'board' || state.phase !== 'play') return []
    return legalTargets(state, sel.file, sel.rank)
  }, [sel, state])

  const targetMap = useMemo(() => {
    const m = new Map<string, (typeof targets)[0]>()
    for (const t of targets) {
      const k = `${t.file},${t.rank}`
      if (!m.has(k) || t.kind === 'capture' || t.kind === 'split') m.set(k, t)
    }
    return m
  }, [targets])

  const setupSquares = useMemo(() => {
    if (state.phase !== 'setup-mains') return new Set<string>()
    return new Set(setupPlaceSquares(state, state.turn, placePiece).map((s) => `${s.file},${s.rank}`))
  }, [state, placePiece])

  const checkSquare = useMemo(() => {
    if (state.phase !== 'play') return null
    if (!isVolkInCheck(state, state.turn)) return null
    return findVolk(state, state.turn)
  }, [state])

  const chooser: Color = !state.setup.white.doublesConfirmed
    ? 'white'
    : !state.setup.black.doublesConfirmed
      ? 'black'
      : 'white'

  const canPass = state.phase === 'setup-mains' && hasMinimumArmy(state, state.turn)

  const onSquareClick = (file: number, rank: number) => {
    if (gameMode === 'sandbox' && testingTab === 'testmap' && !sel) {
      // spawn if empty
      if (!state.board[file]![rank]) {
        const types = Array.from({ length: spawnHeight }, () => spawnType)
        setState((prev) => placeStack(prev, file, rank, spawnColor, types))
        return
      }
    }

    if (state.phase === 'setup-doubles') {
      dispatch({ type: 'toggle-double-file', color: chooser, file })
      return
    }
    if (state.phase === 'setup-mains') {
      dispatch({ type: 'place', color: state.turn, piece: placePiece, file, rank })
      return
    }
    if (state.phase === 'play') {
      if (sel?.kind === 'reserve') {
        dispatch({ type: 'drop', piece: sel.piece, file, rank })
        return
      }
      if (sel?.kind === 'board') {
        if (sel.file === file && sel.rank === rank) {
          setSel(null)
          return
        }
        const hit = targetMap.get(`${file},${rank}`)
        if (hit) {
          const mode =
            hit.kind === 'split'
              ? 'split'
              : hit.mode === 'kavallerie' || hit.mode === 'infanterie'
                ? hit.mode
                : 'unit'
          const fromStack = state.board[sel.file]![sel.rank]
          const dir = facingFromDelta(file - sel.file, rank - sel.rank)
          if (fromStack && dir) {
            const ids =
              mode === 'split'
                ? [top(fromStack)!.id]
                : fromStack.map((p) => p.id)
            rememberFacing(ids, dir)
          }
          dispatch({
            type: 'march',
            fromFile: sel.file,
            fromRank: sel.rank,
            toFile: file,
            toRank: rank,
            mode,
          })
          return
        }
      }
      const stack = state.board[file]![rank]
      if (stack && top(stack)?.color === state.turn) setSel({ kind: 'board', file, rank })
      else setSel(null)
    }
  }

  const importComposition = (c: SavedComposition) => {
    if (c.side !== state.turn && state.phase === 'setup-mains') {
      // still allow load for that side's turn later — force to composition side turn
    }
    setState(applyCompositionToSetup(state, c.side, c.doubleFiles, c.placements))
    setPlacePiece('Tower')
    announce(`LOADED: ${c.name}`)
  }

  const saveCurrentAsComposition = () => {
    const side = state.turn
    const name = window.prompt('Name this composition', `${side} strategy`)
    if (!name) return
    const placements: SavedComposition['placements'] = []
    for (let f = 0; f < 10; f++) {
      for (let r = 0; r < 10; r++) {
        const stack = state.board[f]![r]
        if (!stack || stack.length !== 1) continue
        const p = stack[0]!
        if (p.color !== side || p.type === 'Soldat') continue
        placements.push({ file: f, rank: r, type: p.type })
      }
    }
    const comp: SavedComposition = {
      id: crypto.randomUUID(),
      name,
      side,
      doubleFiles: state.setup[side].doubleFiles.length === 5 ? state.setup[side].doubleFiles : [0, 2, 4, 5, 7],
      placements,
      createdAt: Date.now(),
    }
    setCompositions(upsertComposition(comp))
  }

  if (screen === 'menu') {
    return (
      <div className="shell menu-shell">
        <div className="menu-card">
          <p className="menu-kicker">Local · Hot-seat</p>
          <h1 className="menu-title">Schach 2</h1>
          <p className="menu-sub">War on ten files. Stacks. Reserve. Strict rules.</p>
          <label className="menu-field">
            Time control
            <select value={timeControl} onChange={(e) => setTimeControl(e.target.value as TimeControlId)}>
              <option value="5+3">5+3 Blitz</option>
              <option value="10+5">10+5 Rapid</option>
            </select>
          </label>
          <button type="button" className="btn primary" onClick={startGame}>
            Play Local
          </button>
          <button type="button" className="btn" onClick={startMirrored}>
            Play Local — Mirrored preset (skip setup)
          </button>
          <button type="button" className="btn" onClick={() => setScreen('settings')}>
            Settings
          </button>
          <button type="button" className="btn" onClick={() => setScreen('testing')}>
            Testing
          </button>
          <button type="button" className="btn" onClick={() => setScreen('compositions')}>
            Saved compositions
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'settings') {
    return (
      <SettingsView
        settings={settings}
        onChange={(next) => {
          setSettings(next)
          saveSettings(next)
          applyTheme(next)
        }}
        onBack={() => setScreen('menu')}
      />
    )
  }

  if (screen === 'compositions') {
    return (
      <div className="shell menu-shell">
        <div className="menu-card wide">
          <h1 className="menu-title">Saved compositions</h1>
          <p className="menu-sub">Preset White or Black strategies to import during setup.</p>
          {compositions.length === 0 && <p className="hint">None yet — save from a game during setup.</p>}
          <ul className="comp-list">
            {compositions.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.name}</strong>
                  <span className="hint">
                    {' '}
                    · {c.side} · {c.placements.length} mains
                  </span>
                </div>
                <button type="button" className="btn small" onClick={() => setCompositions(deleteComposition(c.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn primary" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'testing') {
    const units = [...new Set(UNIT_SCENARIOS.map((s) => s.unit))]
    const scenarios = UNIT_SCENARIOS.filter((s) => s.unit === unitFilter)
    return (
      <div className="shell testing-shell">
        <header className="topbar">
          <button type="button" className="btn ghost small" onClick={() => setScreen('menu')}>
            Menu
          </button>
          <h1>Testing</h1>
          <div />
        </header>
        <div className="test-tabs">
          <button type="button" className={testingTab === 'guide-rules' ? 'active' : ''} onClick={() => setTestingTab('guide-rules')}>
            Guide · Rules
          </button>
          <button type="button" className={testingTab === 'guide-units' ? 'active' : ''} onClick={() => setTestingTab('guide-units')}>
            Guide · Units
          </button>
          <button type="button" className={testingTab === 'testmap' ? 'active' : ''} onClick={() => setTestingTab('testmap')}>
            Testmap
          </button>
        </div>

        {testingTab === 'guide-rules' && (
          <div className="panel rules-panel">
            {RULES_SECTIONS.map((r) => (
              <section key={r.title}>
                <h2>{r.title}</h2>
                <p>{r.body}</p>
              </section>
            ))}
          </div>
        )}

        {testingTab === 'guide-units' && (
          <div className="units-layout">
            <div className="piece-picker">
              {units.map((u) => (
                <button key={u} type="button" className={unitFilter === u ? 'active' : ''} onClick={() => setUnitFilter(u)}>
                  {u}
                </button>
              ))}
            </div>
            <div className="scenario-grid">
              {scenarios.map((s) => (
                <article key={s.id} className="scenario-card">
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <button type="button" className="btn primary small" onClick={() => openScenario(s.build)}>
                    Open on empty map
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {testingTab === 'testmap' && (
          <div className="panel">
            <h2>Testmap lab</h2>
            <p className="hint">Empty board with spawn tools, clear options, and free movement — clocks paused.</p>
            <button type="button" className="btn primary" onClick={openTestmap}>
              Launch Testmap
            </button>
          </div>
        )}
      </div>
    )
  }

  // GAME SCREEN
  const guidance = guidanceText(state, chooser, placePiece, gameMode)

  return (
    <div className="shell game-shell">
      {banner && (
        <div key={bannerKey} className="phase-banner" onAnimationEnd={() => setBanner(null)}>
          <span>{banner}</span>
        </div>
      )}

      <header className="topbar">
        <div>
          <button type="button" className="btn ghost small" onClick={() => setScreen(gameMode === 'sandbox' ? 'testing' : 'menu')}>
            {gameMode === 'sandbox' ? 'Testing' : 'Menu'}
          </button>
          <h1>Schach 2</h1>
        </div>
        <div className={`turn-pill turn-${activeSide(state, chooser)}`}>
          <span className="turn-dot" />
          {guidance.title}
        </div>
        <button
          type="button"
          className="btn small"
          onClick={() => {
            if (gameMode === 'sandbox') setState(createEmptyPlayState(timeControl))
            else {
              setState(createInitialState(timeControl))
              announce('SETTING PHASE')
            }
            setSel(null)
            setFacingById({})
          }}
        >
          Restart
        </button>
      </header>

      <p className="guide">{guidance.detail}</p>

      <div className="layout">
        <aside className="side">
          {gameMode === 'match' && <ClockPanel state={state} />}
          <ArmyPanel state={state} color="white" active={activeSide(state, chooser) === 'white'} />
          <ArmyPanel state={state} color="black" active={activeSide(state, chooser) === 'black'} />

          {state.phase === 'setup-doubles' && (
            <div className="panel">
              <h2>Double Soldaten</h2>
              <p className="hint">
                Click 5 zigzag files for {chooser}. {state.setup[chooser].doubleFiles.length}/5
              </p>
              <button
                type="button"
                className="btn primary"
                disabled={state.setup[chooser].doubleFiles.length !== 5}
                onClick={() =>
                  dispatch({
                    type: 'confirm-doubles',
                    color: chooser,
                    files: state.setup[chooser].doubleFiles,
                  })
                }
              >
                Confirm doubles
              </button>
            </div>
          )}

          {state.phase === 'setup-mains' && (
            <div className="panel">
              <h2>Place figure</h2>
              <div className="piece-picker">
                {(['Volk', 'Jugend', ...STANDARD_TYPES] as PieceType[]).map((p) => {
                  const left = remainingToPlace(state, state.turn, p)
                  const mine = state.turn
                  return (
                    <button
                      key={p}
                      type="button"
                      className={[placePiece === p ? 'active' : '', left > 0 && mine ? 'pulse-need' : ''].join(' ')}
                      disabled={left <= 0}
                      onClick={() => setPlacePiece(p)}
                    >
                      {displayName(p)} <small>×{left}</small>
                    </button>
                  )
                })}
              </div>

              <div className="pass-row">
                <button
                  type="button"
                  className={`btn ${canPass ? 'primary pulse-need' : ''}`}
                  disabled={!canPass}
                  onClick={() => dispatch({ type: 'pass-setup', color: state.turn })}
                >
                  Pass setup
                </button>
                <button
                  type="button"
                  className="btn help-btn"
                  aria-label="Pass setup help"
                  onClick={() => setPassHelpOpen((v) => !v)}
                  title={PASS_HELP}
                >
                  ?
                </button>
              </div>
              {passHelpOpen && <p className="help-box">{PASS_HELP}</p>}

              <label className="menu-field">
                Import composition
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const c = compositions.find((x) => x.id === e.target.value)
                    if (c) importComposition(c)
                    e.target.value = ''
                  }}
                >
                  <option value="">Choose…</option>
                  {compositions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.side})
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn small" onClick={saveCurrentAsComposition}>
                Save board as composition
              </button>
            </div>
          )}

          {gameMode === 'sandbox' && testingTab === 'testmap' && (
            <div className="panel">
              <h2>Testmap tools</h2>
              <div className="piece-picker">
                {(['Volk', 'Jugend', ...STANDARD_TYPES, 'Soldat'] as PieceType[]).map((p) => (
                  <button key={p} type="button" className={spawnType === p ? 'active' : ''} onClick={() => setSpawnType(p)}>
                    {displayName(p)}
                  </button>
                ))}
              </div>
              <div className="piece-picker">
                <button type="button" className={spawnColor === 'white' ? 'active' : ''} onClick={() => setSpawnColor('white')}>
                  White
                </button>
                <button type="button" className={spawnColor === 'black' ? 'active' : ''} onClick={() => setSpawnColor('black')}>
                  Black
                </button>
                {[1, 2, 3].map((h) => (
                  <button key={h} type="button" className={spawnHeight === h ? 'active' : ''} onClick={() => setSpawnHeight(h)}>
                    H{h}
                  </button>
                ))}
              </div>
              <p className="hint">Click empty square to spawn. Click own piece to move.</p>
              <button type="button" className="btn" onClick={() => setState((s) => clearBoard(s))}>
                Remove all figures
              </button>
              <button type="button" className="btn" onClick={() => setState((s) => clearColor(s, 'black'))}>
                Remove Black only
              </button>
              <button type="button" className="btn" onClick={() => setState((s) => clearColor(s, 'white'))}>
                Remove White only
              </button>
              <button type="button" className="btn" onClick={() => setState(createMirroredQuickStart(timeControl))}>
                Load mirrored preset
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setState((s) => ({ ...s, turn: s.turn === 'white' ? 'black' : 'white' }))}
              >
                Flip side to move
              </button>
            </div>
          )}

          {state.phase === 'play' && sel?.kind === 'board' && state.shotReady.has(`${sel.file},${sel.rank}`) && (
            <div className="panel">
              <h2>3-stack shot</h2>
              <ShootList state={state} file={sel.file} rank={sel.rank} dispatch={dispatch} />
            </div>
          )}

          <ReservePanel
            state={state}
            selected={sel?.kind === 'reserve' ? sel.piece : null}
            onPick={(piece) => setSel({ kind: 'reserve', piece })}
          />
        </aside>

        <main className="board-wrap">
          <Board
            state={state}
            selected={sel?.kind === 'board' ? sel : null}
            targetMap={settings.showLegalDots ? targetMap : new Map()}
            setupSquares={setupSquares}
            doubleFiles={state.phase === 'setup-doubles' ? state.setup[chooser].doubleFiles : []}
            chooser={chooser}
            checkSquare={checkSquare}
            showCoords={settings.showCoords}
            facingById={facingById}
            viewerOrientation={viewerOrientation}
            onSquareClick={onSquareClick}
          />
        </main>

        <aside className="side log-side">
          <h2>Log</h2>
          <ul className="log">
            {[...state.log].reverse().map((e) => (
              <li key={e.id} className={`log-${e.level}`}>
                {e.message}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

function SettingsView({
  settings,
  onChange,
  onBack,
}: {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onBack: () => void
}) {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value })
  return (
    <div className="shell menu-shell">
      <div className="menu-card wide">
        <h1 className="menu-title">Settings</h1>
        <div className="settings-grid">
          <label>
            Board light
            <input type="color" value={settings.boardLight} onChange={(e) => set('boardLight', e.target.value)} />
          </label>
          <label>
            Board dark
            <input type="color" value={settings.boardDark} onChange={(e) => set('boardDark', e.target.value)} />
          </label>
          <label>
            Accent
            <input type="color" value={settings.accent} onChange={(e) => set('accent', e.target.value)} />
          </label>
          <label>
            White pieces
            <input type="color" value={settings.pieceWhite} onChange={(e) => set('pieceWhite', e.target.value)} />
          </label>
          <label>
            Black pieces
            <input type="color" value={settings.pieceBlack} onChange={(e) => set('pieceBlack', e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.showCoords} onChange={(e) => set('showCoords', e.target.checked)} />
            Show coordinates
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.showLegalDots} onChange={(e) => set('showLegalDots', e.target.checked)} />
            Highlight legal moves
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showPhaseBanners}
              onChange={(e) => set('showPhaseBanners', e.target.checked)}
            />
            Phase banners
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => set('soundEnabled', e.target.checked)} />
            Sound (hooks ready)
          </label>
          <label>
            Animations
            <select
              value={settings.animationSpeed}
              onChange={(e) => set('animationSpeed', e.target.value as AppSettings['animationSpeed'])}
            >
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label>
            Default clock
            <select
              value={settings.timeControlDefault}
              onChange={(e) => set('timeControlDefault', e.target.value as TimeControlId)}
            >
              <option value="5+3">5+3</option>
              <option value="10+5">10+5</option>
            </select>
          </label>
        </div>
        <button type="button" className="btn" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          Reset defaults
        </button>
        <button type="button" className="btn primary" onClick={onBack}>
          Back to menu
        </button>
      </div>
    </div>
  )
}

function findVolk(state: GameState, color: Color) {
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      if (state.board[f]![r]?.some((p) => p.type === 'Volk' && p.color === color)) return { file: f, rank: r }
    }
  }
  return null
}

function activeSide(state: GameState, chooser: Color): Color {
  if (state.phase === 'setup-doubles') return chooser
  return state.turn
}

function remainingToPlace(state: GameState, color: Color, piece: PieceType): number {
  const pool = state.setup[color].pool[piece] ?? 0
  const res = state.reserve[color].filter((p) => p === piece).length
  if (piece === 'Volk' || piece === 'Jugend') return pool
  return pool + res
}

function guidanceText(state: GameState, chooser: Color, placePiece: PieceType, mode: 'match' | 'sandbox') {
  if (mode === 'sandbox') return { title: 'Sandbox', detail: 'Explore freely — clocks paused.' }
  if (state.result) return { title: 'Game over', detail: state.endReason ?? '' }
  if (state.phase === 'setup-doubles') {
    return {
      title: `${label(chooser)} — choose doubles`,
      detail: `Select 5 soldier files for ${label(chooser)}, then confirm.`,
    }
  }
  if (state.phase === 'setup-mains') {
    const left = remainingToPlace(state, state.turn, placePiece)
    return {
      title: `${label(state.turn)} places`,
      detail: `Place ${placePiece} (${left} left). Gold squares are legal. Pass when ready.`,
    }
  }
  const check = isVolkInCheck(state, state.turn) ? ' — Volk in check!' : ''
  return {
    title: `${label(state.turn)} to move${check}`,
    detail: 'Click your stack, then a highlighted square. Captures glow red.',
  }
}

function label(c: Color) {
  return c === 'white' ? 'White' : 'Black'
}

function ClockPanel({ state }: { state: GameState }) {
  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }
  return (
    <div className="panel clocks">
      <div className={state.turn === 'black' && state.phase === 'play' ? 'clock active' : 'clock'}>
        <span>Black</span>
        <strong>{fmt(state.clocksMs.black)}</strong>
      </div>
      <div className={state.turn === 'white' && state.phase === 'play' ? 'clock active' : 'clock'}>
        <span>White</span>
        <strong>{fmt(state.clocksMs.white)}</strong>
      </div>
    </div>
  )
}

function ArmyPanel({ state, color, active }: { state: GameState; color: Color; active: boolean }) {
  const items: PieceType[] = ['Volk', 'Jugend', ...STANDARD_TYPES]
  return (
    <div className={`panel army ${active ? 'army-active' : ''}`}>
      <h2>{label(color)} army</h2>
      {state.phase === 'setup-mains' || state.phase === 'setup-doubles' ? (
        <ul className="army-list">
          {items.map((p) => {
            const left = remainingToPlace(state, color, p)
            const need = (state.setup[color].pool[p] ?? 0) > 0
            return (
              <li key={p} className={need ? 'must' : ''}>
                <span>
                  {PIECE_LETTER[p]} {displayName(p)}
                </span>
                <span>{left} left</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="hint">Reserve below · stacks on board.</p>
      )}
    </div>
  )
}

function ReservePanel({
  state,
  selected,
  onPick,
}: {
  state: GameState
  selected: PieceType | null
  onPick: (p: PieceType) => void
}) {
  return (
    <div className="panel">
      <h2>Reserve</h2>
      {(['white', 'black'] as Color[]).map((c) => (
        <div key={c} className="reserve-row">
          <span className="reserve-label">{label(c)}</span>
          <div className="piece-picker">
            {state.reserve[c].length === 0 && <em>empty</em>}
            {state.reserve[c].map((p, i) => (
              <button
                key={`${p}-${i}`}
                type="button"
                className={selected === p && state.turn === c && state.phase === 'play' ? 'active' : ''}
                disabled={state.phase !== 'play' || state.turn !== c}
                onClick={() => onPick(p)}
              >
                {displayName(p)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ShootList({
  state,
  file,
  rank,
  dispatch,
}: {
  state: GameState
  file: number
  rank: number
  dispatch: (a: Action) => void
}) {
  const shots = generateMovesFrom(state, file, rank, { asShoot: true })
  return (
    <div className="piece-picker">
      {shots.map((s) => (
        <button
          key={`${s.file}-${s.rank}`}
          type="button"
          onClick={() =>
            dispatch({ type: 'shoot', fromFile: file, fromRank: rank, toFile: s.file, toRank: s.rank })
          }
        >
          *{algebraic(s.file, s.rank)}
        </button>
      ))}
    </div>
  )
}

function Board({
  state,
  selected,
  targetMap,
  setupSquares,
  doubleFiles,
  chooser,
  checkSquare,
  showCoords,
  facingById,
  viewerOrientation,
  onSquareClick,
}: {
  state: GameState
  selected: { file: number; rank: number } | null
  targetMap: Map<string, { file: number; rank: number; kind: string; mode?: string }>
  setupSquares: Set<string>
  doubleFiles: number[]
  chooser: Color
  checkSquare: { file: number; rank: number } | null
  showCoords: boolean
  facingById: Record<string, SpriteDir>
  viewerOrientation: ViewerOrientation
  onSquareClick: (file: number, rank: number) => void
}) {
  const ranks =
    viewerOrientation === 'white-south'
      ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const files =
    viewerOrientation === 'white-south'
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      : [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  return (
    <div className="board" role="grid" aria-label="Schach 2 board">
      {ranks.map((rank) =>
        files.map((file) => {
          const stack = state.board[file]![rank]
          const dark = (file + rank) % 2 === 1
          const key = `${file},${rank}`
          const t = targetMap.get(key)
          const badge = stack ? stackBadge(stack) : null
          const piece = stack ? top(stack)! : null
          const boardFacing =
            piece != null
              ? (facingById[piece.id] ?? defaultFacing(piece.color))
              : null
          const viewDir =
            boardFacing != null ? spriteDirForViewer(boardFacing, viewerOrientation) : null
          return (
            <button
              key={key}
              type="button"
              className={[
                'sq',
                dark ? 'dark' : 'light',
                selected?.file === file && selected?.rank === rank ? 'selected' : '',
                t ? `target target-${t.kind}` : '',
                setupSquares.has(key) ? 'placeable' : '',
                state.phase === 'setup-doubles' &&
                rank === soldierBaseRank(chooser, file) &&
                doubleFiles.includes(file)
                  ? 'double-mark'
                  : '',
                checkSquare?.file === file && checkSquare?.rank === rank ? 'in-check' : '',
              ].join(' ')}
              onClick={() => onSquareClick(file, rank)}
              title={badge?.title}
            >
              {showCoords && (
                <span className="coord">
                  {(viewerOrientation === 'white-south' ? file === 0 : file === 9)
                    ? rank + 1
                    : ''}
                  {(viewerOrientation === 'white-south' ? rank === 0 : rank === 9)
                    ? 'abcdefghij'[file]
                    : ''}
                </span>
              )}
              {stack && badge && piece && viewDir && (
                <PieceSprite
                  type={piece.type}
                  color={piece.color}
                  dir={viewDir}
                  fused={badge.fused}
                  code={badge.code}
                  height={stack.length}
                  title={badge.title}
                />
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
