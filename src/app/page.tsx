'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useConnection, usePublicClient } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'

import { useVaultTasks } from '@/hooks/useVaultTasks'
import { useStreak } from '@/hooks/useStreak'
import { useCountdownToMidnightUTC } from '@/hooks/useCountdownToMidnightUTC'
import { copyText } from '@/lib/clipboard'
import { stableTaskConfig } from '@/lib/app-config'
import { useToast } from '@/components/ui/toast'

const ACTIVE_CHAIN_ID = stableTaskConfig.chain.id as 42220
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type Tier = {
  label: string
  min: number
  color: string
  border: string
  bg: string
  glow: string
  next: number | null
}

const XP_TIERS: Tier[] = [
  { label: 'Novice',   min: 0,     color: 'text-slate-300',  border: 'border-slate-400/40',  bg: 'bg-slate-400/10',  glow: 'rgba(148,163,184,0.2)',  next: 100 },
  { label: 'Explorer', min: 100,   color: 'text-cyan-300',   border: 'border-cyan-400/40',   bg: 'bg-cyan-400/10',   glow: 'rgba(34,211,238,0.2)',   next: 500 },
  { label: 'Pioneer',  min: 500,   color: 'text-lime-300',   border: 'border-lime-400/40',   bg: 'bg-lime-400/10',   glow: 'rgba(163,230,53,0.2)',   next: 2000 },
  { label: 'Champion', min: 2000,  color: 'text-amber-300',  border: 'border-amber-400/40',  bg: 'bg-amber-400/10',  glow: 'rgba(251,191,36,0.2)',   next: 10000 },
  { label: 'Legend',   min: 10000, color: 'text-violet-300', border: 'border-violet-400/40', bg: 'bg-violet-400/10', glow: 'rgba(167,139,250,0.2)',  next: null },
]

function getTier(xp: number): Tier {
  return XP_TIERS.findLast((t) => xp >= t.min) ?? XP_TIERS[0]
}

function formatAmount(value: string) {
  const num = parseFloat(value)
  if (isNaN(num)) return '0'
  if (num === Math.floor(num)) return num.toLocaleString()
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function buildShareText(xp: number, tierLabel: string, streakCount: number, appUrl: string) {
  const xpFormatted = xp.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const streakPart = streakCount > 1 ? ` on a 🔥 ${streakCount}-day streak` : ''
  return `I just hit ${xpFormatted} XP on StableTask and reached ${tierLabel} tier${streakPart}! 🎯 Join me on Celo 👉 ${appUrl}`
}

function QuickAction({
  href,
  accent,
  icon,
  label,
  sub,
}: {
  href: string
  accent: string
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-3 rounded-2xl border ${accent} bg-slate-950/60 px-4 py-4 transition hover:brightness-110 active:scale-[0.97]`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${accent} bg-slate-900/80`}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-black text-slate-50">{label}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>
      </div>
    </Link>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />
}

export default function HomePage() {
  const { address, isConnected } = useConnection()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  const { tasks, xpBalance, isFetchingTasks } = useVaultTasks()
  const { streakCount, isLoading: isStreakLoading } = useStreak(address)
  const { toast } = useToast()

  const [tapsToday, setTapsToday] = useState<number | null>(null)
  const [dailyTapLimit, setDailyTapLimit] = useState(1000)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle')
  const [addressCopied, setAddressCopied] = useState(false)
  const countdown = useCountdownToMidnightUTC()

  const handleCopyAddress = useCallback(async () => {
    if (!address || addressCopied) return
    try {
      await copyText(address)
      setAddressCopied(true)
      setTimeout(() => setAddressCopied(false), 1500)
    } catch {
      // silently ignore clipboard failures
    }
  }, [address, addressCopied])

  const loadTapStats = useCallback(async () => {
    if (!publicClient || stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) return
    try {
      const [limitResult, tapsTodayResult] = await Promise.all([
        publicClient.readContract({
          address: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'DAILY_TAP_LIMIT',
        }),
        address
          ? publicClient.readContract({
              address: stableTaskConfig.contracts.rewardVaultAddress,
              abi: stableTaskConfig.contracts.rewardVaultAbi,
              functionName: 'tapsToday',
              args: [address],
            })
          : Promise.resolve(BigInt(0)),
      ])
      setDailyTapLimit(Number(limitResult as bigint))
      setTapsToday(Number(tapsTodayResult as bigint))
    } catch {
      setTapsToday(0)
    }
  }, [publicClient, address])

  useEffect(() => {
    void loadTapStats()
  }, [loadTapStats])

  const handleShare = useCallback(async () => {
    if (shareState !== 'idle') return
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://stabletask.app'
    const xp = parseFloat(xpBalance) || 0
    const tier = getTier(xp)
    const text = buildShareText(xp, tier.label, streakCount, appUrl)

    // Try native share sheet (works great in MiniPay / mobile)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        setShareState('shared')
        setTimeout(() => setShareState('idle'), 2000)
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: clipboard copy
    try {
      await copyText(text)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch {
      // silently ignore clipboard failures
    }
  }, [shareState, xpBalance, streakCount])

  const xp = parseFloat(xpBalance) || 0
  const tier = getTier(xp)
  const tierIndex = XP_TIERS.indexOf(tier)
  const nextTier = XP_TIERS[tierIndex + 1]

  // Celebrate when the user crosses into a higher tier. The last-seen tier is
  // stored per wallet so the first observation just seeds the baseline (no
  // false celebration) and switching wallets doesn't fire a stale toast.
  useEffect(() => {
    if (isFetchingTasks || !address || typeof window === 'undefined') return
    const key = `stabletask:lastTier:${address.toLowerCase()}`
    const stored = window.localStorage.getItem(key)
    const storedIndex = stored !== null ? Number.parseInt(stored, 10) : null

    if (storedIndex === null || Number.isNaN(storedIndex)) {
      window.localStorage.setItem(key, String(tierIndex))
      return
    }
    if (tierIndex > storedIndex) {
      toast({
        title: `🎉 Tier up! You reached ${tier.label}`,
        description: nextTier
          ? `Next: ${nextTier.label} at ${tier.next?.toLocaleString()} XP`
          : 'You hit the max tier — Legend!',
        variant: 'success',
        durationMs: 4000,
      })
    }
    if (tierIndex !== storedIndex) {
      window.localStorage.setItem(key, String(tierIndex))
    }
  }, [isFetchingTasks, address, tierIndex, tier.label, tier.next, nextTier, toast])

  const levelPct =
    tier.next !== null
      ? Math.min(100, Math.round(((xp - tier.min) / (tier.next - tier.min)) * 100))
      : 100

  const claimedTasks = useMemo(() => tasks.filter((t) => t.hasClaimedPoint), [tasks])
  const recentClaims = useMemo(() => [...claimedTasks].sort((a, b) => (a.id > b.id ? -1 : 1)).slice(0, 3), [claimedTasks])
  const unclaimed = tasks.filter((t) => !t.hasClaimedPoint).length

  const tapPct = dailyTapLimit > 0 && tapsToday !== null ? Math.min(100, (tapsToday / dailyTapLimit) * 100) : 0

  const monogram = address ? address.slice(2, 4).toUpperCase() : '??'
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

  if (!isConnected) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pb-28 pt-4">
        {/* Landing hero */}
        <section
          className="relative overflow-hidden rounded-[1.5rem] border border-lime-300/20 px-6 py-8 text-center"
          style={{ background: 'linear-gradient(135deg,rgba(15,23,42,0.98),rgba(5,10,28,0.99))', boxShadow: '0 0 60px rgba(132,204,22,0.08)' }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/40 to-transparent" />
          <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-lime-300/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-cyan-300/5 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/20 bg-gradient-to-br from-lime-300/15 to-cyan-300/10 text-2xl font-black text-lime-200 shadow-[0_0_0_1px_rgba(132,204,22,0.12)]">
              ST
            </div>
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-lime-200">StableTask</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-50">
              Quest. Tap. Earn.
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Complete quests and tap to stack XP and pull cUSD from the vault on Celo.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { value: 'XP', label: 'Earn points' },
                { value: 'cUSD', label: 'Real rewards' },
                { value: 'Celo', label: 'Fast & cheap' },
              ].map((s) => (
                <div key={s.value} className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-3">
                  <div className="text-base font-black text-slate-50">{s.value}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
            <Link
              href="/tap"
              className="mt-6 inline-block rounded-full border border-lime-300/30 bg-lime-300/15 px-8 py-3 text-sm font-black text-lime-100 transition hover:bg-lime-300/22"
            >
              Connect &amp; Start Earning
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-3">
          <QuickAction href="/tap" accent="border-lime-300/20" icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-lime-300">
              <path fillRule="evenodd" d="M10 1a9 9 0 100 18A9 9 0 0010 1zm.75 4.5a.75.75 0 00-1.5 0v4.5H5.5a.75.75 0 000 1.5h3.75v2.25a.75.75 0 001.5 0V11.5h3.75a.75.75 0 000-1.5H10.75V5.5z" clipRule="evenodd" />
            </svg>
          } label="Tap Arena" sub="1 XP per tap, 1000/day" />
          <QuickAction href="/tasks" accent="border-cyan-300/20" icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-cyan-300">
              <path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1H3a1 1 0 010 2h-.01a1 1 0 01-1-1zM1.99 15.25a1 1 0 011-1H3a1 1 0 010 2h-.01a1 1 0 01-1-1zM1.99 10a1 1 0 011-1H3a1 1 0 010 2h-.01a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          } label="Quest Board" sub="Complete tasks for cUSD" />
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">
      {/* Identity + XP Hero */}
      <section
        className="relative overflow-hidden rounded-[1.5rem] border border-lime-300/20 px-5 py-5"
        style={{
          background: 'linear-gradient(135deg,rgba(15,23,42,0.97),rgba(5,10,28,0.98))',
          boxShadow: `0 0 40px ${tier.glow}`,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/35 to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-lime-300/8 blur-2xl" />

        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-lime-400/15 text-xl font-black text-slate-50 shadow-[0_0_0_1px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]">
            {monogram}
          </div>
          <div className="min-w-0 flex-1">

            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-200">
                Your XP
              </div>
              {!isFetchingTasks && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${tier.color} ${tier.border} ${tier.bg}`}>
                  {tier.label}
                </span>
              )}
              {/* Daily streak badge */}
              {!isStreakLoading && streakCount > 0 && (
                <span
                  title={`${streakCount}-day streak! Keep it up.`}
                  className="flex items-center gap-1 rounded-full border border-orange-400/35 bg-orange-400/10 px-2 py-0.5 text-[10px] font-black text-orange-300"
                >
                  🔥 {streakCount}d
                </span>
              )}
            </div>
            {isFetchingTasks ? (
              <SkeletonBlock className="mt-1 h-9 w-32" />
            ) : (
              <div className="mt-1 flex items-end gap-1.5">
                <span className="text-3xl font-black tabular-nums leading-none text-slate-50">
                  {formatAmount(xpBalance)}
                </span>
                <span className="mb-0.5 text-lg font-black text-lime-300">XP</span>
              </div>
            )}

            {/* Copy-address chip */}
            {address && (
              <button
                type="button"
                onClick={handleCopyAddress}
                title={addressCopied ? 'Copied!' : 'Copy your address'}
                className="mt-2 flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-200 active:scale-95"
              >
                {addressCopied ? (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-lime-300">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    <span className="text-lime-300">Copied!</span>
                  </>
                ) : (
                  <>
                    <span>{shortAddress}</span>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-60">
                      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Share score button */}
          {!isFetchingTasks && xp > 0 && (
            <button
              type="button"
              onClick={handleShare}
              disabled={shareState !== 'idle'}
              title="Share your score"
              className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-lime-300/20 bg-lime-300/8 px-3 py-2.5 text-lime-200 transition hover:bg-lime-300/15 active:scale-95 disabled:opacity-70"
            >
              {shareState === 'idle' && (
                <>
                  {/* Share / upload icon */}
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.366A2.52 2.52 0 0113 4.5z" />
                  </svg>
                  <span className="text-[10px] font-black leading-none">Share</span>
                </>
              )}
              {shareState === 'copied' && (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-lime-300">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] font-black leading-none text-lime-300">Copied!</span>
                </>
              )}
              {shareState === 'shared' && (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-lime-300">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] font-black leading-none text-lime-300">Shared!</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Tier progress bar */}
        {!isFetchingTasks && tier.next !== null && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[10px] text-slate-600">
              <span className={tier.color}>{tier.label}</span>
              <span className={nextTier?.color}>{nextTier?.label} at {tier.next.toLocaleString()} XP</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${levelPct}%`,
                  background: `linear-gradient(90deg, ${tier.glow.replace('0.2', '0.9')}, ${tier.glow.replace('0.2', '0.5')})`,
                }}
              />
            </div>
            <div className="mt-1.5 text-right text-[10px] font-bold text-slate-500">
              <span className="tabular-nums text-slate-300">
                {Math.max(0, Math.ceil(tier.next - xp)).toLocaleString()}
              </span>{' '}
              XP to {nextTier?.label}
            </div>
          </div>
        )}
        {!isFetchingTasks && tier.next === null && (
          <div className="mt-3 text-xs font-semibold text-violet-300/70">Maximum tier — Legend</div>
        )}
      </section>

      {/* Daily stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {/* Tasks progress */}
        <div className="rounded-xl border border-cyan-300/20 bg-slate-950/60 px-4 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Tasks</div>
          {isFetchingTasks ? (
            <SkeletonBlock className="mt-1 h-7 w-16" />
          ) : (
            <div className="mt-1 text-xl font-black text-slate-50">
              {claimedTasks.length}
              <span className="ml-1 text-xs font-semibold text-slate-500">/ {tasks.length}</span>
            </div>
          )}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            {!isFetchingTasks && tasks.length > 0 && (
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-lime-400/70 transition-all duration-700"
                style={{ width: `${(claimedTasks.length / tasks.length) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">claimed today</div>
        </div>

        {/* Streak card */}
        <div className="rounded-xl border border-orange-400/20 bg-slate-950/60 px-4 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-200">Streak</div>
          {isStreakLoading ? (
            <SkeletonBlock className="mt-1 h-7 w-10" />
          ) : (
            <div className="mt-1 text-xl font-black text-slate-50">
              {streakCount > 0 ? `🔥 ${streakCount}` : '—'}
            </div>
          )}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800" />
          <div className="mt-1 text-[10px] text-slate-500">day streak</div>
        </div>

        {/* Tap progress */}
        <div className="rounded-xl border border-amber-300/20 bg-slate-950/60 px-4 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">Taps</div>
          {tapsToday === null ? (
            <SkeletonBlock className="mt-1 h-7 w-16" />
          ) : (
            <div className="mt-1 text-xl font-black text-slate-50">
              {tapsToday.toLocaleString()}
              <span className="ml-1 text-xs font-semibold text-slate-500">/ {dailyTapLimit.toLocaleString()}</span>
            </div>
          )}
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            {tapsToday !== null && (
              <div
                className={`h-full rounded-full transition-all duration-700 ${tapPct >= 100 ? 'bg-slate-600' : 'bg-linear-to-r from-amber-400/80 to-lime-400/70'}`}
                style={{ width: `${tapPct}%` }}
              />
            )}
          </div>
          {tapsToday !== null && tapPct >= 100 ? (
            <div className="mt-1 text-[10px] font-black tabular-nums text-amber-300/80">
              ⏳ {countdown}
            </div>
          ) : (
            <div className="mt-1 text-[10px] text-slate-500">today</div>
          )}
        </div>
      </div>

      {/* Unclaimed callout */}
      {!isFetchingTasks && unclaimed > 0 && (
        <Link
          href="/tasks"
          className="flex items-center justify-between rounded-2xl border border-lime-300/20 bg-lime-300/5 px-4 py-3 transition hover:bg-lime-300/10"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-lime-300/35 bg-lime-300/10 text-lime-300">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8 1a6 6 0 100 12A6 6 0 008 1zm.75 3.5a.75.75 0 00-1.5 0V8a.75.75 0 00.75.75h2.5a.75.75 0 000-1.5H8.75V4.5z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-lime-200">
                {unclaimed} unclaimed quest{unclaimed !== 1 ? 's' : ''}
              </div>
              <div className="text-[10px] text-slate-500">Tap to go to the Quest Board</div>
            </div>
          </div>
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-lime-300/50">
            <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06L7.28 11.78a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </Link>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction href="/tap" accent="border-lime-300/20" icon={
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-lime-300">
            <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-2.09c-1.31-1.312-2.516-3.063-2.516-5.13A5.25 5.25 0 019.75 4.5c.75 0 1.453.176 2.073.485A5.224 5.224 0 0114.25 4.5a5.25 5.25 0 014.396 8.128 20.15 20.15 0 01-1.44 1.722 22.046 22.046 0 01-2.582 2.09 20.76 20.76 0 01-1.162.682l-.019.01-.005.003h-.002a.739.739 0 01-.69 0l-.002-.001z" />
          </svg>
        } label="Tap" sub="Stack XP" />
        <QuickAction href="/tasks" accent="border-cyan-300/20" icon={
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-cyan-300">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
        } label="Quests" sub="Earn cUSD" />
        <QuickAction href="/rewards" accent="border-amber-300/20" icon={
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-300">
            <path fillRule="evenodd" d="M10 1c3.866 0 7 1.79 7 4s-3.134 4-7 4-7-1.79-7-4 3.134-4 7-4zm5.694 8.13c.464-.264.91-.583 1.306-.952V10c0 2.21-3.134 4-7 4s-7-1.79-7-4V8.178c.396.37.842.688 1.306.953C5.838 10.006 7.854 10.5 10 10.5s4.162-.494 5.694-1.37zM3 13.179V15c0 2.21 3.134 4 7 4s7-1.79 7-4v-1.822c-.396.37-.842.688-1.306.953C14.162 15.006 12.146 15.5 10 15.5s-4.162-.494-5.694-1.37A7.347 7.347 0 013 13.179z" clipRule="evenodd" />
          </svg>
        } label="Rewards" sub="View XP &amp; cUSD" />
      </div>

      {/* Recent claims */}
      {(isFetchingTasks || recentClaims.length > 0) && (
        <section className="game-panel rounded-[1.25rem] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-black text-slate-50">Recent Claims</div>
            {!isFetchingTasks && claimedTasks.length > 3 && (
              <Link href="/rewards" className="text-[11px] font-semibold text-cyan-300/70 hover:text-cyan-300">
                View all →
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {isFetchingTasks && [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2.5">
                <SkeletonBlock className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-1">
                  <SkeletonBlock className="h-3.5 w-36" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
                <SkeletonBlock className="h-4 w-14" />
              </div>
            ))}
            {!isFetchingTasks && recentClaims.map((task) => (
              <div key={task.id.toString()} className="flex items-center gap-3 rounded-xl border border-lime-300/12 bg-slate-900/40 px-3 py-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-lime-300/25 bg-lime-300/10 text-lime-300">
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M10.293 2.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L5 7.586l5.293-5.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-50">{task.title}</div>
                  {task.tag && (
                    <div className="text-[10px] text-slate-500">{task.tag}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-black text-lime-300">+{formatAmount(task.rewardXp)} XP</div>
                  {parseFloat(task.rewardTokenAmount) > 0 && (
                    <div className="text-[10px] font-semibold text-amber-300">
                      +{formatAmount(task.rewardTokenAmount)} cUSD
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!isFetchingTasks && claimedTasks.length === 0 && (
        <section className="game-panel rounded-[1.25rem] px-5 py-8 text-center">
          <div className="text-sm font-bold text-slate-300">No activity yet</div>
          <div className="mt-1 text-xs text-slate-500">
            Tap to earn XP or complete a quest to get started.
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/tap" className="rounded-full border border-lime-300/25 bg-lime-300/10 px-5 py-2 text-xs font-bold text-lime-100 transition hover:bg-lime-300/18">
              Go Tap
            </Link>
            <Link href="/tasks" className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/18">
              Browse Quests
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
