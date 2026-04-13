'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConnect, useConnectors, useConnection, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { erc20Abi, parseUnits } from 'viem'

import { LoadingScreen } from '@/components/stabletask/LoadingScreen'
import { ReferralCard } from '@/components/stabletask/ReferralCard'
import { TaskCard } from '@/components/stabletask/TaskCard'
import { stableTaskConfig } from '@/lib/app-config'
import {
  getFingerprint,
  getLastClaim,
  getSuspiciousCount,
  hasClaimedTask,
  loadFraudStore,
  recordClaim,
  recordSuspicious,
  saveFraudStore,
  type FraudStore,
} from '@/lib/fraud'

const tasks = [
  {
    id: 'daily-checkin',
    title: 'Daily Stability Check-in',
    description: 'Confirm your savings goal for today and earn instant cUSD.',
    reward: '1.25',
    tag: 'Daily',
  },
  {
    id: 'invite-friend',
    title: 'Invite a Friend',
    description: 'Send your referral link and help a friend start earning.',
    reward: '3.00',
    tag: 'Boost',
  },
  {
    id: 'learn-earn',
    title: 'Learn & Earn: Stablecoins 101',
    description: 'Complete the 3-minute lesson to unlock your reward.',
    reward: '2.40',
    tag: 'Learn',
  },
]

const CLAIM_STORAGE_KEY = 'stabletask.claimedTasks'
const CUSTOM_TASKS_STORAGE_KEY = 'stabletask.customTasks'
const COOLDOWN_MS = 24 * 60 * 60 * 1000
const ACTIVE_CHAIN_ID = stableTaskConfig.chain.id as 42220 | 11142220

type TaskTypeOption = 'visit' | 'daily' | 'reading'

type TaskItem = {
  id: string
  title: string
  description: string
  reward: string
  tag: string
  taskType?: TaskTypeOption
  isCustom?: boolean
}

function getEthereumProvider() {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('window.ethereum is required. Please run this app inside MiniPay.')
  }
  return (window as any).ethereum
}

function useAutoConnect() {
  const connectors = useConnectors()
  const { connect, error, isPending } = useConnect()
  const [hasAttempted, setHasAttempted] = useState(false)
  const [providerMissing, setProviderMissing] = useState(false)

  useEffect(() => {
    if (hasAttempted) return
    try {
      getEthereumProvider()
    } catch {
      setProviderMissing(true)
      setHasAttempted(true)
      return
    }
    const [primaryConnector] = connectors
    if (!primaryConnector) return

    const attemptConnect = async () => {
      try {
        await connect({ connector: primaryConnector })
      } catch (err) {
        console.error('Failed to connect:', err)
      }
      setHasAttempted(true)
    }

    attemptConnect()
  }, [connectors, connect, hasAttempted])

  return { error, isPending, providerMissing }
}

function loadClaimedTasks(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CLAIM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadCustomTasks(): TaskItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_TASKS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Page() {
  const { address, isConnected, isConnecting, chainId } = useConnection()
  const { error: connectError, isPending, providerMissing } = useAutoConnect()
  const { writeContractAsync, data: claimHash, error: writeError, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError } =
    useWaitForTransactionReceipt({
      hash: claimHash,
      query: { enabled: Boolean(claimHash) },
    })

  const isDev = process.env.NODE_ENV === 'development'
  const [claimedTasks, setClaimedTasks] = useState<string[]>([])
  const [activeClaimTaskId, setActiveClaimTaskId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [failedTaskId, setFailedTaskId] = useState<string | null>(null)
  const [fraudStore, setFraudStore] = useState<FraudStore>(() => ({ claims: [], suspicious: {} }))
  const [customTasks, setCustomTasks] = useState<TaskItem[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    reward: '0.10',
    taskType: 'visit' as TaskTypeOption,
  })

  useEffect(() => {
    setClaimedTasks(loadClaimedTasks())
    setFraudStore(loadFraudStore())
    setCustomTasks(loadCustomTasks())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(claimedTasks))
  }, [claimedTasks])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CUSTOM_TASKS_STORAGE_KEY, JSON.stringify(customTasks))
  }, [customTasks])

  useEffect(() => {
    saveFraudStore(fraudStore)
  }, [fraudStore])

  useEffect(() => {
    if (!address) return
    const walletClaims = fraudStore.claims.filter(
      (claim) => claim.wallet.toLowerCase() === address.toLowerCase(),
    )
    setClaimedTasks(walletClaims.map((claim) => claim.taskId))
  }, [fraudStore, address])

  useEffect(() => {
    if (!activeClaimTaskId) return
    if (isConfirmed) {
      setClaimedTasks((prev) => (prev.includes(activeClaimTaskId) ? prev : [...prev, activeClaimTaskId]))
      setActiveClaimTaskId(null)
    }
  }, [isConfirmed, activeClaimTaskId])

  useEffect(() => {
    if (!activeClaimTaskId) return
    if (writeError || isReceiptError) {
      setClaimError('Claim failed. Please try again.')
      setFailedTaskId(activeClaimTaskId)
      setActiveClaimTaskId(null)
    }
  }, [writeError, isReceiptError, activeClaimTaskId])

  const errorMessage = providerMissing
    ? 'window.ethereum is required. Please run this app inside MiniPay.'
    : isDev && connectError
      ? connectError.message
      : undefined

  const handleClaim = async (taskId: string) => {
    if (!address || !isConnected) {
      setClaimError('Connect your wallet to claim rewards.')
      return
    }
    if (claimedTasks.includes(taskId) || activeClaimTaskId) return

    const fingerprint = getFingerprint(address)
    const lastClaim = getLastClaim(fraudStore, fingerprint)
    const alreadyClaimed = hasClaimedTask(fraudStore, address, taskId)
    const suspiciousCount = getSuspiciousCount(fraudStore, fingerprint)

    if (suspiciousCount >= 3) {
      setClaimError('Claims disabled due to suspicious activity.')
      return
    }

    if (alreadyClaimed) {
      setClaimError('This task has already been claimed for this wallet.')
      setFraudStore((prev) => recordSuspicious(prev, fingerprint))
      return
    }

    if (lastClaim && Date.now() - lastClaim.timestamp < COOLDOWN_MS) {
      setClaimError('Cooldown active. Try again in 24 hours.')
      setFraudStore((prev) => recordSuspicious(prev, fingerprint))
      return
    }

    if (chainId !== ACTIVE_CHAIN_ID) {
      setClaimError(`Switch to ${stableTaskConfig.chain.name} to claim rewards.`)
      return
    }

    setClaimError(null)
    setFailedTaskId(null)
    setActiveClaimTaskId(taskId)

    await new Promise((resolve) => setTimeout(resolve, 600))

    try {
      await writeContractAsync({
        address: stableTaskConfig.rewardToken.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [address, parseUnits('0.1', stableTaskConfig.rewardToken.decimals)],
        chainId: ACTIVE_CHAIN_ID,
      })
      setFraudStore((prev) =>
        recordClaim(prev, {
          taskId,
          wallet: address,
          fingerprint,
          timestamp: Date.now(),
        }),
      )
    } catch (err) {
      console.error('Claim failed:', err)
      setClaimError('Claim failed. Please try again.')
      setFailedTaskId(taskId)
      setActiveClaimTaskId(null)
    }
  }

  const claimStatus = useMemo(() => {
    if (!activeClaimTaskId) return undefined
    if (isWritePending || isConfirming) return 'pending'
    if (writeError || isReceiptError) return 'error'
    if (isConfirmed) return 'success'
    return 'pending'
  }, [activeClaimTaskId, isWritePending, isConfirming, writeError, isReceiptError, isConfirmed])

  const suspiciousCount = useMemo(() => {
    if (!address) return 0
    return getSuspiciousCount(fraudStore, getFingerprint(address))
  }, [fraudStore, address])

  const allTasks = useMemo<TaskItem[]>(() => [...customTasks, ...tasks], [customTasks])

  const handleCreateTask = () => {
    const trimmedTitle = newTask.title.trim()
    const trimmedDescription = newTask.description.trim()
    const rewardValue = Number(newTask.reward)

    if (!trimmedTitle || !trimmedDescription) {
      setCreateError('Title and description are required.')
      return
    }
    if (!Number.isFinite(rewardValue) || rewardValue <= 0) {
      setCreateError('Reward must be greater than 0.')
      return
    }

    const tagMap: Record<TaskTypeOption, string> = {
      visit: 'Visit',
      daily: 'Daily',
      reading: 'Reading',
    }

    setCustomTasks((prev) => [
      {
        id: `custom-${Date.now()}`,
        title: trimmedTitle,
        description: trimmedDescription,
        reward: rewardValue.toFixed(2),
        tag: tagMap[newTask.taskType],
        taskType: newTask.taskType,
        isCustom: true,
      },
      ...prev,
    ])
    setNewTask({
      title: '',
      description: '',
      reward: '0.10',
      taskType: 'visit',
    })
    setCreateError(null)
    setIsCreateOpen(false)
  }

  if ((isConnecting || isPending) && !isConnected) {
    return (
      <LoadingScreen
        title="Connecting wallet..."
        subtitle="Preparing your wallet session for rewards."
        debug={
          isDev
            ? {
                connected: isConnected,
                chainId: chainId ?? undefined,
              }
            : undefined
        }
      />
    )
  }

  return (
    <div>
      {isDev && (
        <div className="fixed bottom-20 left-4 z-50 rounded-full border border-blue-200/70 bg-white/90 px-3 py-1 text-xs shadow">
          <span>connected: {isConnected ? 'yes' : 'no'}</span>
          <span className="mx-2 text-muted-foreground">|</span>
          <span>chainId: {chainId ?? '—'}</span>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
        {errorMessage && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {errorMessage}
          </p>
        )}

        <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(224,242,254,0.98)_60%,rgba(191,219,254,0.95))] px-5 py-5 shadow-[0_24px_60px_rgba(37,99,235,0.14)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-cyan-300/25 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">Today&apos;s Pulse</div>
              <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-slate-950">
                Earn steady cUSD with brighter daily actions.
              </h2>
              <p className="mt-2 max-w-[16rem] text-sm text-slate-600">
                Pick a task, submit the claim, and keep your rewards flow active on Celo.
              </p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 px-4 py-3 text-right shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">Available</div>
              <div className="mt-1 text-2xl font-bold text-blue-700">{allTasks.length}</div>
              <div className="text-xs text-slate-500">tasks</div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Task List</h2>
            <button
              type="button"
              onClick={() => setIsCreateOpen((prev) => !prev)}
              className="rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              {isCreateOpen ? 'Close' : 'Create Task'}
            </button>
          </div>
          {isCreateOpen && (
            <div className="space-y-3 rounded-[1.75rem] border border-blue-200/70 bg-white/85 p-4 shadow-[0_18px_50px_rgba(59,130,246,0.08)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Create a task</div>
                  <div className="text-xs text-slate-500">
                    Add a visit, daily claim, or reading task to this wallet.
                  </div>
                </div>
                <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Local
                </div>
              </div>
              <div className="grid gap-3">
                <input
                  value={newTask.title}
                  onChange={(event) =>
                    setNewTask((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Task title"
                  className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
                />
                <textarea
                  value={newTask.description}
                  onChange={(event) =>
                    setNewTask((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe what the user must do"
                  rows={3}
                  className="rounded-2xl border border-blue-200 bg-slate-50/80 px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
                />
                <div className="grid grid-cols-[1fr_112px] gap-3">
                  <select
                    value={newTask.taskType}
                    onChange={(event) =>
                      setNewTask((prev) => ({
                        ...prev,
                        taskType: event.target.value as TaskTypeOption,
                      }))
                    }
                    className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="visit">Visit task</option>
                    <option value="daily">Daily claim</option>
                    <option value="reading">Reading task</option>
                  </select>
                  <input
                    value={newTask.reward}
                    onChange={(event) =>
                      setNewTask((prev) => ({
                        ...prev,
                        reward: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="0.10"
                    className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
                  />
                </div>
                {createError && <p className="text-xs text-destructive">{createError}</p>}
                <button
                  type="button"
                  onClick={handleCreateTask}
                  className="h-11 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Save task
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-4">
            {allTasks.map((task) => {
              const isClaimed = claimedTasks.includes(task.id)
              const isActive = activeClaimTaskId === task.id
              const status = isActive
                ? claimStatus
                : isClaimed
                  ? 'success'
                  : failedTaskId === task.id
                    ? 'error'
                    : 'idle'
              const helperText =
                status === 'success'
                  ? 'Reward claimed.'
                  : status === 'pending'
                    ? 'Submitting reward...'
                    : status === 'error'
                      ? claimError ?? 'Claim failed.'
                      : undefined
              const disableForFraud = suspiciousCount >= 3

              return (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  description={task.description}
                  reward={task.reward}
                  tag={task.tag}
                  onClaim={() => handleClaim(task.id)}
                  claimState={status}
                  claimDisabled={Boolean(activeClaimTaskId) || isWritePending || isConfirming || disableForFraud}
                  helperText={helperText}
                />
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-950">Referral</h2>
          <ReferralCard code="STABLE-5X2P" reward="0.75" />
        </section>
      </main>
    </div>
  )
}
