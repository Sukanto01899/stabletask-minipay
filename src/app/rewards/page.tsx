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

export default function RewardsPage() {
  const { isConnected } = useConnection()
  const { tasks, xpBalance, isFetchingTasks, pageError } = useVaultTasks()

  const claimedTasks = useMemo(() => tasks.filter((task) => task.hasClaimedPoint), [tasks])

  const recentClaims = useMemo(
    () => [...claimedTasks].sort((a, b) => (a.id > b.id ? -1 : 1)).slice(0, 5),
    [claimedTasks],
  )

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
    ? 'Recent Claims'
    : recentClaims.length === 0
      ? 'Recent Claims'
      : recentClaims.length === 1
        ? 'Last claim'
        : `Last ${recentClaims.length} claims`

  const claimCountSub = isFetchingTasks
    ? 'loading…'
    : `from ${claimedTasks.length} claim${claimedTasks.length !== 1 ? 's' : ''}`

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      {pageError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {pageError}
        </p>
      )}

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Total claimed XP"
            labelColor="text-lime-200"
            borderColor="border-lime-300/20"
            value={totalClaimedXp}
            sub={claimCountSub}
            loading={isFetchingTasks}
          />
          <StatCard
            label="Total claimed cUSD"
            labelColor="text-amber-200"
            borderColor="border-amber-300/20"
            value={totalClaimedCusd}
            sub="from task rewards"
            loading={isFetchingTasks}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-black text-slate-50">{claimsListTitle}</div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>XP balance:</span>
                {isFetchingTasks ? (
                  <span className="skeleton-shimmer inline-block h-3 w-14 rounded-full align-middle" />
                ) : (
                  <span className="font-black text-lime-100">{xpBalance}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>Total claims:</span>
              {isFetchingTasks ? (
                <span className="skeleton-shimmer inline-block h-3 w-6 rounded-full align-middle" />
              ) : (
                <span className="font-black text-slate-50">{claimedTasks.length}</span>
              )}
            </div>
          </div>

          {isFetchingTasks && (
            <>
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </>
          )}

          {!isFetchingTasks && recentClaims.length === 0 && (
            <div className="game-panel rounded-xl p-4 text-sm text-slate-400">
              {isConnected
                ? 'No claimed tasks yet.'
                : 'Connect a wallet to see your claimed tasks.'}
            </div>
          )}

          {!isFetchingTasks &&
            recentClaims.map((task) => (
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
      </section>
    </main>
  )
}
