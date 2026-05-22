'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useConnection } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'

import { useVaultTasks, type OnchainTask } from '@/hooks/useVaultTasks'
import { stableTaskConfig } from '@/lib/app-config'
import { Badge } from '@/components/ui/badge'

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
          <span className="text-4xl font-black tabular-nums leading-none text-slate-50">
            {formatAmount(xpBalance)}
          </span>
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
          <div className="mt-1 text-right text-[10px] text-slate-600">{levelPct}% to {nextTier?.label}</div>
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
  const { tasks, xpBalance, isFetchingTasks, pageError } = useVaultTasks()
  const [showAll, setShowAll] = useState(false)

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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">
      {pageError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {pageError}
        </p>
      )}

      <XpHero xpBalance={xpBalance} loading={isFetchingTasks} />

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

      {!isFetchingTasks && isConnected && (
        <UnclaimedBanner count={unclaimedTasks.length} />
      )}

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

        {!isFetchingTasks && claimedTasks.length === 0 && (
          <div className="game-panel rounded-xl px-4 py-8 text-center">
            <svg
              className="mx-auto h-10 w-10 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
              />
            </svg>
            <div className="mt-3 text-sm font-bold text-slate-200">No claimed tasks yet</div>
            <div className="mt-1 text-xs text-slate-400">
              {isConnected
                ? 'Complete tasks to earn XP and cUSD rewards.'
                : 'Connect a wallet to track your rewards.'}
            </div>
            {isConnected && (
              <Link
                href="/tasks"
                className="mt-4 inline-block rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20"
              >
                Browse Tasks
              </Link>
            )}
          </div>
        )}

        {!isFetchingTasks &&
          visibleClaims.map((task) => <ClaimRow key={task.id.toString()} task={task} />)}
      </div>
    </main>
  )
}
