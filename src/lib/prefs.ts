import type { Color, PieceType, TimeControlId } from '../engine/types'
import { ACCENT_SWATCHES } from '../view/ColorSwatches'

export type AmbientFx = 'off' | 'lightning' | 'scan' | 'sparks' | 'glitch'
export type AnimSpeed = 'off' | 'fast' | 'normal'

export interface AppSettings {
  boardLight: string
  boardDark: string
  accent: string
  showCoords: boolean
  showLegalDots: boolean
  showPhaseBanners: boolean
  soundEnabled: boolean
  musicVolume: number
  animationSpeed: AnimSpeed
  timeControlDefault: TimeControlId
  ambientFx: AmbientFx
  introEnabled: boolean
  playerName: string
  skinId: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardLight: '#ebe6dc',
  boardDark: '#7a756e',
  accent: '#39ff14',
  showCoords: true,
  showLegalDots: true,
  showPhaseBanners: true,
  soundEnabled: true,
  musicVolume: 0.6,
  animationSpeed: 'normal',
  timeControlDefault: '10+5',
  ambientFx: 'lightning',
  introEnabled: true,
  playerName: 'Player',
  skinId: 'classic',
}

const SETTINGS_KEY = 'schach2.settings.v3'
const LEGACY_SETTINGS_KEY = 'schach2.settings.v2'
const COMPOSITIONS_KEY = 'schach2.compositions.v1'

const PIECE_ALIAS: Record<string, PieceType> = {
  Volk: 'König',
  Jugend: 'Dame',
  Tower: 'Turm',
  Schütze: 'Bishop',
  Kavallerie: 'Ritter',
  Infanterie: 'Drache',
  Soldat: 'Soldat',
  König: 'König',
  Dame: 'Dame',
  Turm: 'Turm',
  Bishop: 'Bishop',
  Ritter: 'Ritter',
  Drache: 'Drache',
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(LEGACY_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const merged = { ...DEFAULT_SETTINGS, ...parsed }
    const accent = ACCENT_SWATCHES.find((hex) => hex.toLowerCase() === merged.accent.toLowerCase())
    return { ...merged, accent: accent ?? DEFAULT_SETTINGS.accent }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

/** One side's preset strategy (doubles + main placements). */
export interface SavedComposition {
  id: string
  name: string
  side: Color
  /** 5 files for double soldaten */
  doubleFiles: number[]
  /** Main pieces to place: algebraic-ish file/rank + type */
  placements: { file: number; rank: number; type: PieceType }[]
  createdAt: number
}

function migrateComposition(raw: SavedComposition): SavedComposition {
  return {
    ...raw,
    placements: raw.placements.map((p) => ({
      ...p,
      type: PIECE_ALIAS[p.type] ?? 'Soldat',
    })),
  }
}

export function loadCompositions(): SavedComposition[] {
  try {
    const raw = localStorage.getItem(COMPOSITIONS_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as SavedComposition[]).map(migrateComposition)
  } catch {
    return []
  }
}

export function saveCompositions(list: SavedComposition[]): void {
  localStorage.setItem(COMPOSITIONS_KEY, JSON.stringify(list))
}

export function upsertComposition(c: SavedComposition): SavedComposition[] {
  const list = loadCompositions().filter((x) => x.id !== c.id)
  list.unshift(c)
  saveCompositions(list)
  return list
}

export function deleteComposition(id: string): SavedComposition[] {
  const list = loadCompositions().filter((x) => x.id !== id)
  saveCompositions(list)
  return list
}
