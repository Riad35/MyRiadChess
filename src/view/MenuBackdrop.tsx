import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Color, PieceType } from '../engine'
import { FACINGS, facingFrames, loadSpriteLibrary, type SpriteLibrary } from './sprites'

const FALLERS: { type: PieceType; color: Color; x: number; speed: number; phase: number }[] = [
  { type: 'Ritter', color: 'white', x: -7.6, speed: 0.035, phase: 0 },
  { type: 'Soldat', color: 'black', x: -6.4, speed: 0.05, phase: 0.42 },
  { type: 'Dame', color: 'white', x: 6.5, speed: 0.028, phase: 0.18 },
  { type: 'Turm', color: 'black', x: 7.7, speed: 0.042, phase: 0.73 },
  { type: 'Drache', color: 'white', x: -8.3, speed: 0.033, phase: 0.55 },
  { type: 'Bishop', color: 'black', x: 8.5, speed: 0.046, phase: 0.12 },
  { type: 'König', color: 'white', x: 6.2, speed: 0.03, phase: 0.86 },
  { type: 'Soldat', color: 'white', x: -6.9, speed: 0.055, phase: 0.31 },
]

/** Falling, turning piece sheets behind the main menu. */
export function MenuBackdrop({ skinId }: { skinId: string }) {
  return (
    <div className="menu-backdrop" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 14], fov: 42, near: 0.1, far: 40 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Fallers skinId={skinId} />
      </Canvas>
    </div>
  )
}

function Fallers({ skinId }: { skinId: string }) {
  const [lib, setLib] = useState<SpriteLibrary | null>(null)
  useEffect(() => {
    let live = true
    loadSpriteLibrary(skinId).then((next) => {
      if (live) setLib(next)
    })
    return () => {
      live = false
    }
  }, [skinId])
  if (!lib) return null
  return <FallerSheets lib={lib} />
}

function FallerSheets({ lib }: { lib: SpriteLibrary }) {
  const group = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    group.current?.traverse((obj) => {
      obj.raycast = () => null
    })
  }, [lib])
  useFrame(({ camera, clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    FALLERS.forEach((item, i) => {
      const mesh = g.children[i] as THREE.Mesh | undefined
      if (!mesh) return
      const u = (t * item.speed + item.phase) % 1
      mesh.position.set(item.x, 5.4 - u * 11.2, (i - 3.5) * 0.12)
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
  return (
    <group ref={group}>
      {FALLERS.map((item) => (
        <mesh key={`${item.type}-${item.color}-${item.x}`} raycast={() => null}>
          <planeGeometry args={[2.1, 2.1]} />
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
