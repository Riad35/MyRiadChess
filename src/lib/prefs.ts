import type { Color, PieceType, TimeControlId } from '../engine/types'

export interface AppSettings {
  boardLight: string
  boardDark: string
  accent: string
  pieceWhite: string
  pieceBlack: string
  showCoords: boolean
  showLegalDots: boolean
  showPhaseBanners: boolean
  soundEnabled: boolean
  animationSpeed: 'off' | 'fast' | 'normal'
  timeControlDefault: TimeControlId
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardLight: '#d7e0c4',
  boardDark: '#3f5a38',
  accent: '#d4b56a',
  pieceWhite: '#f6f3ea',
  pieceBlack: '#1c1c1c',
  showCoords: true,
  showLegalDots: true,
  showPhaseBanners: true,
  soundEnabled: true,
  animationSpeed: 'normal',
  timeControlDefault: '10+5',
}

const SETTINGS_KEY = 'schach2.settings.v1'
const COMPOSITIONS_KEY = 'schach2.compositions.v1'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
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

export function loadCompositions(): SavedComposition[] {
  try {
    const raw = localStorage.getItem(COMPOSITIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedComposition[]
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
