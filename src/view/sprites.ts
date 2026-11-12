import * as THREE from 'three'
import { effectiveMover, type Color, type PieceType, type Stack } from '../engine'

export const FACINGS = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
] as const

export type Facing = (typeof FACINGS)[number]

const SPRITE_FILE: Record<PieceType, string> = {
  König: 'koenig',
  Dame: 'dame',
  Turm: 'turm',
  Bishop: 'bishop',
  Ritter: 'ritter',
  Drache: 'drache',
  Soldat: 'soldat',
}

export type FusionId = 'viking' | 'bishop-tower' | 'noble-knight' | 'elder-dragon'

const FUSION_FILE: Record<FusionId, string> = {
  viking: 'viking',
  'bishop-tower': 'bishop-tower',
  'noble-knight': 'noble-knight',
  'elder-dragon': 'elder-dragon',
}

const FUSIONS: FusionId[] = ['viking', 'bishop-tower', 'noble-knight', 'elder-dragon']

export type SpriteFrame = {
  texture: THREE.CanvasTexture
  url: string
}

export type FacingSet = Record<Facing, SpriteFrame>

export type SpriteLibrary = {
  pieces: Record<PieceType, Record<Color, FacingSet>>
  fusions: Record<FusionId, Record<Color, FacingSet>>
}

const PIECES: PieceType[] = ['König', 'Dame', 'Turm', 'Bishop', 'Ritter', 'Drache', 'Soldat']
const COLORS: Color[] = ['white', 'black']

/** One sprite when two identical pieces share a square. */
export function fusionIdFor(stack: Stack): FusionId | null {
  if (stack.length !== 2) return null
  const { combo } = effectiveMover(stack)
  if (combo === 'bishop-turm') return 'bishop-tower'
  if (combo === 'double-drache') return 'elder-dragon'
  if (combo === 'double-ritter') return 'noble-knight'
  if (stack.every((p) => p.type === 'Soldat')) return 'viking'
  return null
}

let loading: Promise<SpriteLibrary> | null = null

/**
 * 0 = camera is in front of the piece (south.png, the face).
 * White faces north, black faces south, so the two sides look at each other.
 * The turn is measured from the piece toward the camera, so a side view shows
 * the profile that points across the board.
 */
export function facingIndex(pieceYaw: number, camX: number, camZ: number, pieceX: number, pieceZ: number): number {
  const camAngle = Math.atan2(camX - pieceX, camZ - pieceZ)
  const rel = Math.atan2(Math.sin(pieceYaw - camAngle), Math.cos(pieceYaw - camAngle))
  const turned = (rel + Math.PI * 2) % (Math.PI * 2)
  return Math.round(turned / (Math.PI / 4)) % 8
}

export function loadSpriteLibrary(): Promise<SpriteLibrary> {
  if (!loading) loading = buildLibrary()
  return loading
}

async function buildLibrary(): Promise<SpriteLibrary> {
  const lib: SpriteLibrary = { pieces: {} as SpriteLibrary['pieces'], fusions: {} as SpriteLibrary['fusions'] }
  await Promise.all([
    ...PIECES.map(async (type) => {
      lib.pieces[type] = { white: {} as FacingSet, black: {} as FacingSet }
      await loadSet(SPRITE_FILE[type], lib.pieces[type], type === 'König')
    }),
    ...FUSIONS.map(async (id) => {
      lib.fusions[id] = { white: {} as FacingSet, black: {} as FacingSet }
      await loadSet(FUSION_FILE[id], lib.fusions[id])
    }),
  ])
  return lib
}

async function loadSet(folder: string, into: Record<Color, FacingSet>, kingRim = false) {
  await Promise.all(
    COLORS.map(async (color) => {
      await Promise.all(
        FACINGS.map(async (facing) => {
          const img = await loadImage(`/pieces/${folder}/${facing}.png`)
          const canvas = keyAndTint(img, color, kingRim)
          const texture = new THREE.CanvasTexture(canvas)
          texture.magFilter = THREE.NearestFilter
          texture.minFilter = THREE.NearestFilter
          texture.colorSpace = THREE.SRGBColorSpace
          texture.needsUpdate = true
          into[color][facing] = { texture, url: canvas.toDataURL() }
        }),
      )
    }),
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Missing sprite ${src}`))
    img.src = src
  })
}

const silhouetteCache = new Map<string, THREE.CanvasTexture>()

/** Three-pixel accent rim around a sprite. The figure itself stays unchanged. */
export function hoverSilhouette(frame: SpriteFrame, accent: string): THREE.Texture {
  const key = `${frame.url}|${accent}|3`
  const cached = silhouetteCache.get(key)
  if (cached) return cached
  const source = frame.texture.image as HTMLCanvasElement
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const src = new Uint8ClampedArray(image.data)
  const px = image.data
  const [ar, ag, ab] = hexBytes(accent)
  const w = canvas.width
  const h = canvas.height
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (src[i + 3]! > 30) continue
      let touch = false
      for (let dy = -3; dy <= 3 && !touch; dy++) {
        for (let dx = -3; dx <= 3 && !touch; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 3 || (dx === 0 && dy === 0)) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (src[(ny * w + nx) * 4 + 3]! > 80) touch = true
        }
      }
      if (!touch) continue
      px[i] = ar
      px[i + 1] = ag
      px[i + 2] = ab
      px[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  silhouetteCache.set(key, texture)
  return texture
}

function hexBytes(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length < 6) return [216, 212, 204]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function keyAndTint(img: HTMLImageElement, color: Color, kingRim = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = image.data
  let lumSum = 0
  let lumCount = 0
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!
    const g = px[i + 1]!
    const b = px[i + 2]!
    const max = Math.max(r, g, b)
    if (max < 16) {
      px[i + 3] = 0
      continue
    }
    if (max < 36) px[i + 3] = Math.round(((max - 16) / 20) * px[i + 3]!)
    if (px[i + 3]! > 40) {
      lumSum += (r + g + b) / 3
      lumCount += 1
    }
  }
  const lightArt = lumCount > 0 && lumSum / lumCount > 120
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const lum = (px[i]! + px[i + 1]! + px[i + 2]!) / 3
    const v = lightArt
      ? color === 'white'
        ? Math.round(Math.min(255, lum * 0.92 + 18))
        : Math.round(lum * 0.28 + 12)
      : color === 'white'
        ? Math.round(255 - lum * 0.82)
        : Math.round(lum * 0.7 + 18)
    px[i] = v
    px[i + 1] = v
    px[i + 2] = color === 'black' ? Math.min(255, v + 8) : v
  }
  outline(px, canvas.width, canvas.height, kingRim)
  ctx.putImageData(image, 0, 0)
  return canvas
}

function outline(px: Uint8ClampedArray, w: number, h: number, kingRim: boolean) {
  const src = new Uint8ClampedArray(px)
  const reach = kingRim ? 2 : 1
  const white = kingRim ? 255 : 236
  const alpha = kingRim ? 255 : 230
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (src[i + 3]! > 40) continue
      let touch = false
      for (let dy = -reach; dy <= reach && !touch; dy++) {
        for (let dx = -reach; dx <= reach && !touch; dx++) {
          if (dx === 0 && dy === 0) continue
          if (Math.abs(dx) + Math.abs(dy) > reach + (kingRim ? 1 : 0)) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (src[(ny * w + nx) * 4 + 3]! > 90) touch = true
        }
      }
      if (!touch) continue
      px[i] = white
      px[i + 1] = white
      px[i + 2] = white
      px[i + 3] = alpha
    }
  }
}
