import { useEffect, useRef } from 'react'
import { playIntroSting } from '../lib/audio'

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  R: ['11110', '10001', '11110', '10100', '10010'],
  S: ['01110', '10000', '01110', '00001', '11110'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000'],
}

export function IntroOverlay({
  accent,
  sound,
  onDone,
}: {
  accent: string
  sound: boolean
  onDone: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const finish = () => done.current()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      finish()
    }
    window.addEventListener('keydown', onKey, true)
    const timer = window.setTimeout(finish, 2300)
    if (sound) playIntroSting()
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(timer)
    }
  }, [sound])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const text = 'MYRIAD CHESS'
    let frame = 0
    let raf = 0
    const tick = () => {
      frame += 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = Math.max(1, w)
        canvas.height = Math.max(1, h)
      }
      ctx.fillStyle = '#101010'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drawWord(ctx, text, canvas.width, canvas.height, frame)
      if (frame > 18 && frame < 34) drawBolt(ctx, canvas.width, canvas.height, accent, 0.28)
      if (frame > 40 && frame < 54) drawBolt(ctx, canvas.width, canvas.height, accent, 0.7)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [accent])

  return (
    <button type="button" className="intro-overlay" onClick={() => done.current()}>
      <canvas ref={ref} />
      <span>click or press a key</span>
    </button>
  )
}

function drawWord(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, frame: number) {
  const cols = text.length * 6 - 1
  const cell = Math.max(4, Math.floor(Math.min((w * 0.82) / cols, h / 16)))
  const originX = Math.floor((w - cols * cell) / 2)
  const originY = Math.floor(h / 2 - 2.5 * cell)
  text.split('').forEach((ch, index) => {
    const rows = GLYPHS[ch] ?? GLYPHS[' ']!
    rows.forEach((row, y) => {
      row.split('').forEach((bit, x) => {
        if (bit !== '1') return
        const reveal = index * 4 + x + y
        if (frame < reveal) return
        ctx.fillStyle = frame - reveal < 3 ? '#ffffff' : '#f4f1ea'
        ctx.fillRect(originX + (index * 6 + x) * cell, originY + y * cell, cell - 1, cell - 1)
      })
    })
  })
}

function drawBolt(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, start: number) {
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.beginPath()
  let x = w * start
  let y = h * 0.12
  ctx.moveTo(x, y)
  for (let i = 0; i < 8; i++) {
    x += (i % 2 === 0 ? 26 : -18)
    y += h * 0.08
    ctx.lineTo(x, y)
  }
  ctx.stroke()
}
