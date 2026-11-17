import * as THREE from 'three'
import type { Color, PieceType } from '../engine'
import type { FusionId } from './sprites'

const SIZE = 32
const cache = new Map<string, THREE.CanvasTexture>()

const GLYPH: Record<string, string[]> = {
  König: [
    '..#.#.#..',
    '.#..#..#.',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '.........',
    '.........',
  ],
  Dame: [
    '....#....',
    '...###...',
    '....#....',
    '..#####..',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '.........',
  ],
  Turm: [
    '#.#.#.#.#',
    '#########',
    '.#######.',
    '.#######.',
    '.#######.',
    '.#######.',
    '#########',
    '.........',
    '.........',
  ],
  Bishop: [
    '....#....',
    '...###...',
    '..#.#.#..',
    '...###...',
    '..#####..',
    '...###...',
    '....#....',
    '...###...',
    '.........',
  ],
  Ritter: [
    '....##...',
    '...####..',
    '..##.##..',
    '.####....',
    '######...',
    '.#####...',
    '..###.#..',
    '...#.#...',
    '.........',
  ],
  Drache: [
    '##.......',
    '.####....',
    '..######.',
    '...####.#',
    '....####.',
    '.....##..',
    '......#..',
    '....##...',
    '.........',
  ],
  Soldat: [
    '.........',
    '...###...',
    '...###...',
    '....#....',
    '..#####..',
    '..#####..',
    '.........',
    '.........',
    '.........',
  ],
  doppelsoldat: [
    '..##..##.',
    '..##..##.',
    '...#..#..',
    '.########',
    '.########',
    '.........',
    '.........',
    '.........',
    '.........',
  ],
  'edler-ritter': [
    '.#.#.#...',
    '..####...',
    '.##.##...',
    '#####....',
    '######...',
    '.#####...',
    '..###.#..',
    '...#.#...',
    '.........',
  ],
  'edler-drache': [
    '##...#...',
    '.####.#..',
    '..######.',
    '...####.#',
    '....####.',
    '.....##..',
    '......#..',
    '....##...',
    '.........',
  ],
  doppelbishop: [
    '..#...#..',
    '.###.###.',
    '.#.#.#.#.',
    '..#...#..',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '.........',
  ],
  doppelturm: [
    '#.#...#.#',
    '###...###',
    '.#.....#.',
    '.#.....#.',
    '.#.....#.',
    '#########',
    '#########',
    '.........',
    '.........',
  ],
  drachenritter: [
    '##..##...',
    '.####.#..',
    '######...',
    '.#####...',
    '..####...',
    '...##.#..',
    '....#.#..',
    '.........',
    '.........',
  ],
}

/** Round pixel badge for the figure that is actually drawn. */
export function crestTexture(type: PieceType, color: Color, fusion?: FusionId): THREE.Texture {
  const key = `${fusion ?? type}|${color}`
  const cached = cache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(SIZE, SIZE)
  const px = image.data
  const light = color === 'white'
  const fill = light ? [244, 241, 234] : [22, 22, 22]
  const ink = light ? [22, 22, 22] : [244, 241, 234]
  const cx = (SIZE - 1) / 2
  const cy = (SIZE - 1) / 2
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.hypot(x - cx, y - cy)
      const i = (y * SIZE + x) * 4
      if (dist > 15.2) continue
      const rgb = dist > 13.2 ? [0, 0, 0] : dist > 12.2 ? [255, 255, 255] : fill
      px[i] = rgb[0]!
      px[i + 1] = rgb[1]!
      px[i + 2] = rgb[2]!
      px[i + 3] = 255
    }
  }
  const glyph = GLYPH[fusion ?? type] ?? GLYPH[type]!
  const scale = 2
  const rows = glyph.length
  const cols = glyph[0]!.length
  const ox = Math.floor((SIZE - cols * scale) / 2)
  const oy = Math.floor((SIZE - rows * scale) / 2)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (glyph[y]![x] !== '#') continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((oy + y * scale + dy) * SIZE + (ox + x * scale + dx)) * 4
          if (px[i + 3] === 0) continue
          px[i] = ink[0]!
          px[i + 1] = ink[1]!
          px[i + 2] = ink[2]!
          px[i + 3] = 255
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  cache.set(key, texture)
  return texture
}
