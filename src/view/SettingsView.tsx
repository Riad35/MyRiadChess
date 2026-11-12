import { useState } from 'react'
import type { TimeControlId } from '../engine'
import type { AmbientFx, AppSettings } from '../lib/prefs'
import { DEFAULT_SETTINGS } from '../lib/prefs'
import { AmbientFx as AmbientLayer } from './AmbientFx'
import { ColorSwatches, hexLightness, lightnessToHex } from './ColorSwatches'

type Tab = 'look' | 'board' | 'sound' | 'match'

const TABS: { id: Tab; label: string }[] = [
  { id: 'look', label: 'Look' },
  { id: 'board', label: 'Board' },
  { id: 'sound', label: 'Sound' },
  { id: 'match', label: 'Match' },
]

const FX: { id: AmbientFx; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'scan', label: 'Scanline' },
  { id: 'sparks', label: 'Sparks' },
  { id: 'glitch', label: 'Glitch' },
]

export function SettingsView({
  settings,
  onChange,
  onBack,
}: {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>('look')
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value })

  return (
    <div className="shell menu-shell">
      <AmbientLayer kind={settings.ambientFx} accent={settings.accent} />
      <div className="menu-card wide">
        <h1 className="menu-title">Settings</h1>
        <div className="settings-tabs">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'look' && (
          <div className="settings-pane">
            <p className="hint">The board stays black and white. This color is the only accent.</p>
            <ColorSwatches value={settings.accent} onChange={(hex) => set('accent', hex)} />
            <label>
              Menu animation
              <select value={settings.ambientFx} onChange={(e) => set('ambientFx', e.target.value as AmbientFx)}>
                {FX.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Piece motion
              <select
                value={settings.animationSpeed}
                onChange={(e) => set('animationSpeed', e.target.value as AppSettings['animationSpeed'])}
              >
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.introEnabled}
                onChange={(e) => set('introEnabled', e.target.checked)}
              />
              Startup intro
            </label>
          </div>
        )}

        {tab === 'board' && (
          <div className="settings-pane">
            <label>
              Light squares {hexLightness(settings.boardLight)}
              <input
                type="range"
                min={55}
                max={96}
                value={hexLightness(settings.boardLight)}
                onChange={(e) => set('boardLight', lightnessToHex(Number(e.target.value)))}
              />
            </label>
            <label>
              Dark squares {hexLightness(settings.boardDark)}
              <input
                type="range"
                min={18}
                max={70}
                value={hexLightness(settings.boardDark)}
                onChange={(e) => set('boardDark', lightnessToHex(Number(e.target.value)))}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.showCoords} onChange={(e) => set('showCoords', e.target.checked)} />
              Show coordinates
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.showLegalDots}
                onChange={(e) => set('showLegalDots', e.target.checked)}
              />
              Highlight legal moves
            </label>
          </div>
        )}

        {tab === 'sound' && (
          <div className="settings-pane">
            <label className="check">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => set('soundEnabled', e.target.checked)}
              />
              Sound effects
            </label>
            <label>
              Music volume {Math.round(settings.musicVolume * 100)}
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.musicVolume * 100)}
                onChange={(e) => set('musicVolume', Number(e.target.value) / 100)}
              />
            </label>
            <p className="hint">In-game music plays from public/audio/theme.ogg when that file is there.</p>
          </div>
        )}

        {tab === 'match' && (
          <div className="settings-pane">
            <label className="check">
              <input
                type="checkbox"
                checked={settings.showPhaseBanners}
                onChange={(e) => set('showPhaseBanners', e.target.checked)}
              />
              Phase banners
            </label>
            <label>
              Default clock
              <select
                value={settings.timeControlDefault}
                onChange={(e) => set('timeControlDefault', e.target.value as TimeControlId)}
              >
                <option value="5+3">5+3</option>
                <option value="10+5">10+5</option>
              </select>
            </label>
          </div>
        )}

        <div className="settings-actions">
          <button type="button" className="btn" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
            Reset defaults
          </button>
          <button type="button" className="btn primary" onClick={onBack}>
            Back to menu
          </button>
        </div>
      </div>
    </div>
  )
}
