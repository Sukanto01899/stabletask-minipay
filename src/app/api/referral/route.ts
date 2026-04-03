import { NextRequest, NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/mongodb'
import { Referral } from '@/models/Referral'
import { User } from '@/models/User'

function buildReferralCode(walletAddress: string) {
  return `ST-${walletAddress.slice(2, 8).toUpperCase()}`
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const walletAddress = body?.walletAddress as string | undefined
    const referralCode = body?.referralCode as string | undefined

    if (!walletAddress || !referralCode) {
      return NextResponse.json({ error: 'walletAddress and referralCode are required.' }, { status: 400 })
    }

    const normalizedWallet = walletAddress.toLowerCase()

    let referee = await User.findOne({ walletAddress: normalizedWallet })
    if (!referee) {
      referee = await User.create({
        walletAddress: normalizedWallet,
        referralCode: buildReferralCode(normalizedWallet),
      })
    }

    const referrer = await User.findOne({ referralCode })
    if (!referrer) {
      return NextResponse.json({ error: 'Referral code not found.' }, { status: 404 })
    }

    if (String(referrer._id) === String(referee._id)) {
      return NextResponse.json({ error: 'Self-referrals are not allowed.' }, { status: 400 })
    }

    const referral = await Referral.findOneAndUpdate(
      {
        referrer: referrer._id,
        referee: referee._id,
      },
      {
        $setOnInsert: {
          code: referralCode,
          status: 'pending',
          rewardCusd: 0.75,
        },
      },
      {
        upsert: true,
        new: true,
      },
    )

    if (!referee.referredBy) {
      referee.referredBy = referrer._id
      await referee.save()
    }

    return NextResponse.json({
      referral: {
        id: referral._id,
        code: referral.code,
        status: referral.status,
        rewardCusd: referral.rewardCusd,
      },
    })
  } catch (error) {
    console.error('POST /api/referral failed:', error)
    return NextResponse.json({ error: 'Failed to create referral.' }, { status: 500 })
  }
}
