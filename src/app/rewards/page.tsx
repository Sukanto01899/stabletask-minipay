'use client'

import { useConnection } from 'wagmi'

import { TaskCard } from '@/components/stabletask/TaskCard'
import { TaskCardSkeleton } from '@/components/stabletask/TaskCardSkeleton'
import { useVaultTasks } from '@/hooks/useVaultTasks'

export default function RewardsPage() {
  const { address, isConnected, chainId } = useConnection()
  const { tasks, xpBalance, isFetchingTasks, pageError } = useVaultTasks()
  const claimedTasks = tasks.filter((task) => task.hasClaimedPoint)

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
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Claimed vault XP lives here.</h2>
          <p className="mt-2 text-sm text-slate-600">
            Finished and paid-out vault tasks move out of the task list and into this reward history.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">Earned XP</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{xpBalance}</div>
            <div className="text-xs text-slate-500">claimed from vault tasks</div>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">XP Claimed</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{claimedTasks.length}</div>
            <div className="text-xs text-slate-500">task rewards paid out</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-lg font-semibold text-slate-950">Reward History</div>
          {isFetchingTasks && (
            <>
              <TaskCardSkeleton />
              <TaskCardSkeleton />
            </>
          )}
          {!isFetchingTasks && claimedTasks.length === 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              No claimed vault tasks yet.
            </div>
          )}
          {claimedTasks.map((task) => (
            <TaskCard
              key={task.id.toString()}
              title={task.title}
              description={task.description}
              reward={`${task.rewardXp} XP`}
              tag={task.tag}
              visitHref={task.visitUrl}
              isVisited
              visitState="success"
              claimState="success"
              visitDisabled
              claimDisabled
              helperText="XP claimed and moved to rewards history."
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
