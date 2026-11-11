import { useEffect, useState } from 'react'
import type { Color, PieceType } from '../engine/types'
import { displayName, unitEntry } from './catalog'
import type { SpriteDir } from './facing'
import { spriteUrl } from './urls'

export function PieceSprite({
  type,
  color,
  dir,
  fused,
  code,
  height,
  title,
}: {
  type: PieceType
  color: Color
  dir: SpriteDir
  fused: boolean
  code: string
  height: number
  title?: string
}) {
  const [failed, setFailed] = useState(false)
  const url = spriteUrl(color, type, dir)
  const label = title ?? displayName(type)
  const letter = unitEntry(type).letter

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (failed) {
    return (
      <span className={`stack color-${color} ${fused ? 'fused' : ''}`} title={label}>
        <span className="badge">{fused ? code : letter}</span>
        {height > 1 && !fused && <span className="height">×{height}</span>}
      </span>
    )
  }

  return (
    <span className={`stack has-sprite color-${color} ${fused ? 'fused' : ''}`} title={label}>
      <img
        className="piece-sprite"
        src={url}
        alt={label}
        width={96}
        height={96}
        draggable={false}
        onError={() => setFailed(true)}
      />
      {fused && <span className="fusion-chip">{code}</span>}
      {height > 1 && !fused && <span className="height sprite-height">×{height}</span>}
    </span>
  )
}
