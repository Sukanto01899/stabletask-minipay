'use client'

import { useCallback, useEffect, useState } from 'react'

interface StreakState {
  streakCount: number
  lastActivityDate: string | null
  isLoading: boolean
}

/**
 * useStreak — fetches and maintains the user's daily streak.
 *
 * On mount (when walletAddress is provided) it calls /api/streak/checkin
 * to record today's activity and get back the current streak count.
 * Safe to call repeatedly; the API is idempotent per UTC day.
 */
export function useStreak(walletAddress: string | undefined): StreakState {
  const [streakCount, setStreakCount] = useState(0)
  const [lastActivityDate, setLastActivityDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkin = useCallback(async (address: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/streak/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        streakCount: number
        lastActivityDate: string
        isNewDay: boolean
      }
      setStreakCount(data.streakCount)
      setLastActivityDate(data.lastActivityDate)
    } catch {
      // non-fatal — streak display just stays at 0
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (walletAddress) {
      void checkin(walletAddress)
    }
  }, [walletAddress, checkin])

  return { streakCount, lastActivityDate, isLoading }
}
