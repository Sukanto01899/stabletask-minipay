'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Count-up number that animates from its previous value to the next whenever
 * `value` changes. Optionally renders as gradient (clipped) text. Honors
 * `prefers-reduced-motion` by snapping straight to the final value.
 */
export function AnimatedNumber({
  value,
  format = (n) => n.toLocaleString(),
  gradient = false,
  duration = 600,
  className,
}: {
  value: number
  format?: (n: number) => string
  gradient?: boolean
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || duration <= 0) {
      fromRef.current = to
      setDisplay(to)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = easeOutCubic(progress)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        setDisplay(to)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span
      className={cn(
        'tabular-nums',
        gradient &&
          'bg-linear-to-r from-lime-300 via-cyan-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(132,204,22,0.25)]',
        className,
      )}
    >
      {format(display)}
    </span>
  )
}
