import { NextRequest, NextResponse } from 'next/server'

import { connectToDatabase } from '@/lib/mongodb'
import { Claim } from '@/models/Claim'
import { Task } from '@/models/Task'
import { User } from '@/models/User'

const COOLDOWN_MS = 24 * 60 * 60 * 1000
const FRAUD_THRESHOLD = 3

function buildFingerprint(walletAddress: string, userAgent: string) {
  return `${walletAddress.toLowerCase()}::${userAgent}`
}

function buildReferralCode(walletAddress: string) {
  return `ST-${walletAddress.slice(2, 8).toUpperCase()}`
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const taskId = body?.taskId as string | undefined
    const walletAddress = body?.walletAddress as string | undefined
    const txHash = body?.txHash as string | undefined
    const userAgent = request.headers.get('user-agent') ?? 'unknown'

    if (!taskId || !walletAddress) {
      return NextResponse.json({ error: 'taskId and walletAddress are required.' }, { status: 400 })
    }

    const normalizedWallet = walletAddress.toLowerCase()
    const fingerprint = buildFingerprint(normalizedWallet, userAgent)

    const task = await Task.findById(taskId)
    if (!task || !task.isActive) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    let user = await User.findOne({ walletAddress: normalizedWallet })
    if (!user) {
      user = await User.create({
        walletAddress: normalizedWallet,
        userAgent,
        referralCode: buildReferralCode(normalizedWallet),
      })
    }

    if (user.suspiciousClaimCount >= FRAUD_THRESHOLD) {
      return NextResponse.json({ error: 'Claims disabled due to suspicious activity.' }, { status: 403 })
    }

    const existingClaim = await Claim.findOne({
      task: task._id,
      walletAddress: normalizedWallet,
    })
    if (existingClaim) {
      user.suspiciousClaimCount += 1
      await user.save()
      return NextResponse.json({ error: 'Task already claimed by this wallet.' }, { status: 409 })
    }

    if (user.lastClaimAt && Date.now() - user.lastClaimAt.getTime() < COOLDOWN_MS) {
      user.suspiciousClaimCount += 1
      await user.save()
      return NextResponse.json({ error: 'Claim cooldown active for 24 hours.' }, { status: 429 })
    }

    const claim = await Claim.create({
      task: task._id,
      user: user._id,
      walletAddress: normalizedWallet,
      fingerprint,
      amountCusd: task.rewardCusd,
      txHash: txHash ?? null,
      status: txHash ? 'confirmed' : 'pending',
      claimedAt: new Date(),
    })

    user.userAgent = userAgent
    user.lastClaimAt = new Date()
    user.totalClaimedCusd += task.rewardCusd
    await user.save()

    return NextResponse.json({
      claim: {
        id: claim._id,
        taskId,
        walletAddress: normalizedWallet,
        amountCusd: claim.amountCusd,
        status: claim.status,
        txHash: claim.txHash,
      },
    })
  } catch (error) {
    console.error('POST /api/tasks/claim failed:', error)
    return NextResponse.json({ error: 'Failed to create claim.' }, { status: 500 })
  }
}
