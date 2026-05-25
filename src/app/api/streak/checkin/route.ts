import { NextRequest, NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/mongodb'
import { calculateNewStreak, getUtcDateString, isNewActivityDay } from '@/lib/streak'
import { User } from '@/models/User'

/**
 * POST /api/streak/checkin
 * Body: { walletAddress: string }
 *
 * Records today's activity for the user, updating their streak count.
 * Idempotent — safe to call multiple times per day; only the first call
 * for a given UTC day actually increments the streak.
 *
 * Returns: { streakCount: number, lastActivityDate: string, isNewDay: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const walletAddress = body?.walletAddress as string | undefined

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required.' }, { status: 400 })
    }

    const normalizedWallet = walletAddress.toLowerCase()
    const today = getUtcDateString()

    let user = await User.findOne({ walletAddress: normalizedWallet })

    // First-ever visit — create user record
    if (!user) {
      user = await User.create({
        walletAddress: normalizedWallet,
        streakCount: 1,
        lastActivityDate: today,
      })
      return NextResponse.json({
        streakCount: 1,
        lastActivityDate: today,
        isNewDay: true,
      })
    }

    const alreadyCheckedIn = !isNewActivityDay(user.lastActivityDate ?? null, today)

    if (alreadyCheckedIn) {
      return NextResponse.json({
        streakCount: user.streakCount ?? 0,
        lastActivityDate: user.lastActivityDate,
        isNewDay: false,
      })
    }

    const newStreak = calculateNewStreak(user.streakCount ?? 0, user.lastActivityDate ?? null, today)
    user.streakCount = newStreak
    user.lastActivityDate = today
    await user.save()

    return NextResponse.json({
      streakCount: newStreak,
      lastActivityDate: today,
      isNewDay: true,
    })
  } catch (error) {
    console.error('POST /api/streak/checkin failed:', error)
    return NextResponse.json({ error: 'Failed to update streak.' }, { status: 500 })
  }
}
