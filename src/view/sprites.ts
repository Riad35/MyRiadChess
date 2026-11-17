import * as THREE from 'three'
import { carriedStack, effectiveMover, stackBadge, type Color, type PieceType, type Stack } from '../engine'
import { skinById } from '../lib/skins'

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

export type FusionId = 'doppelsoldat' | 'edler-ritter' | 'edler-drache' | 'doppelbishop' | 'doppelturm' | 'drachenritter'

const FUSION_FILE: Record<FusionId, string> = {
  doppelsoldat: 'doppelsoldat',
  'edler-ritter': 'edler-ritter',
  'edler-drache': 'edler-drache',
  doppelbishop: 'doppelbishop',
  doppelturm: 'doppelturm',
  drachenritter: 'drachenritter',
}

const FUSIONS = Object.keys(FUSION_FILE) as FusionId[]

/** Folder under /pieces for this figure. A skin override wins; otherwise the classic sheet. */
export function pieceSheet(skinId: string, type: PieceType): string {
  return skinById(skinId).sprites?.[type] ?? SPRITE_FILE[type]
}

/** Folder under /pieces for a fused pair. A skin override wins; otherwise the classic sheet. */
export function fusionSheet(skinId: string, fusion: FusionId): string {
  return skinById(skinId).fusions?.[fusion] ?? FUSION_FILE[fusion]
}

export type SpriteFrame = {
  texture: THREE.CanvasTexture
  id: string
  /** Fraction of this canvas below the opaque pixels, outline included. */
  footPad: number
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
  if (combo === 'double-drache') return 'edler-drache'
  if (combo === 'double-ritter') return 'edler-ritter'
  if (combo === 'double-bishop') return 'doppelbishop'
  if (combo === 'double-turm') return 'doppelturm'
  if (combo === 'drache-ritter') return 'drachenritter'
  if (stack.every((p) => p.type === 'Soldat')) return 'doppelsoldat'
  return null
}

export type StackBody = {
  pieces: Stack
  fusion: FusionId | null
  /** Draw this piece's frames. Turm+Bishop is a Dame. */
  asType?: PieceType
}

/** Bottom to top. A pair that stays together is one body; the piece on top is another. */
export function stackBodies(stack: Stack): StackBody[] {
  const carry = carriedStack(stack)
  const remain = stack.slice(0, stack.length - carry.length)
  return [...bodiesFor(remain), ...bodiesFor(carry)]
}

function bodiesFor(part: Stack): StackBody[] {
  if (part.length === 0) return []
  if (part.length === 2 && effectiveMover(part).combo === 'bishop-turm') {
    return [{ pieces: part, fusion: null, asType: 'Dame' }]
  }
  const fusion = part.length >= 2 ? fusionIdFor(part) : null
  if (fusion) return [{ pieces: part, fusion }]
  if (part.length === 2 && stackBadge(part).fused) return [{ pieces: part, fusion: null }]
  return part.map((piece) => ({ pieces: [piece], fusion: null }))
}

export function facingFrames(lib: SpriteLibrary, type: PieceType, color: Color, fusion?: FusionId | null): FacingSet {
  if (fusion) return lib.fusions[fusion][color]
  return lib.pieces[type][color]
}

const libraries = new Map<string, Promise<SpriteLibrary>>()

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

export function loadSpriteLibrary(skinId = 'classic'): Promise<SpriteLibrary> {
  const id = skinById(skinId).id
  let pending = libraries.get(id)
  if (!pending) {
    pending = buildLibrary(id)
    libraries.set(id, pending)
  }
  return pending
}

async function buildLibrary(skinId: string): Promise<SpriteLibrary> {
  const lib: SpriteLibrary = { pieces: {} as SpriteLibrary['pieces'], fusions: {} as SpriteLibrary['fusions'] }
  await Promise.all([
    ...PIECES.map(async (type) => {
      lib.pieces[type] = { white: {} as FacingSet, black: {} as FacingSet }
      await loadSet(pieceSheet(skinId, type), lib.pieces[type])
    }),
    ...FUSIONS.map(async (fusion) => {
      lib.fusions[fusion] = { white: {} as FacingSet, black: {} as FacingSet }
      await loadSet(fusionSheet(skinId, fusion), lib.fusions[fusion])
    }),
  ])
  return lib
}

async function loadSet(folder: string, into: Record<Color, FacingSet>) {
  await Promise.all(
    COLORS.map(async (color) => {
      await Promise.all(
        FACINGS.map(async (facing) => {
          const img = await loadImage(`/pieces/${folder}/${facing}.png`)
          const canvas = keyAndTint(img, color)
          const texture = new THREE.CanvasTexture(canvas)
          texture.magFilter = THREE.NearestFilter
          texture.minFilter = THREE.NearestFilter
          texture.colorSpace = THREE.SRGBColorSpace
          texture.needsUpdate = true
          into[color][facing] = {
            texture,
            id: `${folder}|${color}|${facing}`,
            footPad: measureFootPad(canvas),
          }
        }),
      )
    }),
  )
}

const iconUrls = new Map<string, Promise<string>>()

/** A blob URL for an `<img>`, created the first time that icon is shown. */
export function frameIconUrl(frame: SpriteFrame): Promise<string> {
  const cached = iconUrls.get(frame.id)
  if (cached) return cached
  const canvas = frame.texture.image as HTMLCanvasElement
  const pending = new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`sprite blob ${frame.id}`))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
  iconUrls.set(frame.id, pending)
  return pending
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
  const key = `${frame.id}|${accent}|3`
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

const RIM = 3

function keyAndTint(img: HTMLImageElement, color: Color): HTMLCanvasElement {
  const source = document.createElement('canvas')
  source.width = img.width
  source.height = img.height
  const srcCtx = source.getContext('2d')!
  srcCtx.drawImage(img, 0, 0)
  const image = srcCtx.getImageData(0, 0, source.width, source.height)
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
  // Bright paint (the bishop's cream) stays light. Darker ink is the negative,
  // lifted into the whites so a gold king reads white and the lines stay the brightest.
  const brightSheet = lumCount > 0 && lumSum / lumCount > 165
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const lum = (px[i]! + px[i + 1]! + px[i + 2]!) / 3
    const v =
      color === 'white'
        ? lum < 165
          ? Math.round(Math.min(255, 255 - lum * 0.38))
          : Math.round(Math.min(255, 198 + lum * 0.22))
        : brightSheet
          ? Math.round(lum * 0.28 + 12)
          : Math.round(lum * 0.7 + 18)
    px[i] = v
    px[i + 1] = v
    px[i + 2] = color === 'black' ? Math.min(255, v + 8) : v
  }
  srcCtx.putImageData(image, 0, 0)

  const canvas = document.createElement('canvas')
  canvas.width = source.width + RIM * 2
  canvas.height = source.height + RIM * 2
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, RIM, RIM)
  const framed = ctx.getImageData(0, 0, canvas.width, canvas.height)
  outline(framed.data, canvas.width, canvas.height)
  ctx.putImageData(framed, 0, 0)
  return canvas
}

/** 1px white against the figure, then 2px black outside that. */
function outline(px: Uint8ClampedArray, w: number, h: number) {
  const src = new Uint8ClampedArray(px)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (src[i + 3]! > 40) continue
      let nearest = RIM + 1
      for (let dy = -RIM; dy <= RIM; dy++) {
        for (let dx = -RIM; dx <= RIM; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy))
          if (dist === 0 || dist >= nearest) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (src[(ny * w + nx) * 4 + 3]! > 80) nearest = dist
        }
      }
      if (nearest > RIM) continue
      const black = nearest > 1
      const v = black ? 0 : 255
      px[i] = v
      px[i + 1] = v
      px[i + 2] = v
      px[i + 3] = 255
    }
  }
}

function measureFootPad(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d')!
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let last = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 40) {
        last = y
        break
      }
    }
  }
  if (last < 0) return 0.12
  return (height - 1 - last) / height
}
