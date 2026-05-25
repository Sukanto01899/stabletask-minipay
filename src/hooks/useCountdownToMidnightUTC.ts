'use client'

import { useEffect, useState } from 'react'

/** Returns milliseconds until the next midnight UTC. */
function msUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // next day
  )
  return Math.max(0, midnight - now.getTime())
}

/** Formats a millisecond duration as "HH:MM:SS". */
function formatMs(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(totalSecs / 3600)
  const mm = Math.floor((totalSecs % 3600) / 60)
  const ss = totalSecs % 60
  return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':')
}

/**
 * Returns a live "HH:MM:SS" countdown string to midnight UTC.
 * Updates every second. When midnight is crossed the string resets to
 * the next day's full 24-hour window.
 */
export function useCountdownToMidnightUTC(): string {
  const [remaining, setRemaining] = useState<number>(msUntilMidnightUTC)

  useEffect(() => {
    // Tick handler — recalculate from wall clock each second to stay accurate.
    const tick = () => setRemaining(msUntilMidnightUTC())

    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return formatMs(remaining)
}
