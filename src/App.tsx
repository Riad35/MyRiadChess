import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyAction,
  createInitialState,
  legalTargets,
  setupPlaceSquares,
  algebraic,
  top,
  STANDARD_TYPES,
  hasMinimumArmy,
  generateMovesFrom,
  isKoenigInCheck,
  createMirroredQuickStart,
  createEmptyPlayState,
  placeStack,
  clearBoard,
  clearColor,
  applyCompositionToSetup,
  type GameState,
  type Stack,
  type PieceType,
  type TimeControlId,
  type Color,
  type Action,
} from './engine'
import { setPieceIdCounter } from './engine/coords'
import {
  loadSettings,
  saveSettings,
  loadCompositions,
  upsertComposition,
  deleteComposition,
  type AppSettings,
  type SavedComposition,
} from './lib/prefs'
import { RULES_SECTIONS, UNIT_SCENARIOS } from './content/unitScenarios'
import { playBlip, syncMusic } from './lib/audio'
import { skinById } from './lib/skins'
import { liftAccent } from './view/ColorSwatches'
import { AmbientFx } from './view/AmbientFx'
import { IntroOverlay } from './view/Intro'
import { ProfileView } from './view/ProfileView'
import { SettingsView } from './view/SettingsView'
import { Board3D } from './view/Board3D'
import { PieceIcon } from './view/PieceIcon'
import { fusionIdFor } from './view/sprites'

type Screen = 'menu' | 'settings' | 'profile' | 'testing' | 'compositions' | 'game'

const PLAY_KEY = 'myriad.play.v1'
const INTRO_KEY = 'myriad.intro.played'

function markIntroPlayed() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    /* private mode */
  }
}

function introStillPending() {
  if (!loadSettings().introEnabled) return false
  try {
    return sessionStorage.getItem(INTRO_KEY) !== '1'
  } catch {
    return false
  }
}

function readPlaySession(): { screen: Screen; gameMode: 'match' | 'sandbox'; state: GameState } | null {
  try {
    const raw = sessionStorage.getItem(PLAY_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as {
      screen?: Screen
      gameMode?: 'match' | 'sandbox'
      state?: Omit<GameState, 'shotReady'> & { shotReady?: string[] }
    }
    const screens: Screen[] = ['menu', 'settings', 'profile', 'testing', 'compositions', 'game']
    if (!data.state?.board || data.state.board.length !== 10 || !data.screen || !screens.includes(data.screen)) return null
    const restored: GameState = {
      ...data.state,
      shotReady: new Set(Array.isArray(data.state.shotReady) ? data.state.shotReady : []),
    }
    if (typeof restored.nextPieceId === 'number') setPieceIdCounter(restored.nextPieceId)
    if (data.screen === 'game') markIntroPlayed()
    return {
      screen: data.screen,
      gameMode: data.gameMode === 'sandbox' ? 'sandbox' : 'match',
      state: restored,
    }
  } catch {
    return null
  }
}

const boot = readPlaySession()
type TestingTab = 'guide-rules' | 'guide-units' | 'testmap'
type Sel =
  | null
  | { kind: 'board'; file: number; rank: number }
  | { kind: 'reserve'; piece: PieceType }

const PASS_HELP =
  'Condition: König and Dame set, and at least 2 of each Turm / Bishop / Ritter / Drache on the board (plus 15 Soldaten). You may keep up to 4 standard figures in reserve for the Battle Phase.'

const KNOWN_PIECES = new Set<PieceType>(['König', 'Dame', 'Turm', 'Bishop', 'Ritter', 'Drache', 'Soldat'])

type MoveHit = { file: number; rank: number; kind: string; mode?: string }
type MoveChoice = { title: string; options: { label: string; run: () => void }[] }

function distinctHits(targets: MoveHit[], file: number, rank: number) {
  const seen = new Set<string>()
  const out: MoveHit[] = []
  for (const t of targets) {
    if (t.file !== file || t.rank !== rank) continue
    const key = `${t.kind}:${t.mode ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

function moveLabel(hit: MoveHit) {
  if (hit.kind === 'split') return 'Split — only the top piece'
  if (hit.mode === 'ritter') return 'Jump as Ritter'
  if (hit.mode === 'drache') return 'Jump as Drache'
  if (hit.kind === 'capture') return 'Capture with the whole stack'
  if (hit.kind === 'fuse') return 'Stack onto your piece'
  return 'Move the whole stack'
}

function marchMode(hit: MoveHit): 'ritter' | 'drache' | 'split' | 'unit' {
  if (hit.kind === 'split') return 'split'
  if (hit.mode === 'ritter' || hit.mode === 'drache') return hit.mode
  return 'unit'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(boot?.screen ?? 'menu')
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [compositions, setCompositions] = useState<SavedComposition[]>(() => loadCompositions())
  const [timeControl, setTimeControl] = useState<TimeControlId>(settings.timeControlDefault)
  const [state, setState] = useState<GameState>(() => boot?.state ?? createInitialState('10+5'))
  const [sel, setSel] = useState<Sel>(null)
  const [placePiece, setPlacePiece] = useState<PieceType>('König')
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerKey, setBannerKey] = useState(0)
  const [passHelpOpen, setPassHelpOpen] = useState(false)
  const [testingTab, setTestingTab] = useState<TestingTab>('guide-rules')
  const [unitFilter, setUnitFilter] = useState('König')
  const [spawnType, setSpawnType] = useState<PieceType>('Ritter')
  const [spawnColor, setSpawnColor] = useState<Color>('white')
  const [spawnHeight, setSpawnHeight] = useState(1)
  const [gameMode, setGameMode] = useState<'match' | 'sandbox'>(boot?.gameMode ?? 'match')
  const [notice, setNotice] = useState<{ id: number; title: string; blocking: boolean } | null>(null)
  const [moveChoice, setMoveChoice] = useState<MoveChoice | null>(null)
  const [showIntro, setShowIntro] = useState(() => boot?.screen !== 'game' && introStillPending())
  const [hoverSq, setHoverSq] = useState<{ file: number; rank: number } | null>(null)
  const [drag, setDrag] = useState<{ file: number; rank: number } | null>(null)
  const [burst, setBurst] = useState<{ id: number; kind: 'spark' | 'slash' } | null>(null)
  const skin = skinById(settings.skinId)

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
    root.style.setProperty('--gold-hot', liftAccent(s.accent))
  }, [])

  useEffect(() => {
    applyTheme(settings)
  }, [settings, applyTheme])

  useEffect(() => {
    if (showIntro) markIntroPlayed()
  }, [showIntro])

  useEffect(() => {
    try {
      const payload = {
        screen,
        gameMode,
        state: { ...state, shotReady: [...state.shotReady] },
      }
      sessionStorage.setItem(PLAY_KEY, JSON.stringify(payload))
    } catch {
      /* quota */
    }
  }, [screen, gameMode, state])

  const startGame = () => {
    setGameMode('match')
    const s = createInitialState(timeControl)
    setState(s)
    setSel(null)
    setPlacePiece('König')
    setScreen('game')
    announce('SETTING PHASE')
  }

  const startMirrored = () => {
    setGameMode('match')
    const s = createMirroredQuickStart(timeControl)
    setState(s)
    setSel(null)
    setScreen('game')
    announce('BATTLE PHASE')
  }

  const openScenario = (build: () => GameState) => {
    setGameMode('sandbox')
    setState(build())
    setSel(null)
    setTestingTab('guide-units')
    setScreen('game')
    announce('GUIDE SCENARIO')
  }

  const openTestmap = () => {
    setGameMode('sandbox')
    setState(createEmptyPlayState(timeControl))
    setSel(null)
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
    if (state.phase !== 'play' || state.result || gameMode === 'sandbox' || state.pendingPromotion) return
    const id = window.setInterval(() => {
      setState((prev) => applyAction(prev, { type: 'tick', nowMs: Date.now(), side: prev.turn }).state)
    }, 100)
    return () => clearInterval(id)
  }, [state.phase, state.result, state.turn, gameMode, state.pendingPromotion])

  const lastLog = state.log[state.log.length - 1]
  useEffect(() => {
    if (!lastLog || lastLog.level !== 'illegal') return
    setNotice({ id: lastLog.id, title: lastLog.message.replace(/^Illegal:\s*/, ''), blocking: true })
  }, [lastLog])

  useEffect(() => {
    void syncMusic(screen === 'game' && settings.soundEnabled, settings.musicVolume)
  }, [screen, settings.soundEnabled, settings.musicVolume])

  const heard = useRef<number | null>(null)
  useEffect(() => {
    if (!lastLog || lastLog.level !== 'move' || heard.current === lastLog.id) return
    heard.current = lastLog.id
    const capture = lastLog.message.includes(' x')
    const fuse = lastLog.message.includes('↑')
    if (settings.soundEnabled) {
      if (capture && skin.sfx.capture) playBlip('capture')
      else if (fuse && skin.sfx.fuse) playBlip('fuse')
      else if (skin.sfx.move) playBlip('move')
    }
    if (skin.vfx !== 'none' && (capture || fuse)) {
      setBurst({ id: lastLog.id, kind: skin.vfx === 'slash' ? 'slash' : 'spark' })
    }
  }, [lastLog, settings.soundEnabled, skin])

  useEffect(() => {
    if (screen !== 'game' || state.phase !== 'play' || state.pendingPromotion) return
    if (!isKoenigInCheck(state, state.turn)) return
    setNotice({
      id: state.turn === 'white' ? 900_001 : 900_002,
      title: `${state.turn === 'white' ? 'White' : 'Black'} König is in check`,
      blocking: false,
    })
  }, [state.turn, state.phase, screen, state.pendingPromotion])

  const targets = useMemo(() => {
    if (!sel || sel.kind !== 'board' || state.phase !== 'play') return []
    return legalTargets(state, sel.file, sel.rank)
  }, [sel, state])

  const onHoverSquare = useCallback((square: { file: number; rank: number } | null) => {
    setHoverSq((prev) => {
      if (!square) return prev ? null : prev
      if (prev && prev.file === square.file && prev.rank === square.rank) return prev
      return square
    })
  }, [])

  const targetMap = useMemo(() => {
    const m = new Map<string, (typeof targets)[0]>()
    for (const t of targets) {
      const k = `${t.file},${t.rank}`
      if (!m.has(k) || t.kind === 'capture' || t.kind === 'split') m.set(k, t)
    }
    return m
  }, [targets])

  const preview = useMemo(() => {
    if (state.phase !== 'play' || state.result || state.pendingPromotion) return null
    if (!hoverSq || sel?.kind !== 'board') return null
    if (hoverSq.file === sel.file && hoverSq.rank === sel.rank) return null
    if (!targetMap.has(`${hoverSq.file},${hoverSq.rank}`)) return null
    const stack = state.board[sel.file]?.[sel.rank]
    if (!stack) return null
    return { file: hoverSq.file, rank: hoverSq.rank, stack }
  }, [hoverSq, sel, state, targetMap])

  const movableSquares = useMemo(() => {
    const set = new Set<string>()
    if (state.phase !== 'play' || state.result || state.pendingPromotion) return set
    for (let file = 0; file < 10; file++) {
      for (let rank = 0; rank < 10; rank++) {
        const stack = state.board[file]?.[rank]
        if (!stack || top(stack)?.color !== state.turn) continue
        if (legalTargets(state, file, rank).length > 0) set.add(`${file},${rank}`)
      }
    }
    return set
  }, [state])

  const setupSquares = useMemo(() => {
    if (state.phase !== 'setup-mains') return new Set<string>()
    return new Set(setupPlaceSquares(state, state.turn, placePiece).map((s) => `${s.file},${s.rank}`))
  }, [state, placePiece])

  const checkSquare = useMemo(() => {
    if (state.phase !== 'play') return null
    if (!isKoenigInCheck(state, state.turn)) return null
    return findKoenig(state, state.turn)
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
    if (state.pendingPromotion) return
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
        const hits = distinctHits(targets, file, rank)
        if (hits.length > 1) {
          const from = sel
          setMoveChoice({
            title: 'How should this piece move?',
            options: hits.map((hit) => ({
              label: moveLabel(hit),
              run: () => {
                setMoveChoice(null)
                dispatch({
                  type: 'march',
                  fromFile: from.file,
                  fromRank: from.rank,
                  toFile: file,
                  toRank: rank,
                  mode: marchMode(hit),
                })
              },
            })),
          })
          return
        }
        if (hits.length === 1) {
          dispatch({
            type: 'march',
            fromFile: sel.file,
            fromRank: sel.rank,
            toFile: file,
            toRank: rank,
            mode: marchMode(hits[0]!),
          })
          return
        }
      }
      const stack = state.board[file]![rank]
      if (stack && top(stack)?.color === state.turn) setSel({ kind: 'board', file, rank })
      else setSel(null)
    }
  }

  const onDragStart = (file: number, rank: number) => {
    if (state.phase !== 'play' || state.result || state.pendingPromotion) return
    setSel({ kind: 'board', file, rank })
    setDrag({ file, rank })
  }

  const onDragEnd = (square: { file: number; rank: number } | null) => {
    const from = drag
    setDrag(null)
    if (!from || !square) return
    if (square.file === from.file && square.rank === from.rank) return
    if (!targetMap.has(`${square.file},${square.rank}`)) return
    onSquareClick(square.file, square.rank)
  }

  const importComposition = (c: SavedComposition) => {
    if (c.side !== state.turn && state.phase === 'setup-mains') {
      // still allow load for that side's turn later — force to composition side turn
    }
    setState(applyCompositionToSetup(state, c.side, c.doubleFiles, c.placements))
    setPlacePiece('Turm')
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
        <AmbientFx kind={settings.ambientFx} accent={settings.accent} />
        {showIntro && (
          <IntroOverlay
            accent={settings.accent}
            sound={settings.soundEnabled}
            onDone={() => {
              markIntroPlayed()
              setShowIntro(false)
            }}
          />
        )}
        <div className="menu-card">
          <p className="menu-kicker">Local · Hot-seat</p>
          <h1 className="menu-title">Myriad Chess</h1>
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
          <button type="button" className="btn" onClick={() => setScreen('profile')}>
            Profile
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

  if (screen === 'profile') {
    return (
      <ProfileView
        settings={settings}
        onChange={(next) => {
          setSettings(next)
          saveSettings(next)
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
                  {KNOWN_PIECES.has(u as PieceType) && <PieceIcon type={u as PieceType} color="white" />}
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
      {notice && (
        <NoticePopup
          key={notice.id}
          title={notice.title}
          blocking={notice.blocking}
          onDone={() => setNotice(null)}
        />
      )}
      {moveChoice && (
        <div className="popup-layer">
          <div className="popup-card">
            <h2>{moveChoice.title}</h2>
            <div className="choice-list">
              {moveChoice.options.map((opt) => (
                <button key={opt.label} type="button" className="btn" onClick={opt.run}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn ghost" onClick={() => setMoveChoice(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {state.pendingPromotion && (
        <PromotionDialog
          color={state.pendingPromotion.color}
          isDouble={state.pendingPromotion.squares.some((sq) => sq.isDouble)}
          onConfirm={(choices) => dispatch({ type: 'promote', choices })}
        />
      )}

      <header className="topbar">
        <div>
          <button type="button" className="btn ghost small" onClick={() => setScreen(gameMode === 'sandbox' ? 'testing' : 'menu')}>
            {gameMode === 'sandbox' ? 'Testing' : 'Menu'}
          </button>
          <h1>Myriad Chess</h1>
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
                {(['König', 'Dame', ...STANDARD_TYPES] as PieceType[]).map((p) => {
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
                      <PieceIcon type={p} color={state.turn} />
                      <small>×{left}</small>
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
                {(['König', 'Dame', ...STANDARD_TYPES, 'Soldat'] as PieceType[]).map((p) => (
                  <button key={p} type="button" className={spawnType === p ? 'active' : ''} onClick={() => setSpawnType(p)}>
                    <PieceIcon type={p} color={spawnColor} />
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

          {sel?.kind === 'board' && state.board[sel.file]?.[sel.rank] && (
            <SelectedStack stack={state.board[sel.file]![sel.rank]!} />
          )}

          <ReservePanel
            state={state}
            selected={sel?.kind === 'reserve' ? sel.piece : null}
            onPick={(piece) => setSel({ kind: 'reserve', piece })}
          />
        </aside>

        <main className={skin.id === 'signal' ? 'board-wrap signal-board' : 'board-wrap'}>
          {burst && <div key={burst.id} className={`board-fx fx-${burst.kind}`} />}
          <Board3D
            state={state}
            selected={sel?.kind === 'board' ? sel : null}
            targetMap={settings.showLegalDots ? targetMap : new Map()}
            setupSquares={setupSquares}
            doubleFiles={state.phase === 'setup-doubles' ? state.setup[chooser].doubleFiles : []}
            chooser={chooser}
            checkSquare={checkSquare}
            showCoords={settings.showCoords}
            light={settings.boardLight}
            dark={settings.boardDark}
            accent={settings.accent}
            movable={movableSquares}
            motion={settings.animationSpeed === 'off' ? 'none' : skin.moveAnim}
            motionRate={settings.animationSpeed === 'fast' ? 9 : 4.5}
            preview={preview}
            dragging={drag}
            onHoverSquare={onHoverSquare}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
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

function findKoenig(state: GameState, color: Color) {
  for (let f = 0; f < 10; f++) {
    for (let r = 0; r < 10; r++) {
      if (state.board[f]![r]?.some((p) => p.type === 'König' && p.color === color)) return { file: f, rank: r }
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
  if (piece === 'König' || piece === 'Dame') return pool
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
      detail: `Place ${placePiece} (${left} left). Marked squares are legal. Pass when ready.`,
    }
  }
  const check = isKoenigInCheck(state, state.turn) ? ' — König in check!' : ''
  return {
    title: `${label(state.turn)} to move${check}`,
    detail: 'Click your stack, then a highlighted square. Darker squares are captures.',
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
  const items: PieceType[] = ['König', 'Dame', ...STANDARD_TYPES]
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
                <span className="army-name">
                  <PieceIcon type={p} color={color} />
                  {p}
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

function SelectedStack({ stack }: { stack: Stack }) {
  const fusion = fusionIdFor(stack)
  const head = stack[stack.length - 1]!
  return (
    <div className="panel">
      <h2>On this square</h2>
      <div className="piece-picker">
        {fusion ? (
          <PieceIcon type={head.type} fusion={fusion} color={head.color} />
        ) : (
          stack.map((piece) => <PieceIcon key={piece.id} type={piece.type} color={piece.color} />)
        )}
      </div>
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
                <PieceIcon type={p} color={c} />
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

function NoticePopup({
  title,
  blocking,
  onDone,
}: {
  title: string
  blocking: boolean
  onDone: () => void
}) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 1680)
    return () => window.clearTimeout(id)
  }, [title])
  return (
    <div
      className={blocking ? 'popup-layer popup-flash' : 'popup-layer popup-check'}
      onClick={blocking ? onDone : undefined}
      role="status"
    >
      <div className="popup-card">
        <h2>{title}</h2>
      </div>
    </div>
  )
}

function PromotionDialog({
  color,
  isDouble,
  onConfirm,
}: {
  color: Color
  isDouble: boolean
  onConfirm: (choices: PieceType[]) => void
}) {
  const options: PieceType[] = ['Turm', 'Bishop', 'Ritter', 'Drache']
  return (
    <div className="popup-layer">
      <div className="popup-card">
        <h2>{isDouble ? 'Doppel promotion' : 'Promote the Soldat'}</h2>
        <p>
          {isDouble
            ? 'One Soldat becomes Dame. Choose what the other becomes.'
            : 'This Soldat reached the back rank. Choose its new form.'}
        </p>
        <div className="piece-picker promo-picker">
          {options.map((p) => (
            <button key={p} type="button" onClick={() => onConfirm([p])}>
              <PieceIcon type={p} color={color} />
              <span>{p}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
