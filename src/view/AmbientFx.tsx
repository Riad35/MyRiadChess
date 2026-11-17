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
    let timer = 0
    let nextBolt = 40 + Math.floor(Math.random() * 30)
    const bolts: Bolt[] = []

    const tick = () => {
      frame += 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)
      let sleeping = false
      if (kind === 'lightning') {
        if (frame >= nextBolt) {
          spawnBolts(bolts, w, h, frame)
          nextBolt = frame + 220 + Math.floor(Math.random() * 80)
        }
        drawLightning(ctx, accent, frame, bolts)
        if (bolts.length === 0) {
          const wait = Math.max(1, nextBolt - frame)
          timer = window.setTimeout(() => {
            frame = nextBolt - 1
            raf = requestAnimationFrame(tick)
          }, wait * (1000 / 60))
          sleeping = true
        }
      }
      if (kind === 'scan') drawScan(ctx, w, h, accent, frame)
      if (kind === 'sparks') drawSparks(ctx, w, h, accent, frame)
      if (kind === 'glitch') drawGlitch(ctx, w, h, accent, frame)
      if (!sleeping) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [kind, accent])

  if (kind === 'off') return null
  return <canvas ref={ref} className="ambient-fx" aria-hidden />
}

type Bolt = { pts: { x: number; y: number }[]; born: number }

const STRIKE = 5
const FADE = 9

function spawnBolts(bolts: Bolt[], w: number, h: number, frame: number) {
  const count = 2 + Math.floor(Math.random() * 2)
  for (let n = 0; n < count; n++) {
    const pts: Bolt['pts'] = []
    let x = w * (0.18 + Math.random() * 0.64)
    let y = 0
    pts.push({ x, y })
    const end = h * (0.62 + Math.random() * 0.28)
    while (y < end) {
      x += Math.random() * 90 - 45
      y += 20 + Math.random() * 22
      pts.push({ x, y })
    }
    bolts.push({ pts, born: frame })
  }
}

function drawLightning(ctx: CanvasRenderingContext2D, accent: string, frame: number, bolts: Bolt[]) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bolt = bolts[i]!
    const age = frame - bolt.born
    if (age >= STRIKE + FADE) {
      bolts.splice(i, 1)
      continue
    }
    traceBolt(ctx, bolt.pts)
    if (age < STRIKE) {
      ctx.globalAlpha = 0.45
      ctx.strokeStyle = accent
      ctx.lineWidth = 16
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.strokeStyle = age % 2 === 0 ? '#f7f4ee' : accent
      ctx.lineWidth = 8
      ctx.stroke()
    } else {
      const left = 1 - (age - STRIKE) / FADE
      ctx.globalAlpha = Math.max(0, left) * 0.75
      ctx.strokeStyle = '#f4f1ea'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

function traceBolt(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  const first = pts[0]
  if (!first) return
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
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
