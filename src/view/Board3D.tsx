import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { Color, GameState, PieceType } from '../engine'
import { carriedStack, soldierBaseRank, stackBadge } from '../engine'
import {
  FACINGS,
  facingFrames,
  facingIndex,
  hoverSilhouette,
  loadSpriteLibrary,
  stackBodies,
  type FusionId,
  type SpriteLibrary,
} from './sprites'

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
  showCoords: boolean
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
  onDragEnd: (square: { file: number; rank: number } | null) => void
  onSquareClick: (file: number, rank: number) => void
}

export function Board3D(props: BoardProps) {
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
}

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

function Scene(props: BoardProps) {
  const [lib, setLib] = useState<SpriteLibrary | null>(null)
  const armed = useRef<{ x: number; y: number; file: number; rank: number; started: boolean } | null>(null)
  const hoverRef = useRef<{ file: number; rank: number } | null>(null)
  const onHover = (square: { file: number; rank: number } | null) => {
    hoverRef.current = square
    props.onHoverSquare(square)
  }
  const armDrag = (file: number, rank: number, x: number, y: number) => {
    armed.current = { x, y, file, rank, started: false }
  }
  useEffect(() => {
    let live = true
    loadSpriteLibrary().then((next) => {
      if (live) setLib(next)
    })
    return () => {
      live = false
    }
  }, [])

  const heldStack =
    props.dragging && props.state.board[props.dragging.file]?.[props.dragging.rank]
      ? props.state.board[props.dragging.file]![props.dragging.rank]
      : null
  const heldCarry = heldStack ? carriedStack(heldStack) : null
  return (
    <>
      <DragSession armed={armed} hoverRef={hoverRef} onDragStart={props.onDragStart} onDragEnd={props.onDragEnd} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[11.2, 11.2]} />
        <meshBasicMaterial color="#111111" toneMapped={false} />
      </mesh>
      <PixelBoard light={props.light} dark={props.dark} />
      {Array.from({ length: 10 }, (_, file) =>
        Array.from({ length: 10 }, (_, rank) => {
          const key = `${file},${rank}`
          const target = props.targetMap.get(key)
          return (
            <Tile
              key={key}
              file={file}
              rank={rank}
              targetMap={props.targetMap}
              marked={tileMarked({
                selected: props.selected?.file === file && props.selected.rank === rank,
                kind: target?.kind,
                placeable: props.setupSquares.has(key),
                doubleMark:
                  props.state.phase === 'setup-doubles' &&
                  rank === soldierBaseRank(props.chooser, file) &&
                  props.doubleFiles.includes(file),
                check: props.checkSquare?.file === file && props.checkSquare.rank === rank,
              })}
              color={tileColor({
                dark: (file + rank) % 2 === 1,
                light: props.light,
                darkColor: props.dark,
                accent: props.accent,
                selected: props.selected?.file === file && props.selected.rank === rank,
                kind: target?.kind,
                placeable: props.setupSquares.has(key),
                doubleMark:
                  props.state.phase === 'setup-doubles' &&
                  rank === soldierBaseRank(props.chooser, file) &&
                  props.doubleFiles.includes(file),
                check: props.checkSquare?.file === file && props.checkSquare.rank === rank,
              })}
              onSquareClick={props.onSquareClick}
              onHoverSquare={onHover}
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
                    canMove={props.movable.has(`${file},${rank}`)}
                    onHoverSquare={onHover}
                    onArmDrag={armDrag}
                    held={props.dragging?.file === file && props.dragging.rank === rank}
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
          canMove={false}
          ghost
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
          canMove={false}
          followPointer
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
  'bishop-tower': 0.125,
  dame: 0.177,
  drache: 0.167,
  'double-turm': 0.125,
  'elder-dragon': 0.073,
  koenig: 0.073,
  'noble-knight': 0.094,
  pope: 0.073,
  ritter: 0.115,
  soldat: 0.208,
  turm: 0.094,
  viking: 0.125,
}

const SPRITE_KEY: Record<PieceType, string> = {
  König: 'koenig',
  Dame: 'dame',
  Turm: 'turm',
  Bishop: 'bishop',
  Ritter: 'ritter',
  Drache: 'drache',
  Soldat: 'soldat',
}

/** One card per square. `seat` is how far the feet sit below the card center. */
function pieceStand(type: PieceType, fusion?: FusionId) {
  const key = fusion === 'bishop-tower' ? 'dame' : (fusion ?? SPRITE_KEY[type])
  const pad = FOOT_PAD[key] ?? 0.12
  return { size: PIECE_SIZE, seat: PIECE_SIZE * (0.5 - pad) }
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
  check: boolean
}) {
  return opts.check || opts.selected || !!opts.kind || opts.placeable || opts.doubleMark
}

function tileColor(opts: {
  dark: boolean
  light: string
  darkColor: string
  accent: string
  selected: boolean
  kind?: string
  placeable: boolean
  doubleMark: boolean
  check: boolean
}) {
  if (opts.check) return '#ffffff'
  if (opts.selected) return opts.accent
  if (opts.kind === 'capture' || opts.kind === 'split') return '#2e2e2e'
  if (opts.kind) return mixWhite(opts.accent, 0.5)
  if (opts.placeable) return mixWhite(opts.accent, 0.35)
  if (opts.doubleMark) return opts.dark ? '#5e5b57' : '#d5d0c6'
  return opts.dark ? opts.darkColor : opts.light
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

function Tile({
  file,
  rank,
  color,
  marked,
  onSquareClick,
  onHoverSquare,
  targetMap,
}: {
  file: number
  rank: number
  color: string
  marked: boolean
  onSquareClick: (file: number, rank: number) => void
  onHoverSquare: (square: { file: number; rank: number }) => void
  targetMap: Map<string, Target>
}) {
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
  canMove,
  onHoverSquare,
  onArmDrag,
  ghost = false,
  held = false,
  followPointer = false,
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
  canMove: boolean
  onHoverSquare?: (square: { file: number; rank: number }) => void
  onArmDrag?: (file: number, rank: number, x: number, y: number) => void
  ghost?: boolean
  held?: boolean
  followPointer?: boolean
}) {
  const departs = carriedStack(stack).length
  const bodies = stackBodies(stack)
  const shown = held ? (departs === stack.length ? [] : bodies.slice(0, -1)) : bodies
  if (shown.length === 0) return null
  let lift = 0
  const spots = shown.flatMap((body) => {
    const paired = !body.fusion && !body.asType && body.pieces.length === 2
    if (paired) {
      const seats = body.pieces.map((piece) => pieceStand(piece.type))
      const foot = lift
      lift += Math.max(...seats.map((seat) => seat.seat)) * 1.15
      return body.pieces.map((piece, i) => ({
        key: piece.id,
        type: piece.type,
        fusion: undefined as FusionId | undefined,
        color: piece.color,
        x: i === 0 ? -0.16 : 0.16,
        foot,
        size: seats[i]!.size,
        seat: seats[i]!.seat,
      }))
    }
    const head = body.pieces[body.pieces.length - 1]!
    const type = body.asType ?? head.type
    const stand = pieceStand(type, body.fusion ?? undefined)
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
  const lone = shown.length === 1 ? shown[0] : null
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
        />
      ))}
      {lone && !lone.fusion && !lone.asType && lone.pieces.length === 2 && !ghost && (
        <Label text={stackBadge(lone.pieces).title} position={[file - 4.5, 0.2, rank - 4.5 - 0.9]} wide />
      )}
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
}) {
  const ref = useRef<THREE.Mesh>(null)
  const hot = useRef(false)
  const yaw = color === 'white' ? 0 : Math.PI
  const frames = facingFrames(lib, type, color, fusion)
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2))
  const dragHit = useRef(new THREE.Vector3())
  useLayoutEffect(() => {
    const mesh = ref.current
    if (mesh && (ghost || followPointer || held)) mesh.raycast = () => null
  }, [ghost, followPointer, held])
  useFrame(({ camera, clock, raycaster, pointer }) => {
    const mesh = ref.current
    if (!mesh) return
    if (ghost || followPointer || held) mesh.raycast = () => null
    mesh.visible = !held
    let placeX = position[0]
    let placeY = position[1]
    let placeZ = position[2]
    if (followPointer) {
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(dragPlane.current, dragHit.current)) {
        placeX = dragHit.current.x + (position[0] - (file - 4.5))
        placeZ = dragHit.current.z + (position[2] - (rank - 4.5))
        placeY = position[1]
      }
    }
    const side = boardYaw(camera)
    const pitch = viewPitch(camera, placeX, placeY + seat, placeZ)
    applyPose(mesh, side, pitch)
    const bob = ghost || followPointer || motion === 'none' || motionRate === 0 ? 0 : Math.sin(clock.elapsedTime * motionRate + file + rank) * 0.07
    // Center stays on the square. The lean only slides the feet within that square.
    mesh.position.set(
      placeX + (motion === 'slide' ? bob : 0),
      placeY + (ghost || followPointer ? 0.08 : 0) + 0.02 + Math.cos(pitch) * seat + (motion === 'hop' ? Math.abs(bob) : 0),
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
    </mesh>
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
  if (!texture.current) texture.current = makeLabel(text, wide)
  useFrame(({ camera }) => {
    const mesh = ref.current
    if (!mesh) return
    const dx = camera.position.x - mesh.position.x
    const dz = camera.position.z - mesh.position.z
    const pitch = viewPitch(camera, mesh.position.x, mesh.position.y, mesh.position.z)
    applyPose(mesh, Math.atan2(dx, dz), pitch)
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
