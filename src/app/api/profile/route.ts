import { NextRequest, NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/mongodb'
import { Claim } from '@/models/Claim'
import { Referral } from '@/models/Referral'
import { User } from '@/models/User'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()

    const walletAddress = request.nextUrl.searchParams.get('walletAddress')
    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required.' }, { status: 400 })
    }

    const normalizedWallet = walletAddress.toLowerCase()
    const user = await User.findOne({ walletAddress: normalizedWallet }).lean()

    if (!user) {
      return NextResponse.json(
        {
          profile: {
            walletAddress: normalizedWallet,
            totalClaimedCusd: 0,
            suspiciousClaimCount: 0,
            referralCode: null,
            lastClaimAt: null,
            claims: [],
            referrals: [],
          },
        },
        { status: 200 },
      )
    }

    const [claims, referrals] = await Promise.all([
      Claim.find({ user: user._id })
        .select('task amountCusd status txHash claimedAt')
        .populate({ path: 'task', select: 'title' })
        .sort({ claimedAt: -1 })
        .lean(),
      Referral.find({
        $or: [{ referrer: user._id }, { referee: user._id }],
      })
        .select('code status rewardCusd createdAt')
        .sort({ createdAt: -1 })
        .lean(),
    ])

    return NextResponse.json({
      profile: {
        walletAddress: user.walletAddress,
        totalClaimedCusd: user.totalClaimedCusd,
        suspiciousClaimCount: user.suspiciousClaimCount,
        referralCode: user.referralCode,
        lastClaimAt: user.lastClaimAt,
        claims,
        referrals,
      },
    })
  } catch (error) {
    console.error('GET /api/profile failed:', error)
    return NextResponse.json({ error: 'Failed to fetch profile.' }, { status: 500 })
  }
}
