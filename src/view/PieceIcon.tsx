import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Color, PieceType } from '../engine'
import { facingFrames, frameIconUrl, loadSpriteLibrary, type Facing, type FusionId } from './sprites'

const SkinContext = createContext('classic')

export function SkinScope({ skinId, children }: { skinId: string; children: ReactNode }) {
  return <SkinContext.Provider value={skinId}>{children}</SkinContext.Provider>
}

export function PieceIcon({
  type,
  fusion,
  color = 'white',
  facing = 'south',
  skinId,
}: {
  type: PieceType
  fusion?: FusionId
  color?: Color
  facing?: Facing
  skinId?: string
}) {
  const contextSkin = useContext(SkinContext)
  const equipped = skinId ?? contextSkin
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadSpriteLibrary(equipped)
      .then(async (lib) => {
        const frame = facingFrames(lib, type, color, fusion)[facing]
        const icon = await frameIconUrl(frame)
        if (live) setUrl(icon)
      })
      .catch(() => {
        if (live) setUrl(null)
      })
    return () => {
      live = false
    }
  }, [type, fusion, color, facing, equipped])
  if (!url) return <span className="piece-icon piece-icon-empty" aria-hidden />
  return <img className="piece-icon" src={url} alt="" draggable={false} />
}
