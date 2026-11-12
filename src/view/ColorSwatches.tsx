/** Bright neon accents, plus one deep black. Nothing muted in between. */
export const ACCENT_SWATCHES = [
  '#ff2a2a',
  '#ff6a00',
  '#ffe600',
  '#b6ff00',
  '#39ff14',
  '#00ffc8',
  '#00e7ff',
  '#3d7eff',
  '#b026ff',
  '#ff00e6',
  '#ff4fd8',
  '#000000',
]

export function hexLightness(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 50
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return Math.round((((r + g + b) / 3) / 255) * 100)
}

export function liftAccent(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#f7f4ee'
  const mix = (i: number) =>
    Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) + (255 - parseInt(h.slice(i, i + 2), 16)) * 0.45))
      .toString(16)
      .padStart(2, '0')
  return `#${mix(0)}${mix(2)}${mix(4)}`
}

export function lightnessToHex(light: number): string {
  const v = Math.round((Math.min(100, Math.max(0, light)) / 100) * 255)
  const h = v.toString(16).padStart(2, '0')
  return `#${h}${h}${h}`
}

export function ColorSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="swatch-grid" role="listbox" aria-label="Accent color">
      {ACCENT_SWATCHES.map((hex) => (
        <button
          key={hex}
          type="button"
          className={value.toLowerCase() === hex ? 'swatch active' : 'swatch'}
          style={{ background: hex }}
          aria-label={hex}
          aria-selected={value.toLowerCase() === hex}
          onClick={() => onChange(hex)}
        />
      ))}
    </div>
  )
}
