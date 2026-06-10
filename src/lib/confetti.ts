// Zero-dependency confetti burst for celebratory moments (e.g. tier-up).
// Spawns a short-lived full-screen canvas, animates a handful of particles
// under gravity, then cleans itself up. No-ops on the server and when the
// user prefers reduced motion.

const COLORS = ['#a3e635', '#22d3ee', '#fbbf24', '#a78bfa', '#f472b6']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  spin: number
}

export function fireConfetti(particleCount = 90): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const setSize = () => {
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  setSize()

  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;'
  document.body.appendChild(canvas)

  const w = window.innerWidth
  const originX = w / 2
  const originY = window.innerHeight * 0.32

  const particles: Particle[] = Array.from({ length: particleCount }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 4 + Math.random() * 7
    return {
      x: originX + (Math.random() - 0.5) * 60,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
    }
  })

  const gravity = 0.18
  const drag = 0.992
  let frame = 0
  const maxFrames = 160

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const fade = Math.max(0, 1 - frame / maxFrames)

    for (const p of particles) {
      p.vx *= drag
      p.vy = p.vy * drag + gravity
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.spin

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = fade
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }

    frame += 1
    if (frame < maxFrames) {
      requestAnimationFrame(tick)
    } else {
      canvas.remove()
    }
  }

  requestAnimationFrame(tick)
}
