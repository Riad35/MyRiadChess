import { useEffect, useState } from 'react'
import type { Color, PieceType } from '../engine'
import { loadSpriteLibrary, type Facing, type FusionId } from './sprites'

export function PieceIcon({
  type,
  fusion,
  color = 'white',
  facing = 'south',
}: {
  type: PieceType
  fusion?: FusionId
  color?: Color
  facing?: Facing
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadSpriteLibrary()
      .then((lib) => {
        const frame = fusion ? lib.fusions[fusion][color][facing] : lib.pieces[type][color][facing]
        if (live) setUrl(frame.url)
      })
      .catch(() => {
        if (live) setUrl(null)
      })
    return () => {
      live = false
    }
  }, [type, fusion, color, facing])
  if (!url) return <span className="piece-icon piece-icon-empty" aria-hidden />
  return <img className="piece-icon" src={url} alt="" draggable={false} />
}
