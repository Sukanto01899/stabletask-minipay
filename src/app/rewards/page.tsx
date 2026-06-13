'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useConnection } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'

import { useVaultTasks, type OnchainTask } from '@/hooks/useVaultTasks'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { stableTaskConfig } from '@/lib/app-config'
import { Badge } from '@/components/ui/badge'
import { AnimatedNumber } from '@/components/stabletask/AnimatedNumber'
import { EmptyState } from '@/components/stabletask/EmptyState'

function safeParseUnits(value: string | undefined, decimals: number) {
  if (!value) return BigInt(0)
  try {
    return parseUnits(value, decimals)
  } catch {
    return BigInt(0)
  }
}

function formatAmount(value: string) {
  const num = parseFloat(value)
  if (isNaN(num)) return '0'
  if (num === Math.floor(num)) return num.toLocaleString()
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

type Tier = {
  label: string
  min: number
  max: number
  color: string
  border: string
  bg: string
  glow: string
  next: number | null
}

const XP_TIERS: Tier[] = [
  { label: 'Novice',   min: 0,     max: 99,    color: 'text-slate-300',  border: 'border-slate-400/40',  bg: 'bg-slate-400/10',  glow: 'rgba(148,163,184,0.15)', next: 100 },
  { label: 'Explorer', min: 100,   max: 499,   color: 'text-cyan-300',   border: 'border-cyan-400/40',   bg: 'bg-cyan-400/10',   glow: 'rgba(34,211,238,0.15)',  next: 500 },
  { label: 'Pioneer',  min: 500,   max: 1999,  color: 'text-lime-300',   border: 'border-lime-400/40',   bg: 'bg-lime-400/10',   glow: 'rgba(163,230,53,0.15)',  next: 2000 },
  { label: 'Champion', min: 2000,  max: 9999,  color: 'text-amber-300',  border: 'border-amber-400/40',  bg: 'bg-amber-400/10',  glow: 'rgba(251,191,36,0.15)',  next: 10000 },
  { label: 'Legend',   min: 10000, max: Infinity, color: 'text-violet-300', border: 'border-violet-400/40', bg: 'bg-violet-400/10', glow: 'rgba(167,139,250,0.15)', next: null },
]

function getTier(xp: number): Tier {
  return XP_TIERS.findLast((t) => xp >= t.min) ?? XP_TIERS[0]
}

function StatCard(props: {
  label: string
  labelColor: string
  borderColor: string
  value: string
  sub: string
  loading: boolean
}) {
  return (
    <div className={`rounded-xl border ${props.borderColor} bg-slate-950/72 p-4`}>
      <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${props.labelColor}`}>
        {props.label}
      </div>
      {props.loading ? (
        <div className="skeleton-shimmer mt-1 h-8 w-28 rounded-lg" />
      ) : (
        <div className="mt-1 text-2xl font-black text-slate-50">{props.value}</div>
      )}
      <div className="mt-1 text-xs text-slate-400">{props.sub}</div>
    </div>
  )
}

function XpHero({ xpBalance, loading }: { xpBalance: string; loading: boolean }) {
  const xp = parseFloat(xpBalance) || 0
  const tier = getTier(xp)
  const tierIndex = XP_TIERS.indexOf(tier)
  const nextTier = XP_TIERS[tierIndex + 1]
  const levelPct =
    tier.next !== null
      ? Math.min(100, Math.round(((xp - tier.min) / (tier.next - tier.min)) * 100))
      : 100

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-lime-300/25 px-5 py-5"
      style={{
        background: 'linear-gradient(135deg,rgba(15,23,42,0.97),rgba(5,10,28,0.98))',
        boxShadow: `0 0 40px ${tier.glow}`,
      }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-lime-300/10 blur-2xl" />

      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-200">XP Balance</div>
        {loading ? (
          <div className="skeleton-shimmer h-5 w-16 rounded-full" />
        ) : (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${tier.color} ${tier.border} ${tier.bg}`}
          >
            {tier.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="skeleton-shimmer mt-2 h-10 w-36 rounded-lg" />
      ) : (
        <div className="mt-1 flex items-end gap-2">
          <AnimatedNumber
            value={xp}
            format={(n) => formatAmount(String(n))}
            gradient
            className="text-4xl font-black leading-none"
          />
          <span className="mb-0.5 text-xl font-black text-lime-300">XP</span>
        </div>
      )}

      {!loading && tier.next !== null && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-slate-500">
            <span>{tier.label}</span>
            <span className={nextTier?.color}>
              {nextTier?.label} at {tier.next.toLocaleString()} XP
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
            <div
              className={`h-full rounded-full transition-all duration-700 ${tier.bg} border-0`}
              style={{
                width: `${levelPct}%`,
                background: `linear-gradient(90deg, ${tier.glow.replace('0.15', '0.8')}, ${tier.glow.replace('0.15', '0.5')})`,
              }}
            />
          </div>
          <div className="mt-1 text-right text-[10px] text-slate-600">{levelPct}% · {(tier.next - xp).toLocaleString()} XP to go</div>
        </div>
      )}

      {!loading && tier.next === null && (
        <div className="mt-2 text-xs text-slate-400">Maximum tier reached</div>
      )}
    </div>
  )
}

function ProgressSection({
  claimed,
  total,
  loading,
}: {
  claimed: number
  total: number
  loading: boolean
}) {
  const pct = total > 0 ? Math.round((claimed / total) * 100) : 0
  const remaining = total - claimed

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/50 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
          Quest Progress
        </div>
        {loading ? (
          <div className="skeleton-shimmer h-3 w-20 rounded-full" />
        ) : (
          <div className="text-xs text-slate-400">
            <span className="font-black text-slate-50">{claimed}</span>
            {' / '}
            <span className="font-black text-slate-50">{total}</span>
            {' tasks'}
          </div>
        )}
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
        {loading ? (
          <div className="skeleton-shimmer h-full w-full" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-lime-400/90 to-cyan-400/80 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {!loading && total > 0 && (
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{pct}% complete</span>
          {remaining > 0 && (
            <span className="text-cyan-400/70">{remaining} left to claim</span>
          )}
        </div>
      )}
    </div>
  )
}

function UnclaimedBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <Link
      href="/tasks"
      className="flex items-center justify-between rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 transition hover:bg-amber-300/10"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-amber-300">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 3.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-bold text-amber-200">
            {count} task{count !== 1 ? 's' : ''} ready to claim
          </div>
          <div className="text-[10px] text-slate-500">Earn more XP and cUSD rewards</div>
        </div>
      </div>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-amber-300/60">
        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
      </svg>
    </Link>
  )
}

function ClaimRow({ task }: { task: OnchainTask }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-lime-300/15 bg-slate-950/50 px-4 py-3 transition hover:border-lime-300/25">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lime-300/30 bg-lime-300/10 text-lime-300">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-slate-50">{task.title}</div>
        {task.tag && (
          <Badge className="mt-0.5 border border-cyan-300/30 bg-cyan-300/10 text-[10px] text-cyan-100 shadow-sm">
            {task.tag}
          </Badge>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-black text-lime-300">+{formatAmount(task.rewardXp)} XP</div>
        {parseFloat(task.rewardTokenAmount) > 0 && (
          <div className="text-xs font-semibold text-amber-300">
            +{formatAmount(task.rewardTokenAmount)} {stableTaskConfig.rewardToken.symbol}
          </div>
        )}
      </div>
    </div>
  )
}

function ClaimRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-lime-300/10 bg-slate-950/50 px-4 py-3">
      <div className="skeleton-shimmer h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton-shimmer h-4 w-40 rounded-full" />
        <div className="skeleton-shimmer h-3 w-14 rounded-full" />
      </div>
      <div className="space-y-1">
        <div className="skeleton-shimmer h-4 w-16 rounded-full" />
        <div className="skeleton-shimmer h-3 w-12 rounded-full" />
      </div>
    </div>
  )
}

export default function RewardsPage() {
  const { isConnected } = useConnection()
  const { tasks, xpBalance, isFetchingTasks, pageError, loadTasks } = useVaultTasks()
  const [showAll, setShowAll] = useState(false)

  const handleRefresh = useCallback(() => loadTasks(), [loadTasks])
  const { pullDistance, pullReady, isPulling, handlers: pullHandlers } = usePullToRefresh(
    handleRefresh,
    { disabled: isFetchingTasks },
  )

  const claimedTasks = useMemo(() => tasks.filter((task) => task.hasClaimedPoint), [tasks])
  const unclaimedTasks = useMemo(() => tasks.filter((task) => !task.hasClaimedPoint), [tasks])

  const sortedClaims = useMemo(
    () => [...claimedTasks].sort((a, b) => (a.id > b.id ? -1 : 1)),
    [claimedTasks],
  )

  const visibleClaims = showAll ? sortedClaims : sortedClaims.slice(0, 5)

  const totalClaimedXp = useMemo(() => {
    const total = claimedTasks.reduce((sum, task) => sum + safeParseUnits(task.rewardXp, 18), BigInt(0))
    return formatUnits(total, 18)
  }, [claimedTasks])

  const totalClaimedCusd = useMemo(() => {
    const total = claimedTasks.reduce(
      (sum, task) => sum + safeParseUnits(task.rewardTokenAmount, stableTaskConfig.rewardToken.decimals),
      BigInt(0),
    )
    return formatUnits(total, stableTaskConfig.rewardToken.decimals)
  }, [claimedTasks])

  const claimsListTitle = isFetchingTasks
    ? 'Claimed Tasks'
    : claimedTasks.length === 0
      ? 'Claimed Tasks'
      : `Claimed (${claimedTasks.length})`

  if (!isConnected) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-6">
        <EmptyState
          className="py-12"
          icon={
            <svg
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
              />
            </svg>
          }
          title="No wallet connected"
          description="Connect a wallet on the Tap page to track your XP, claimed rewards, and tier progress."
          action={
            <Link
              href="/tap"
              className="inline-block rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20"
            >
              Go to Tap
            </Link>
          }
        />
      </main>
    )
  }

  return (
    <div {...pullHandlers}>
      <div className="mx-auto w-full max-w-md px-5 pt-2">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            height: pullDistance,
            transition: isPulling ? 'none' : 'height 180ms ease',
          }}
        >
          <div className="flex h-full items-end justify-center pb-2 text-xs font-semibold text-lime-200">
            {isFetchingTasks ? 'Refreshing…' : pullReady ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      </div>

      <main
        className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-2"
        style={{
          transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 180ms ease',
        }}
      >
        {pageError && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {pageError}
          </p>
        )}

        <XpHero xpBalance={xpBalance} loading={isFetchingTasks} />

        {/* First-timer hero — shown instead of zero-stat cards when the user has nothing yet */}
        {!isFetchingTasks && claimedTasks.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={
              <svg viewBox="0 0 64 64" fill="none" className="mx-auto h-16 w-16" aria-hidden="true">
                {/* Coin stack */}
                <ellipse cx="32" cy="50" rx="18" ry="6" fill="rgba(251,191,36,0.18)" stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" />
                <ellipse cx="32" cy="44" rx="18" ry="6" fill="rgba(251,191,36,0.22)" stroke="rgba(251,191,36,0.55)" strokeWidth="1.5" />
                <ellipse cx="32" cy="38" rx="18" ry="6" fill="rgba(251,191,36,0.28)" stroke="rgba(251,191,36,0.65)" strokeWidth="1.5" />
                <path d="M14 38v12" stroke="rgba(251,191,36,0.4)" strokeWidth="1.5" />
                <path d="M50 38v12" stroke="rgba(251,191,36,0.4)" strokeWidth="1.5" />
                {/* Star / sparkle */}
                <path d="M32 10l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill="rgba(163,230,53,0.7)" stroke="rgba(163,230,53,0.9)" strokeWidth="0.5" strokeLinejoin="round" />
                <circle cx="48" cy="18" r="2" fill="rgba(34,211,238,0.6)" />
                <circle cx="16" cy="22" r="1.5" fill="rgba(251,191,36,0.5)" />
              </svg>
            }
            title="Complete your first task to earn cUSD"
            description={
              <span>
                Finish a quest on the{' '}
                <Link href="/tasks" className="font-bold text-cyan-300 underline underline-offset-2">
                  Quest Board
                </Link>{' '}
                and your XP + cUSD rewards will appear here.
              </span>
            }
            action={
              <>
                <Link
                  href="/tasks"
                  className="inline-block rounded-full border border-lime-300/30 bg-lime-300/15 px-5 py-2 text-xs font-bold text-lime-100 transition hover:bg-lime-300/22"
                >
                  Browse Quests
                </Link>
                <Link
                  href="/tap"
                  className="inline-block rounded-full border border-cyan-300/25 bg-cyan-300/10 px-5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/18"
                >
                  Tap for XP
                </Link>
              </>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Earned XP"
                labelColor="text-lime-200"
                borderColor="border-lime-300/20"
                value={formatAmount(totalClaimedXp)}
                sub={`from ${claimedTasks.length} task${claimedTasks.length !== 1 ? 's' : ''}`}
                loading={isFetchingTasks}
              />
              <StatCard
                label={`Earned ${stableTaskConfig.rewardToken.symbol}`}
                labelColor="text-amber-200"
                borderColor="border-amber-300/20"
                value={formatAmount(totalClaimedCusd)}
                sub="from task rewards"
                loading={isFetchingTasks}
              />
            </div>

            <ProgressSection
              claimed={claimedTasks.length}
              total={tasks.length}
              loading={isFetchingTasks}
            />
          </>
        )}

        {!isFetchingTasks && isConnected && claimedTasks.length > 0 && (
          <UnclaimedBanner count={unclaimedTasks.length} />
        )}

        {(isFetchingTasks || claimedTasks.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-base font-black text-slate-50">{claimsListTitle}</div>
              {!isFetchingTasks && sortedClaims.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAll((prev) => !prev)}
                  className="rounded-full border border-cyan-300/20 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-cyan-300/10"
                >
                  {showAll ? 'Show less' : `Show all ${sortedClaims.length}`}
                </button>
              )}
            </div>

            {isFetchingTasks && (
              <>
                <ClaimRowSkeleton />
                <ClaimRowSkeleton />
                <ClaimRowSkeleton />
              </>
            )}

            {!isFetchingTasks &&
              visibleClaims.map((task) => <ClaimRow key={task.id.toString()} task={task} />)}
          </div>
        )}
      </main>
    </div>
  )
}
