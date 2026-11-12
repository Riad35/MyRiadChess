import type { PieceType } from '../engine'
import type { AppSettings } from '../lib/prefs'
import { SKINS, type SkinPack } from '../lib/skins'
import { PieceIcon } from './PieceIcon'
import type { FusionId } from './sprites'

const BASE: PieceType[] = ['König', 'Dame', 'Turm', 'Bishop', 'Ritter', 'Drache', 'Soldat']

const FUSIONS: { title: string; fusion?: FusionId; types: [PieceType, PieceType] }[] = [
  { title: 'Turm + Turm', types: ['Turm', 'Turm'] },
  { title: 'Dame', fusion: 'bishop-tower', types: ['Bishop', 'Turm'] },
  { title: 'Edler Drache', fusion: 'elder-dragon', types: ['Drache', 'Drache'] },
  { title: 'Edler Ritter', fusion: 'noble-knight', types: ['Ritter', 'Ritter'] },
  { title: 'Drachenritter', types: ['Drache', 'Ritter'] },
  { title: 'Soldat + Soldat', fusion: 'viking', types: ['Soldat', 'Soldat'] },
  { title: 'Pope', types: ['Bishop', 'Bishop'] },
  { title: 'Dame + Dame', types: ['Dame', 'Dame'] },
]

export function ProfileView({
  settings,
  onChange,
  onBack,
}: {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onBack: () => void
}) {
  const equipped = SKINS.find((skin) => skin.id === settings.skinId) ?? SKINS[0]!
  return (
    <div className="shell menu-shell">
      <div className="menu-card wide profile-card">
        <p className="menu-kicker">{settings.playerName}</p>
        <h1 className="menu-title">Profile</h1>
        <label className="menu-field">
          Name
          <input
            value={settings.playerName}
            maxLength={24}
            onChange={(e) => onChange({ ...settings, playerName: e.target.value })}
          />
        </label>
        <div className="skin-grid">
          {SKINS.map((skin) => (
            <button
              key={skin.id}
              type="button"
              className={skin.id === equipped.id ? 'skin-card active' : 'skin-card'}
              onClick={() => onChange({ ...settings, skinId: skin.id })}
            >
              <strong>{skin.name}</strong>
              <span>{skin.description}</span>
              <SkinTags skin={skin} />
            </button>
          ))}
        </div>
        <h2>Figures</h2>
        <div className="profile-row">
          {BASE.map((type) => (
            <div key={type} className="profile-piece">
              <PieceIcon type={type} color="white" />
              <span>{type}</span>
            </div>
          ))}
        </div>
        <h2>Fusions</h2>
        <div className="profile-fusions">
          {FUSIONS.map((fusion) => (
            <div key={fusion.title} className="profile-piece">
              {fusion.fusion ? (
                <PieceIcon type={fusion.types[0]} fusion={fusion.fusion} color="white" />
              ) : (
                <span className="fusion-pair">
                  <PieceIcon type={fusion.types[0]} color="white" />
                  <PieceIcon type={fusion.types[1]} color="white" />
                </span>
              )}
              <span>{fusion.title}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={onBack}>
          Back to menu
        </button>
      </div>
    </div>
  )
}

function SkinTags({ skin }: { skin: SkinPack }) {
  const tags = [
    skin.moveAnim !== 'none' ? skin.moveAnim : null,
    skin.vfx !== 'none' ? skin.vfx : null,
    skin.sfx.capture || skin.sfx.fuse || skin.sfx.move ? 'sfx' : null,
    skin.sprites || skin.fusions ? 'sprites' : null,
  ].filter(Boolean)
  if (tags.length === 0) return <em>plain</em>
  return <em>{tags.join(' · ')}</em>
}
