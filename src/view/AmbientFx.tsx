import { useEffect, useRef } from 'react'
import type { AmbientFx as AmbientKind } from '../lib/prefs'

export function AmbientFx({ kind, accent }: { kind: AmbientKind; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (kind === 'off') return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    let raf = 0
    let boltUntil = 0

    const tick = () => {
      frame += 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)
      if (kind === 'lightning') drawLightning(ctx, w, h, accent, frame, boltUntil)
      if (kind === 'scan') drawScan(ctx, w, h, accent, frame)
      if (kind === 'sparks') drawSparks(ctx, w, h, accent, frame)
      if (kind === 'glitch') drawGlitch(ctx, w, h, accent, frame)
      if (kind === 'lightning' && frame > boltUntil && frame % 110 === 0) boltUntil = frame + 7
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [kind, accent])

  if (kind === 'off') return null
  return <canvas ref={ref} className="ambient-fx" aria-hidden />
}

function drawLightning(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  accent: string,
  frame: number,
  boltUntil: number,
) {
  if (frame > boltUntil) return
  ctx.strokeStyle = frame % 2 === 0 ? '#f4f1ea' : accent
  ctx.lineWidth = 2
  ctx.beginPath()
  let x = w * 0.62
  let y = 0
  ctx.moveTo(x, y)
  while (y < h * 0.72) {
    x += ((frame * 17 + y) % 48) - 24
    y += 28
    ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function drawScan(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, frame: number) {
  const y = (frame * 4) % h
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.85
  ctx.fillRect(0, y, w, 3)
  ctx.globalAlpha = 1
}

function drawSparks(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, frame: number) {
  ctx.fillStyle = accent
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97 + frame * 3) % w)
    const y = ((i * 53 + frame * 2) % h)
    ctx.fillRect(x, y, 3, 3)
  }
}

function drawGlitch(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, frame: number) {
  if (frame % 18 > 4) return
  ctx.fillStyle = accent
  for (let i = 0; i < 4; i++) {
    const y = ((frame * 13 + i * 40) % h)
    const shift = ((frame + i) % 2 === 0 ? 12 : -16)
    ctx.fillRect(shift, y, w, 4)
  }
}
