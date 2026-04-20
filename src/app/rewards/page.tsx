'use client'

import { useMemo } from 'react'
import { useConnection } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'

import { TaskCard } from '@/components/stabletask/TaskCard'
import { TaskCardSkeleton } from '@/components/stabletask/TaskCardSkeleton'
import { useVaultTasks } from '@/hooks/useVaultTasks'
import { stableTaskConfig } from '@/lib/app-config'

function safeParseUnits(value: string | undefined, decimals: number) {
  if (!value) return BigInt(0)
  try {
    return parseUnits(value, decimals)
  } catch {
    return BigInt(0)
  }
}

export default function RewardsPage() {
  const { address, isConnected, chainId } = useConnection()
  const { tasks, xpBalance, isFetchingTasks, pageError } = useVaultTasks()

  const claimedTasks = useMemo(() => tasks.filter((task) => task.hasClaimedPoint), [tasks])

  const claimedTasksNewestFirst = useMemo(() => {
    return [...claimedTasks].sort((a, b) => (a.id > b.id ? -1 : 1))
  }, [claimedTasks])

  const recentClaims = useMemo(() => claimedTasksNewestFirst.slice(0, 5), [claimedTasksNewestFirst])

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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      {pageError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {pageError}
        </p>
      )}

      <section className="space-y-4">
        <div className="rounded-[2rem] border border-emerald-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(236,253,245,0.98)_55%,rgba(209,250,229,0.96))] p-5 shadow-[0_24px_60px_rgba(16,185,129,0.12)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Rewards</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Claimed rewards live here.</h2>
          <p className="mt-2 text-sm text-slate-600">
            Totals across your claims, plus a quick view of your most recent rewards.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
              Total claimed XP
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{totalClaimedXp}</div>
            <div className="text-xs text-slate-500">from {claimedTasks.length} claims</div>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
              Total claimed cUSD
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{totalClaimedCusd}</div>
            <div className="text-xs text-slate-500">from task rewards</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-950">Last 5 claims</div>
              <div className="text-xs text-slate-500">
                XP balance: <span className="font-semibold text-slate-950">{xpBalance}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Total claims: <span className="font-semibold text-slate-950">{claimedTasks.length}</span>
            </div>
          </div>

          {isFetchingTasks && (
            <>
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </>
          )}

          {!isFetchingTasks && recentClaims.length === 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              No claimed tasks yet.
            </div>
          )}

          {recentClaims.map((task) => (
            <TaskCard
              key={task.id.toString()}
              title={task.title}
              description={task.description}
              reward={`+${task.rewardXp} XP • +${task.rewardTokenAmount} ${stableTaskConfig.rewardToken.symbol}`}
              tag={task.tag}
              visitHref={task.visitUrl}
              isVisited
              visitState="success"
              claimState="success"
              visitDisabled
              claimDisabled
              helperText="Claim recorded in rewards history."
            />
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          Status: {isConnected ? 'Connected' : 'Not connected'} · Wallet:{' '}
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet'} · Chain: {chainId ?? '—'}
        </div>
      </section>
    </main>
  )
}

