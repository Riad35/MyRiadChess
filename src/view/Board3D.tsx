import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { CheckThreat, Color, GameState, PieceType } from '../engine'
import { carriedStack } from '../engine'
import {
  FACINGS,
  facingFrames,
  facingIndex,
  fusionSheet,
  hoverSilhouette,
  loadSpriteLibrary,
  pieceSheet,
  stackBodies,
  type FusionId,
  type SpriteLibrary,
} from './sprites'
import { crestTexture } from './crests'

type Target = { file: number; rank: number; kind: string; mode?: string }

type Motion = 'none' | 'hop' | 'slide'

const dragClick = { current: false }

type BoardProps = {
  state: GameState
  selected: { file: number; rank: number } | null
  targetMap: Map<string, Target>
  setupSquares: Set<string>
  doubleFiles: number[]
  chooser: Color
  checkSquare: { file: number; rank: number } | null
  threats: CheckThreat[]
  showCoords: boolean
  showCrests: boolean
  light: string
  dark: string
  accent: string
  movable: Set<string>
  motion: Motion
  motionRate: number
  preview: { file: number; rank: number; stack: NonNullable<GameState['board'][number][number]> } | null
  dragging: { file: number; rank: number } | null
  onHoverSquare: (square: { file: number; rank: number } | null) => void
  onDragStart: (file: number, rank: number) => void
  onDragEnd: (square: { file: number; rank: number } | null) => boolean
  onSquareClick: (file: number, rank: number) => void
  skinId: string
}

function sameBoard(a: BoardProps, b: BoardProps): boolean {
  return (
    a.state.board === b.state.board &&
    a.state.phase === b.state.phase &&
    a.state.turn === b.state.turn &&
    a.state.reserve === b.state.reserve &&
    a.state.setup === b.state.setup &&
    a.selected === b.selected &&
    a.targetMap === b.targetMap &&
    a.setupSquares === b.setupSquares &&
    a.doubleFiles === b.doubleFiles &&
    a.chooser === b.chooser &&
    a.checkSquare === b.checkSquare &&
    a.threats === b.threats &&
    a.showCoords === b.showCoords &&
    a.showCrests === b.showCrests &&
    a.light === b.light &&
    a.dark === b.dark &&
    a.accent === b.accent &&
    a.movable === b.movable &&
    a.motion === b.motion &&
    a.motionRate === b.motionRate &&
    a.preview === b.preview &&
    a.dragging === b.dragging &&
    a.onHoverSquare === b.onHoverSquare &&
    a.onDragStart === b.onDragStart &&
    a.onDragEnd === b.onDragEnd &&
    a.onSquareClick === b.onSquareClick &&
    a.skinId === b.skinId
  )
}

export const Board3D = memo(function Board3D(props: BoardProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  return (
    <div className="board-stage">
      <Canvas
        camera={{ position: [0, 10.0, -16.5], fov: 40, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: false }}
        onCreated={({ gl }) => {
          const stopFocusScroll = (event: Event) => event.preventDefault()
          gl.domElement.addEventListener('mousedown', stopFocusScroll)
          gl.domElement.addEventListener('touchstart', stopFocusScroll)
        }}
      >
        <color attach="background" args={['#161616']} />
        <Scene {...props} />
        <HoverLeave onHoverSquare={props.onHoverSquare} />
        <OrbitControls
          ref={controls}
          target={[0, 0.2, 0]}
          enablePan={false}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={9.5}
          maxDistance={19.2}
          mouseButtons={{
            LEFT: null as unknown as THREE.MOUSE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>
    </div>
  )
}, sameBoard)

function DragSession({
  armed,
  hoverRef,
  onDragStart,
  onDragEnd,
}: {
  armed: { current: { x: number; y: number; file: number; rank: number; started: boolean } | null }
  hoverRef: { current: { file: number; rank: number } | null }
  onDragStart: (file: number, rank: number) => void
  onDragEnd: (square: { file: number; rank: number } | null) => void
}) {
  const gl = useThree((state) => state.gl)
  const start = useRef(onDragStart)
  const end = useRef(onDragEnd)
  start.current = onDragStart
  end.current = onDragEnd
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const arm = armed.current
      if (!arm || arm.started || (event.buttons & 1) === 0) return
      const dx = event.clientX - arm.x
      const dy = event.clientY - arm.y
      if (dx * dx + dy * dy < 16) return
      arm.started = true
      dragClick.current = true
      document.body.style.cursor = 'grabbing'
      start.current(arm.file, arm.rank)
    }
    const up = () => {
      const arm = armed.current
      if (!arm) return
      armed.current = null
      if (!arm.started) return
      document.body.style.cursor = ''
      end.current(hoverRef.current)
    }
    const leave = () => {
      hoverRef.current = null
    }
    gl.domElement.addEventListener('pointerleave', leave)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      gl.domElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl, armed, hoverRef])
  return null
}

function HoverLeave({ onHoverSquare }: { onHoverSquare: (square: null) => void }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const leave = () => onHoverSquare(null)
    gl.domElement.addEventListener('pointerleave', leave)
    return () => gl.domElement.removeEventListener('pointerleave', leave)
  }, [gl, onHoverSquare])
  return null
}

type Glide = {
  file: number
  rank: number
  stack: NonNullable<GameState['board'][number][number]>
  x: number
  z: number
  t0: number
}

function Scene(props: BoardProps) {
  const [lib, setLib] = useState<SpriteLibrary | null>(null)
  const [glide, setGlide] = useState<Glide | null>(null)
  const armed = useRef<{ x: number; y: number; file: number; rank: number; started: boolean } | null>(null)
  const hoverRef = useRef<{ file: number; rank: number } | null>(null)
  const grip = useRef({ x: 0, z: 0 })
  const glideDone = useRef(false)
  const onHover = (square: { file: number; rank: number } | null) => {
    hoverRef.current = square
    props.onHoverSquare(square)
  }
  const armDrag = (file: number, rank: number, x: number, y: number) => {
    armed.current = { x, y, file, rank, started: false }
    grip.current = { x: file - 4.5, z: rank - 4.5 }
    setGlide(null)
  }
  const finishDrag = (square: { file: number; rank: number } | null) => {
    const from = props.dragging
    const stack = from ? props.state.board[from.file]?.[from.rank] : null
    const carry = stack ? carriedStack(stack) : null
    const taken = props.onDragEnd(square)
    if (!taken && from && carry) {
      glideDone.current = false
      setGlide({ file: from.file, rank: from.rank, stack: carry, x: grip.current.x, z: grip.current.z, t0: performance.now() })
      return
    }
    setGlide(null)
  }
  const endGlide = () => {
    if (glideDone.current) return
    glideDone.current = true
    setGlide(null)
  }
  useEffect(() => {
    let live = true
    loadSpriteLibrary(props.skinId).then((next) => {
      if (live) setLib(next)
    })
    return () => {
      live = false
    }
  }, [props.skinId])

  const threatKey = props.threats
    .map((threat) => `${threat.kind}:${threat.squares.map((sq) => `${sq.file},${sq.rank}`).join(';')}`)
    .join('|')
  const levels = pulseLevels(props.threats, 0)
  const pulseMats = useRef(new Map<string, THREE.MeshBasicMaterial>())
  const threatSquares = useMemo(() => {
    const set = new Set<string>()
    for (const threat of props.threats) {
      for (const sq of threat.squares) set.add(`${sq.file},${sq.rank}`)
    }
    return set
  }, [props.threats])
  const leapOnly = props.threats.some((t) => t.kind === 'leap') && !props.threats.some((t) => t.kind === 'ray')

  const heldStack =
    props.dragging && props.state.board[props.dragging.file]?.[props.dragging.rank]
      ? props.state.board[props.dragging.file]![props.dragging.rank]
      : null
  const heldCarry = heldStack ? carriedStack(heldStack) : null
  return (
    <>
      <DragSession armed={armed} hoverRef={hoverRef} onDragStart={props.onDragStart} onDragEnd={finishDrag} />
      {lib && <ReserveFloaters lib={lib} reserve={props.state.reserve} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[11.2, 11.2]} />
        <meshBasicMaterial color="#111111" toneMapped={false} />
      </mesh>
      <PixelBoard light={props.light} dark={props.dark} />
      {threatKey && (
        <PulseDriver
          threats={props.threats}
          threatKey={threatKey}
          mats={pulseMats}
          accent={props.accent}
          light={props.light}
          dark={props.dark}
        />
      )}
      {Array.from({ length: 10 }, (_, file) =>
        Array.from({ length: 10 }, (_, rank) => {
          const key = `${file},${rank}`
          const target = props.targetMap.get(key)
          const soldierRank = props.state.setup[props.chooser].soldierRanks[file]
          const doubleMark =
            props.state.phase === 'setup-doubles' && rank === soldierRank && props.doubleFiles.includes(file)
          const dark = (file + rank) % 2 === 1
          const base = dark ? props.dark : props.light
          const selected = props.selected?.file === file && props.selected.rank === rank
          const placeable = props.setupSquares.has(key)
          const pulse = levels.get(key)
          const leapKing = leapOnly && props.checkSquare?.file === file && props.checkSquare.rank === rank
          const pulseId = threatSquares.has(key) && !selected && !target?.kind && !placeable ? key : undefined
          return (
            <Tile
              key={key}
              file={file}
              rank={rank}
              targetMap={props.targetMap}
              marked={tileMarked({
                selected,
                kind: target?.kind,
                placeable,
                doubleMark,
                pulse,
                leapKing,
              })}
              color={tileColor({
                base,
                dark,
                accent: props.accent,
                selected,
                kind: target?.kind,
                placeable,
                doubleMark,
                pulse,
                leapKing,
              })}
              onSquareClick={props.onSquareClick}
              onHoverSquare={onHover}
              pulseId={pulseId}
              pulseMats={pulseMats}
            />
          )
        }),
      )}
      {lib &&
        props.state.board.flatMap((fileStacks, file) =>
          fileStacks.flatMap((stack, rank) =>
            stack
              ? [
                  <StackView
                    key={`${file}-${rank}`}
                    stack={stack}
                    file={file}
                    rank={rank}
                    lib={lib}
                    targetMap={props.targetMap}
                    onClick={props.onSquareClick}
                    motion={props.motion}
                    motionRate={props.motionRate}
                    accent={props.accent}
                    skinId={props.skinId}
                    canMove={props.movable.has(`${file},${rank}`)}
                    onHoverSquare={onHover}
                    onArmDrag={armDrag}
                    showCrests={props.showCrests}
                    held={
                      (props.dragging?.file === file && props.dragging.rank === rank) ||
                      (glide?.file === file && glide.rank === rank)
                    }
                  />,
                ]
              : [],
          ),
        )}
      {lib && props.preview && (
        <StackView
          key={`plan-${props.preview.file}-${props.preview.rank}`}
          stack={props.preview.stack}
          file={props.preview.file}
          rank={props.preview.rank}
          lib={lib}
          targetMap={props.targetMap}
          onClick={props.onSquareClick}
          motion="none"
          motionRate={0}
          accent={props.accent}
          skinId={props.skinId}
          canMove={false}
          ghost
          showCrests={props.showCrests}
        />
      )}
      {lib && heldCarry && props.dragging && (
        <StackView
          key={`drag-${props.dragging.file}-${props.dragging.rank}`}
          stack={heldCarry}
          file={props.dragging.file}
          rank={props.dragging.rank}
          lib={lib}
          targetMap={props.targetMap}
          onClick={props.onSquareClick}
          motion="none"
          motionRate={0}
          accent={props.accent}
          skinId={props.skinId}
          canMove={false}
          followPointer
          grip={grip}
          showCrests={props.showCrests}
        />
      )}
      {lib && glide && !props.dragging && (
        <StackView
          key={`glide-${glide.file}-${glide.rank}-${glide.t0}`}
          stack={glide.stack}
          file={glide.file}
          rank={glide.rank}
          lib={lib}
          targetMap={props.targetMap}
          onClick={props.onSquareClick}
          motion="none"
          motionRate={0}
          accent={props.accent}
          skinId={props.skinId}
          canMove={false}
          glide={glide}
          onGlideDone={endGlide}
          showCrests={props.showCrests}
        />
      )}
      {props.showCoords && <Coords />}
    </>
  )
}

/** Longest side of the sprite canvas, in world units. The drawn figure stays inside its square. */
const PIECE_SIZE = 1

/** Fraction of the canvas below the opaque feet, so the figure can sit on the square. */
const FOOT_PAD: Record<string, number> = {
  bishop: 0.146,
  dame: 0.177,
  drache: 0.073,
  doppelturm: 0.125,
  'edler-drache': 0.063,
  koenig: 0.073,
  'edler-ritter': 0.063,
  doppelbishop: 0.073,
  ritter: 0.094,
  soldat: 0.208,
  turm: 0.094,
  doppelsoldat: 0.125,
  drachenritter: 0.063,
  'skins/chessmen/bishop': 0.135,
  'skins/chessmen/dame': 0.188,
  'skins/chessmen/ritter': 0.094,
  'skins/chessmen/soldat': 0.125,
  'skins/chessmen/doppelsoldat': 0.125,
  'skins/chessmen/doppelturm': 0.125,
  'skins/chessmen/doppelbishop': 0.021,
}

/** One card per square. `seat` is how far the feet sit below the card center. */
function pieceStand(type: PieceType, skinId: string, fusion?: FusionId, footPad?: number) {
  const key = fusion ? fusionSheet(skinId, fusion) : pieceSheet(skinId, type)
  const pad = footPad ?? FOOT_PAD[key] ?? 0.12
  const soldier = (!fusion && type === 'Soldat') || fusion === 'doppelsoldat'
  const size = type === 'Dame' && !fusion ? PIECE_SIZE * 1.12 : soldier ? PIECE_SIZE * 0.78 : PIECE_SIZE
  return { size, seat: size * (0.5 - pad) }
}

/**
 * Yaw is the nearest board direction, shared by every piece, so a rank stays parallel.
 * Pitch matches the camera, up to straight down, so a top view lays the card flat on its square.
 */
function boardYaw(camera: THREE.Camera) {
  return Math.round(Math.atan2(camera.position.x, camera.position.z) / (Math.PI / 4)) * (Math.PI / 4)
}

function viewPitch(camera: THREE.Camera, x: number, y: number, z: number) {
  const dx = camera.position.x - x
  const dy = camera.position.y - y
  const dz = camera.position.z - z
  const elev = Math.atan2(Math.max(dy, 0), Math.hypot(dx, dz) || 0.001)
  return Math.min(elev, Math.PI / 2 - 0.001)
}

function applyPose(mesh: THREE.Object3D, yaw: number, pitch: number) {
  mesh.rotation.order = 'YXZ'
  mesh.rotation.set(-pitch, yaw, 0)
}

function tileMarked(opts: {
  selected: boolean
  kind?: string
  placeable: boolean
  doubleMark: boolean
  pulse?: number
  leapKing: boolean
}) {
  return opts.pulse != null || opts.leapKing || opts.selected || !!opts.kind || opts.placeable || opts.doubleMark
}

function tileColor(opts: {
  base: string
  dark: boolean
  accent: string
  selected: boolean
  kind?: string
  placeable: boolean
  doubleMark: boolean
  pulse?: number
  leapKing: boolean
}) {
  if (opts.selected) return opts.accent
  if (opts.kind === 'capture' || opts.kind === 'split') return '#2e2e2e'
  if (opts.kind) return mixWhite(opts.accent, 0.5)
  if (opts.placeable) return mixWhite(opts.accent, 0.35)
  if (opts.pulse === 0 || opts.leapKing) return opts.accent
  if (opts.pulse === 1) return mixToward(opts.accent, opts.base, 0.5)
  if (opts.pulse === 2) return mixToward(opts.accent, opts.base, 0.82)
  if (opts.doubleMark) return opts.dark ? '#5e5b57' : '#d5d0c6'
  return opts.base
}

/** 0 = full accent, then two dimmer steps. Brighter (lower) wins when trails overlap. */
function pulseLevels(threats: CheckThreat[], tick: number) {
  const levels = new Map<string, number>()
  const put = (file: number, rank: number, level: number) => {
    const key = `${file},${rank}`
    const prev = levels.get(key)
    if (prev == null || level < prev) levels.set(key, level)
  }
  for (const threat of threats) {
    if (threat.kind === 'leap') {
      const sq = threat.squares[0]
      if (sq && tick % 2 === 0) put(sq.file, sq.rank, 0)
      continue
    }
    const n = threat.squares.length
    if (n === 0) continue
    const t = tick % (n + 3)
    threat.squares.forEach((sq, i) => {
      const age = t - i
      if (age >= 0 && age <= 2) put(sq.file, sq.rank, age)
    })
  }
  return levels
}

function chooseSquare(
  intersections: { object: THREE.Object3D }[],
  targetMap: Map<string, Target>,
) {
  for (const hit of intersections) {
    const data = hit.object.userData as { file?: number; rank?: number; kind?: string }
    if (data.kind === 'tile' && data.file != null && data.rank != null && targetMap.has(`${data.file},${data.rank}`)) {
      return { file: data.file, rank: data.rank }
    }
  }
  const first = intersections.find((hit) => hit.object.userData.kind === 'piece' || hit.object.userData.kind === 'tile')
  const data = first?.object.userData as { file?: number; rank?: number } | undefined
  if (data?.file == null || data.rank == null) return null
  return { file: data.file, rank: data.rank }
}

function PulseDriver({
  threats,
  threatKey,
  mats,
  accent,
  light,
  dark,
}: {
  threats: CheckThreat[]
  threatKey: string
  mats: { current: Map<string, THREE.MeshBasicMaterial> }
  accent: string
  light: string
  dark: string
}) {
  const start = useRef(performance.now())
  const threatsRef = useRef(threats)
  threatsRef.current = threats
  const colors = useRef({ accent, light, dark })
  colors.current = { accent, light, dark }
  useEffect(() => {
    start.current = performance.now()
  }, [threatKey])
  useFrame(() => {
    const tick = Math.floor((performance.now() - start.current) / 180)
    const levels = pulseLevels(threatsRef.current, tick)
    const paint = colors.current
    for (const [id, mat] of mats.current) {
      const comma = id.indexOf(',')
      const file = Number(id.slice(0, comma))
      const rank = Number(id.slice(comma + 1))
      const level = levels.get(id)
      const base = (file + rank) % 2 === 1 ? paint.dark : paint.light
      if (level == null) {
        mat.color.set(base)
        mat.opacity = 0
        mat.transparent = true
      } else {
        mat.color.set(level === 0 ? paint.accent : mixToward(paint.accent, base, level === 1 ? 0.5 : 0.82))
        mat.opacity = 0.92
        mat.transparent = false
      }
    }
  })
  return null
}

function Tile({
  file,
  rank,
  color,
  marked,
  onSquareClick,
  onHoverSquare,
  targetMap,
  pulseId,
  pulseMats,
}: {
  file: number
  rank: number
  color: string
  marked: boolean
  onSquareClick: (file: number, rank: number) => void
  onHoverSquare: (square: { file: number; rank: number }) => void
  targetMap: Map<string, Target>
  pulseId?: string
  pulseMats: { current: Map<string, THREE.MeshBasicMaterial> }
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useLayoutEffect(() => {
    const material = mat.current
    if (!pulseId || !material) return
    pulseMats.current.set(pulseId, material)
    return () => {
      pulseMats.current.delete(pulseId)
    }
  }, [pulseId, pulseMats])
  return (
    <mesh
      userData={{ file, rank, kind: 'tile' }}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[file - 4.5, 0.02, rank - 4.5]}
      onClick={(e) => {
        e.stopPropagation()
        if (dragClick.current) {
          dragClick.current = false
          return
        }
        const square = chooseSquare(e.intersections, targetMap) ?? { file, rank }
        onSquareClick(square.file, square.rank)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        onHoverSquare({ file, rank })
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <planeGeometry args={[0.96, 0.96]} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent={!marked}
        opacity={marked ? 0.92 : 0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function StackView({
  stack,
  file,
  rank,
  lib,
  targetMap,
  onClick,
  motion,
  motionRate,
  accent,
  skinId,
  canMove,
  onHoverSquare,
  onArmDrag,
  ghost = false,
  held = false,
  followPointer = false,
  grip,
  glide,
  onGlideDone,
  showCrests = false,
}: {
  stack: NonNullable<GameState['board'][number][number]>
  file: number
  rank: number
  lib: SpriteLibrary
  targetMap: Map<string, Target>
  onClick: (file: number, rank: number) => void
  motion: Motion
  motionRate: number
  accent: string
  skinId: string
  canMove: boolean
  onHoverSquare?: (square: { file: number; rank: number }) => void
  onArmDrag?: (file: number, rank: number, x: number, y: number) => void
  ghost?: boolean
  held?: boolean
  followPointer?: boolean
  grip?: { current: { x: number; z: number } }
  glide?: Glide
  onGlideDone?: () => void
  showCrests?: boolean
}) {
  const departs = carriedStack(stack).length
  const bodies = stackBodies(stack)
  const shown = held ? (departs === stack.length ? [] : bodies.slice(0, -1)) : bodies
  if (shown.length === 0) return null
  let lift = 0
  const spots = shown.flatMap((body) => {
    const head = body.pieces[body.pieces.length - 1]!
    const type = body.asType ?? head.type
    const pad = facingFrames(lib, type, head.color, body.fusion).south.footPad
    const stand = pieceStand(type, skinId, body.fusion ?? undefined, pad)
    const foot = lift
    lift += stand.seat * 1.15
    return [
      {
        key: head.id,
        type,
        fusion: body.fusion ?? undefined,
        color: head.color,
        x: 0,
        foot,
        size: stand.size,
        seat: stand.seat,
      },
    ]
  })
  return (
    <group>
      {spots.map((spot) => (
        <PieceMesh
          key={spot.key}
          fusion={spot.fusion}
          type={spot.type}
          color={spot.color}
          file={file}
          rank={rank}
          size={spot.size}
          seat={spot.seat}
          position={[file - 4.5 + spot.x, spot.foot, rank - 4.5]}
          lib={lib}
          targetMap={targetMap}
          onClick={onClick}
          motion={motion}
          motionRate={motionRate}
          accent={accent}
          canMove={canMove && !ghost && !held}
          onHoverSquare={onHoverSquare}
          onArmDrag={onArmDrag}
          ghost={ghost}
          followPointer={followPointer}
          grip={grip}
          glide={glide}
          onGlideDone={onGlideDone}
          showCrests={showCrests}
        />
      ))}
    </group>
  )
}

function PieceMesh({
  type,
  fusion,
  color,
  file,
  rank,
  size,
  seat,
  position,
  lib,
  targetMap,
  onClick,
  motion,
  motionRate,
  accent,
  canMove,
  onHoverSquare,
  onArmDrag,
  ghost = false,
  held = false,
  followPointer = false,
  grip,
  glide,
  onGlideDone,
  showCrests = false,
}: {
  type: PieceType
  fusion?: FusionId
  color: Color
  file: number
  rank: number
  size: number
  seat: number
  position: [number, number, number]
  lib: SpriteLibrary
  targetMap: Map<string, Target>
  onClick: (file: number, rank: number) => void
  motion: Motion
  motionRate: number
  accent: string
  canMove: boolean
  onHoverSquare?: (square: { file: number; rank: number }) => void
  onArmDrag?: (file: number, rank: number, x: number, y: number) => void
  ghost?: boolean
  held?: boolean
  followPointer?: boolean
  grip?: { current: { x: number; z: number } }
  glide?: Glide
  onGlideDone?: () => void
  showCrests?: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const hot = useRef(false)
  const yaw = color === 'white' ? 0 : Math.PI
  const frames = facingFrames(lib, type, color, fusion)
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2))
  const dragHit = useRef(new THREE.Vector3())
  const idle = useRef({
    ready: false,
    hot: false,
    held: false,
    px: 0,
    py: 0,
    pz: 0,
    x: 0,
    y: 0,
    z: 0,
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 0,
  })
  const floating = ghost || followPointer || held || !!glide
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.raycast = floating ? () => null : THREE.Mesh.prototype.raycast
  }, [floating])
  useFrame(({ camera, clock, raycaster, pointer }) => {
    const mesh = ref.current
    if (!mesh) return
    const calm = !followPointer && !glide && motion === 'none'
    if (calm) {
      const place = camera.position
      const turn = camera.quaternion
      const stamp = idle.current
      if (
        stamp.ready &&
        stamp.hot === hot.current &&
        stamp.held === held &&
        stamp.px === position[0] &&
        stamp.py === position[1] &&
        stamp.pz === position[2] &&
        stamp.x === place.x &&
        stamp.y === place.y &&
        stamp.z === place.z &&
        stamp.qx === turn.x &&
        stamp.qy === turn.y &&
        stamp.qz === turn.z &&
        stamp.qw === turn.w
      ) {
        return
      }
    }
    mesh.raycast = floating ? () => null : THREE.Mesh.prototype.raycast
    mesh.visible = !held
    let placeX = position[0]
    let placeY = position[1]
    let placeZ = position[2]
    let lift = ghost || followPointer ? 0.08 : 0
    if (followPointer) {
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(dragPlane.current, dragHit.current)) {
        placeX = dragHit.current.x + (position[0] - (file - 4.5))
        placeZ = dragHit.current.z + (position[2] - (rank - 4.5))
        placeY = position[1]
      }
      if (grip) grip.current = { x: placeX, z: placeZ }
      placeX += Math.sin(clock.elapsedTime * 28) * 0.05
      placeZ += Math.cos(clock.elapsedTime * 23) * 0.04
    }
    if (glide) {
      const u = Math.min(1, (performance.now() - glide.t0) / 180)
      const ease = 1 - (1 - u) * (1 - u)
      placeX = glide.x + (position[0] - glide.x) * ease
      placeZ = glide.z + (position[2] - glide.z) * ease
      lift = 0.08 * (1 - ease)
      if (u >= 1) onGlideDone?.()
    }
    const side = boardYaw(camera)
    const pitch = viewPitch(camera, placeX, placeY + seat, placeZ)
    applyPose(mesh, side, pitch)
    if (followPointer) mesh.rotation.z = Math.sin(clock.elapsedTime * 18) * 0.14
    const bob = ghost || followPointer || glide || motion === 'none' || motionRate === 0 ? 0 : Math.sin(clock.elapsedTime * motionRate + file + rank) * 0.07
    // Center stays on the square. The lean only slides the feet within that square.
    mesh.position.set(
      placeX + (motion === 'slide' ? bob : 0),
      placeY + lift + 0.02 + Math.cos(pitch) * seat + (motion === 'hop' ? Math.abs(bob) : 0),
      placeZ,
    )
    const index = facingIndex(yaw, Math.sin(side), Math.cos(side), 0, 0)
    const frame = frames[FACINGS[index]!]
    const mat = mesh.material as THREE.MeshBasicMaterial
    const map = hot.current && canMove ? hoverSilhouette(frame, accent) : frame.texture
    if (mat.map !== map) {
      mat.map = map
      mat.needsUpdate = true
    }
    if (calm) {
      const place = camera.position
      const turn = camera.quaternion
      const stamp = idle.current
      stamp.ready = true
      stamp.hot = hot.current
      stamp.held = held
      stamp.px = position[0]!
      stamp.py = position[1]!
      stamp.pz = position[2]!
      stamp.x = place.x
      stamp.y = place.y
      stamp.z = place.z
      stamp.qx = turn.x
      stamp.qy = turn.y
      stamp.qz = turn.z
      stamp.qw = turn.w
    } else {
      idle.current.ready = false
    }
  })
  return (
    <mesh
      ref={ref}
      position={[position[0], position[1] + size / 2, position[2]]}
      userData={{ file, rank, kind: ghost ? 'ghost' : 'piece' }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !canMove || ghost || held) return
        e.stopPropagation()
        onArmDrag?.(file, rank, e.nativeEvent.clientX, e.nativeEvent.clientY)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHoverSquare?.({ file, rank })
        if (!canMove || ghost) return
        hot.current = true
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        hot.current = false
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (dragClick.current) {
          dragClick.current = false
          return
        }
        const square = chooseSquare(e.intersections, targetMap) ?? { file, rank }
        onClick(square.file, square.rank)
      }}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={frames.south.texture}
        transparent
        opacity={ghost ? 0.45 : 1}
        alphaTest={ghost ? 0.05 : 0.2}
        depthWrite={!ghost}
        toneMapped={false}
      />
      {showCrests && (
        <mesh position={[0, 0, 0.08]} raycast={() => null}>
          <planeGeometry args={[0.98, 0.98]} />
          <meshBasicMaterial
            map={crestTexture(type, color, fusion)}
            transparent
            opacity={ghost ? 0.55 : 1}
            alphaTest={0.2}
            depthWrite={!ghost}
            toneMapped={false}
          />
        </mesh>
      )}
    </mesh>
  )
}

type Floater = { type: PieceType; color: Color; x: number; z: number; phase: number }

/** One hovering sheet per reserve piece, just past that side's camp edge. */
function reserveFloaters(reserve: Record<Color, PieceType[]>): Floater[] {
  const list: Floater[] = []
  for (const color of ['white', 'black'] as const) {
    const pieces = reserve[color]
    const z = color === 'white' ? -6.35 : 6.55
    const gap = pieces.length > 1 ? Math.min(1.35, 8 / (pieces.length - 1)) : 0
    const origin = -((pieces.length - 1) * gap) / 2
    pieces.forEach((type, i) => {
      list.push({
        type,
        color,
        x: origin + i * gap,
        z,
        phase: (i * 0.17 + (color === 'black' ? 0.41 : 0)) % 1,
      })
    })
  }
  return list
}

function ReserveFloaters({ lib, reserve }: { lib: SpriteLibrary; reserve: Record<Color, PieceType[]> }) {
  const items = reserveFloaters(reserve)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const layoutKey = items.map((item) => `${item.color}:${item.type}:${item.x.toFixed(2)}`).join('|')
  const group = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    group.current?.traverse((obj) => {
      obj.raycast = () => null
    })
  }, [layoutKey])
  useFrame(({ camera, clock }) => {
    const g = group.current
    const current = itemsRef.current
    if (!g) return
    const t = clock.elapsedTime
    current.forEach((item, i) => {
      const mesh = g.children[i] as THREE.Mesh | undefined
      if (!mesh) return
      const bob = Math.sin(t * 1.15 + item.phase * Math.PI * 2) * 0.16
      mesh.position.set(item.x, 1.45 + bob, item.z)
      mesh.lookAt(camera.position)
      mesh.rotateY(Math.PI)
      const frames = facingFrames(lib, item.type, item.color)
      const index = Math.floor(t * 2 + item.phase * 8) % 8
      const frame = frames[FACINGS[index]!]
      const mat = mesh.material as THREE.MeshBasicMaterial
      if (mat.map !== frame.texture) {
        mat.map = frame.texture
        mat.needsUpdate = true
      }
    })
  })
  if (items.length === 0) return null
  return (
    <group ref={group}>
      {items.map((item, i) => (
        <mesh key={`${item.color}-${i}-${item.type}`} raycast={() => null}>
          <planeGeometry args={[0.88, 0.88]} />
          <meshBasicMaterial
            map={facingFrames(lib, item.type, item.color).south.texture}
            transparent
            alphaTest={0.05}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function PixelBoard({ light, dark }: { light: string; dark: string }) {
  const map = useMemo(() => pixelBoardTexture(light, dark), [light, dark])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  )
}

function pixelBoardTexture(light: string, dark: string) {
  const cells = 4
  const canvas = document.createElement('canvas')
  canvas.width = 10 * cells
  canvas.height = 10 * cells
  const ctx = canvas.getContext('2d')!
  const lightRgb = hexRgb(light)
  const darkRgb = hexRgb(dark)
  const image = ctx.createImageData(canvas.width, canvas.height)
  const data = image.data
  for (let rank = 0; rank < 10; rank++) {
    for (let file = 0; file < 10; file++) {
      const base = (file + rank) % 2 === 1 ? darkRgb : lightRgb
      for (let py = 0; py < cells; py++) {
        for (let px = 0; px < cells; px++) {
          const n = ((file * 13 + rank * 7 + py * 3 + px * 5) * 17) % 11 - 5
          const x = file * cells + px
          const y = (9 - rank) * cells + py
          const i = (y * canvas.width + x) * 4
          data[i] = clampByte(base[0] + n)
          data[i + 1] = clampByte(base[1] + n)
          data[i + 2] = clampByte(base[2] + n)
          data[i + 3] = 255
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length < 6) return [200, 196, 188]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function mixWhite(hex: string, amount: number) {
  const [r, g, b] = hexRgb(hex)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function mixToward(from: string, to: string, amount: number) {
  const [r1, g1, b1] = hexRgb(from)
  const [r2, g2, b2] = hexRgb(to)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, n))
}

function Label({
  text,
  position,
  wide = false,
}: {
  text: string
  position: [number, number, number]
  wide?: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const texture = useRef<THREE.CanvasTexture | null>(null)
  const idle = useRef({ ready: false, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 0 })
  if (!texture.current) texture.current = makeLabel(text, wide)
  useFrame(({ camera }) => {
    const mesh = ref.current
    if (!mesh) return
    const place = camera.position
    const turn = camera.quaternion
    const stamp = idle.current
    if (
      stamp.ready &&
      stamp.x === place.x &&
      stamp.y === place.y &&
      stamp.z === place.z &&
      stamp.qx === turn.x &&
      stamp.qy === turn.y &&
      stamp.qz === turn.z &&
      stamp.qw === turn.w
    ) {
      return
    }
    const dx = place.x - mesh.position.x
    const dz = place.z - mesh.position.z
    const pitch = viewPitch(camera, mesh.position.x, mesh.position.y, mesh.position.z)
    applyPose(mesh, Math.atan2(dx, dz), pitch)
    stamp.ready = true
    stamp.x = place.x
    stamp.y = place.y
    stamp.z = place.z
    stamp.qx = turn.x
    stamp.qy = turn.y
    stamp.qz = turn.z
    stamp.qw = turn.w
  })
  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={wide ? [0.9, 0.24] : [0.38, 0.38]} />
      <meshBasicMaterial map={texture.current} transparent toneMapped={false} />
    </mesh>
  )
}

function makeLabel(text: string, wide: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = wide ? 256 : 64
  canvas.height = wide ? 64 : 64
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (wide) {
    ctx.fillStyle = '#f4f1ea'
    ctx.fillRect(8, 8, 240, 48)
    ctx.fillStyle = '#161616'
  } else {
    ctx.fillStyle = '#e8e4dc'
  }
  ctx.font = wide ? '26px Silkscreen, monospace' : '28px Silkscreen, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  return tex
}

function Coords() {
  const files = 'abcdefghij'.split('')
  return (
    <group>
      {files.map((letter, file) => (
        <Label key={letter} text={letter} position={[file - 4.5, 0.08, -5.4]} />
      ))}
      {Array.from({ length: 10 }, (_, rank) => (
        <Label key={rank} text={String(rank + 1)} position={[-5.5, 0.08, rank - 4.5]} />
      ))}
    </group>
  )
}
