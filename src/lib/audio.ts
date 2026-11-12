let ctx: AudioContext | null = null
let music: HTMLAudioElement | null = null
let musicMissing = false

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, at: number, dur: number, gain = 0.06) {
  const ac = context()
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  amp.gain.setValueAtTime(gain, at)
  amp.gain.exponentialRampToValueAtTime(0.001, at + dur)
  osc.connect(amp)
  amp.connect(ac.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

export function playBlip(kind: 'move' | 'capture' | 'fuse') {
  const t = context().currentTime
  if (kind === 'move') tone(440, t, 0.08, 0.045)
  if (kind === 'capture') {
    tone(220, t, 0.1, 0.06)
    tone(140, t + 0.07, 0.12, 0.05)
  }
  if (kind === 'fuse') {
    tone(520, t, 0.07, 0.05)
    tone(780, t + 0.08, 0.1, 0.045)
  }
}

export function playIntroSting() {
  const t = context().currentTime
  ;[262, 330, 392, 523].forEach((freq, i) => tone(freq, t + i * 0.12, 0.16, 0.05))
}

/** Plays public/audio/theme.ogg once that file exists. Missing files stay silent. */
export async function syncMusic(enabled: boolean, volume: number): Promise<void> {
  if (!enabled || volume <= 0) {
    music?.pause()
    return
  }
  if (musicMissing) return
  if (!music) {
    const probe = await fetch('/audio/theme.ogg', { method: 'HEAD' }).catch(() => null)
    if (!probe?.ok) {
      musicMissing = true
      return
    }
    music = new Audio('/audio/theme.ogg')
    music.loop = true
  }
  music.volume = Math.min(1, Math.max(0, volume))
  try {
    await music.play()
  } catch {
    /* autoplay can wait for the next gesture */
  }
}
