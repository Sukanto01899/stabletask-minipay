'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useConnect,
  useConnectors,
  useConnection,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { erc20Abi, formatEther, formatUnits, parseEther } from 'viem'

import { LoadingScreen } from '@/components/stabletask/LoadingScreen'
import { KanbanTaskCard } from '@/components/stabletask/KanbanTaskCard'
import { TaskCard } from '@/components/stabletask/TaskCard'
import { TaskCardSkeleton } from '@/components/stabletask/TaskCardSkeleton'
import { encodeMetadataURI, type OnchainTask, useVaultTasks } from '@/hooks/useVaultTasks'
import { stableTaskConfig } from '@/lib/app-config'

const ACTIVE_CHAIN_ID = stableTaskConfig.chain.id as 42220
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type TaskTypeOption = 'visit' | 'reading'

type PendingAction = {
  kind: 'create' | 'visit' | 'claim'
  taskId?: bigint
}

function formatCompactAmount(raw: string | null | undefined, maxFractionDigits = 2) {
  if (!raw) return '—'
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) return raw
  return numeric.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits })
}

function formatDeadlineLabel(deadline: string | undefined) {
  if (!deadline) return 'No deadline'
  const parsed = new Date(deadline)
  if (Number.isNaN(parsed.getTime())) return `Due ${deadline}`
  return `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed)}`
}

function getEthereumProvider() {
  if (typeof window === 'undefined' || !(window as Window & { ethereum?: unknown }).ethereum) {
    throw new Error('window.ethereum is required. Please run this app inside MiniPay.')
  }
  return (window as Window & { ethereum?: unknown }).ethereum
}

function useAutoConnect(isConnected: boolean) {
  const connectors = useConnectors()
  const { connect, error, isPending } = useConnect()
  const [hasAttempted, setHasAttempted] = useState(false)
  const [providerMissing, setProviderMissing] = useState(false)

  useEffect(() => {
    if (hasAttempted) return
    if (isConnected) {
      setHasAttempted(true)
      return
    }
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
      } catch (connectError) {
        const message =
          connectError instanceof Error ? connectError.message : String(connectError)
        if (!message.toLowerCase().includes('already connected')) {
          console.error('Failed to connect:', connectError)
        }
      }
      setHasAttempted(true)
    }

    void attemptConnect()
  }, [connect, connectors, hasAttempted, isConnected])

  return { error, isPending, providerMissing }
}

export default function Page() {
  const { address, isConnected, isConnecting, chainId } = useConnection()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  const { error: connectError, isPending, providerMissing } = useAutoConnect(isConnected)
  const { writeContractAsync, data: txHash, error: writeError, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError } =
    useWaitForTransactionReceipt({
      hash: txHash,
      query: { enabled: Boolean(txHash) },
    })
  const isDev = process.env.NODE_ENV === 'development'
  const { tasks, publicTaskCreationFee, isFetchingTasks, pageError, loadTasks } = useVaultTasks()
  const [localPageError, setLocalPageError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const pendingActionRef = useRef<PendingAction | null>(null)
  const [cusdBalance, setCusdBalance] = useState<string | null>(null)
  const [isFetchingBalance, setIsFetchingBalance] = useState(false)
  const [acceptedTasks, setAcceptedTasks] = useState<Record<string, true>>({})
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    visitUrl: '',
    deadline: '',
    rewardXp: '5',
    rewardTokenAmount: '0',
    taskType: 'visit' as TaskTypeOption,
  })
  const activeOnchainTasks = useMemo(() => tasks.filter((task) => task.active), [tasks])
  const visibleTasks = activeOnchainTasks.filter((task) => !task.hasClaimedPoint)
  const activeTasksCount = activeOnchainTasks.filter((task) => !task.isCompleted && !task.hasClaimedPoint).length
  const pendingPayoutsCount = activeOnchainTasks.filter((task) => task.isCompleted && !task.hasClaimedPoint).length

  const acceptedStorageKey = useMemo(() => {
    const normalizedAddress = address ? address.toLowerCase() : 'guest'
    return `stabletask:accepted:${normalizedAddress}`
  }, [address])

  useEffect(() => {
    pendingActionRef.current = pendingAction
  }, [pendingAction])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(acceptedStorageKey)
      if (!stored) {
        setAcceptedTasks({})
        return
      }
      const parsed = JSON.parse(stored) as Record<string, true>
      setAcceptedTasks(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setAcceptedTasks({})
    }
  }, [acceptedStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(acceptedStorageKey, JSON.stringify(acceptedTasks))
    } catch {
      // ignore persistence failures
    }
  }, [acceptedStorageKey, acceptedTasks])

  const acceptTask = useCallback((taskId: bigint) => {
    setAcceptedTasks((prev) => ({ ...prev, [taskId.toString()]: true }))
  }, [])

  const isTaskAccepted = useCallback(
    (taskId: bigint) => Boolean(acceptedTasks[taskId.toString()]),
    [acceptedTasks],
  )

  useEffect(() => {
    if (!isConnected || !address) {
      setCusdBalance(null)
      return
    }
    if (chainId && chainId !== ACTIVE_CHAIN_ID) return
    if (!publicClient) return

    const controller = new AbortController()

    const loadBalance = async () => {
      setIsFetchingBalance(true)
      try {
        const balanceRaw = (await publicClient.readContract({
          address: stableTaskConfig.rewardToken.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        })) as bigint

        if (controller.signal.aborted) return
        setCusdBalance(formatUnits(balanceRaw, stableTaskConfig.rewardToken.decimals))
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to load cUSD balance:', error)
        setCusdBalance(null)
      } finally {
        if (controller.signal.aborted) return
        setIsFetchingBalance(false)
      }
    }

    void loadBalance()
    return () => controller.abort()
  }, [address, chainId, isConnected, publicClient])

  useEffect(() => {
    if (!pendingAction) return
    if (isConfirmed) {
      setPendingAction(null)
      void loadTasks()
    }
  }, [isConfirmed, loadTasks, pendingAction])

  useEffect(() => {
    if (!pendingAction) return
    if (writeError || isReceiptError) {
      setLocalPageError(
        pendingAction.kind === 'create'
          ? 'Task creation failed. Please try again.'
          : pendingAction.kind === 'visit'
            ? 'Visit completion failed. Please try again.'
            : 'XP claim failed. Please try again.',
      )
      setPendingAction(null)
    }
  }, [isReceiptError, pendingAction, writeError])

  useEffect(() => {
    if (!isCreateOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingAction) {
        setIsCreateOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [isCreateOpen, pendingAction])

  const errorMessage = providerMissing
    ? 'window.ethereum is required. Please run this app inside MiniPay.'
    : isDev && connectError
      ? connectError.message
      : undefined
  const resolvedPageError = localPageError ?? pageError

  const handleVisit = useCallback(
    async (taskId: bigint, visitUrl?: string, isVisited?: boolean) => {
      if (!address || !isConnected) {
        setLocalPageError('Connect your wallet to visit and complete tasks.')
        return
      }
      if (stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
        setLocalPageError('Set your vault address in src/lib/contracts.ts before using tasks.')
        return
      }
      if (chainId !== ACTIVE_CHAIN_ID) {
        setLocalPageError(`Switch to ${stableTaskConfig.chain.name} to continue.`)
        return
      }
      if (pendingActionRef.current || isVisited) return

      if (visitUrl) {
        window.open(visitUrl, '_blank', 'noopener,noreferrer')
      }

      setLocalPageError(null)
      setPendingAction({ kind: 'visit', taskId })

      try {
        await writeContractAsync({
          address: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'selfCompleteTask',
          args: [taskId],
          chainId: ACTIVE_CHAIN_ID,
        })
      } catch (visitError) {
        console.error('Visit completion failed:', visitError)
        setLocalPageError('Visit completion failed. Please try again.')
        setPendingAction(null)
      }
    },
    [address, chainId, isConnected, writeContractAsync],
  )

  const handleClaim = useCallback(
    async (taskId: bigint, isVisited?: boolean, isClaimed?: boolean) => {
      if (!address || !isConnected) {
        setLocalPageError('Connect your wallet to claim XP.')
        return
      }
      if (stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
        setLocalPageError('Set your vault address in src/lib/contracts.ts before using tasks.')
        return
      }
      if (chainId !== ACTIVE_CHAIN_ID) {
        setLocalPageError(`Switch to ${stableTaskConfig.chain.name} to claim XP.`)
        return
      }
      if (pendingActionRef.current || isClaimed || !isVisited) return

      setLocalPageError(null)
      setPendingAction({ kind: 'claim', taskId })

      try {
        await writeContractAsync({
          address: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'claimTaskPoint',
          args: [taskId],
          chainId: ACTIVE_CHAIN_ID,
        })
      } catch (claimError) {
        console.error('Claim failed:', claimError)
        setLocalPageError('XP claim failed. Please try again.')
        setPendingAction(null)
      }
    },
    [address, chainId, isConnected, writeContractAsync],
  )

  const handleVisitTask = useCallback(
    (taskId: bigint | number | string, visitUrl?: string, isVisited?: boolean) => {
      if (typeof taskId !== 'bigint') return
      return handleVisit(taskId, visitUrl, isVisited)
    },
    [handleVisit],
  )

  const handleClaimTask = useCallback(
    (taskId: bigint | number | string, isVisited?: boolean, isClaimed?: boolean) => {
      if (typeof taskId !== 'bigint') return
      return handleClaim(taskId, isVisited, isClaimed)
    },
    [handleClaim],
  )

  const openTasks = visibleTasks.filter((task) => !task.isCompleted && !isTaskAccepted(task.id))
  const inProgressTasks = visibleTasks.filter((task) => !task.isCompleted && isTaskAccepted(task.id))
  const doneTasks = visibleTasks.filter((task) => task.isCompleted)

  const handleCreateTask = async () => {
    const trimmedTitle = newTask.title.trim()
    const trimmedDescription = newTask.description.trim()
    const trimmedVisitUrl = newTask.visitUrl.trim()
    const trimmedDeadline = newTask.deadline.trim()
    const xpReward = Number(newTask.rewardXp)
    const rewardTokenAmount = Number(newTask.rewardTokenAmount)

    if (!trimmedTitle || !trimmedDescription || !trimmedVisitUrl) {
      setCreateError('Title, description, and visit URL are required.')
      return
    }
    if (!/^https?:\/\//i.test(trimmedVisitUrl)) {
      setCreateError('Visit URL must start with http:// or https://.')
      return
    }
    if (!Number.isFinite(xpReward) || xpReward <= 0) {
      setCreateError('XP reward must be greater than 0.')
      return
    }
    if (!Number.isFinite(rewardTokenAmount) || rewardTokenAmount < 0) {
      setCreateError('Reward token amount must be 0 or greater.')
      return
    }
    if (!address || !isConnected) {
      setCreateError('Connect your wallet to create a task.')
      return
    }
    if (stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
      setCreateError('Set your vault address in src/lib/contracts.ts first.')
      return
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setCreateError(`Switch to ${stableTaskConfig.chain.name} to create tasks.`)
      return
    }

    setCreateError(null)
    setLocalPageError(null)
    setPendingAction({ kind: 'create' })

    try {
      await writeContractAsync(
        {
          address: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'createPublicTask',
          args: [
            newTask.taskType === 'visit' ? 0 : 2,
            parseEther(newTask.rewardXp),
            parseEther(newTask.rewardTokenAmount),
            encodeMetadataURI({
              title: trimmedTitle,
              description: trimmedDescription,
              visitUrl: trimmedVisitUrl,
              deadline: trimmedDeadline || undefined,
            }),
          ],
          value: publicTaskCreationFee,
          chainId: ACTIVE_CHAIN_ID,
        } as never,
      )
      setNewTask({
        title: '',
        description: '',
        visitUrl: '',
        deadline: '',
        rewardXp: '5',
        rewardTokenAmount: '0',
        taskType: 'visit',
      })
      setIsCreateOpen(false)
    } catch (creationError) {
      console.error('Task creation failed:', creationError)
      setCreateError('Task creation failed. Please try again.')
      setPendingAction(null)
    }
  }

  if ((isConnecting || isPending) && !isConnected) {
    return (
      <LoadingScreen
        title="Connecting wallet..."
        subtitle="Preparing your wallet session for onchain tasks."
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
        {resolvedPageError && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {resolvedPageError}
          </p>
        )}

        <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(224,242,254,0.98)_60%,rgba(191,219,254,0.95))] px-5 py-5 shadow-[0_24px_60px_rgba(37,99,235,0.14)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-cyan-300/25 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
                Stable Task
              </div>
              <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-slate-950">
                Your dashboard
              </h2>
              <p className="mt-2 max-w-[16rem] text-sm text-slate-600">
                Balance, active tasks, and payouts at a glance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateError(null)
                setIsCreateOpen(true)
              }}
              className="h-11 shrink-0 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(37,99,235,0.25)] transition hover:bg-blue-700 disabled:opacity-60"
              disabled={!isConnected}
            >
              Create Task
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">
                Balance (cUSD)
              </div>
              <div className="mt-1 text-xl font-bold text-slate-950">
                {isFetchingBalance ? '...' : formatCompactAmount(cusdBalance, 2)}
              </div>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">
                Active tasks
              </div>
              <div className="mt-1 text-xl font-bold text-slate-950">{activeTasksCount}</div>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">
                Pending payouts
              </div>
              <div className="mt-1 text-xl font-bold text-slate-950">{pendingPayoutsCount}</div>
            </div>
          </div>

          <div className="relative mt-3 rounded-2xl border border-blue-100/80 bg-white/60 px-4 py-3 text-sm text-slate-600 backdrop-blur">
            Public task fee:{' '}
            <span className="font-semibold text-slate-950">
              {formatEther(publicTaskCreationFee)} CELO
            </span>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Task Board</h2>
            <div className="text-xs text-slate-500">Open → In progress → Done</div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-1">
            <div className="w-72 shrink-0 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-blue-200/60 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900 backdrop-blur">
                <span>Open</span>
                <span className="text-xs font-semibold text-blue-700">{openTasks.length}</span>
              </div>
              <div className="grid gap-3">
                {openTasks.length === 0 && (
                  <div className="rounded-2xl border border-blue-200/60 bg-white/70 px-4 py-3 text-xs text-slate-500 backdrop-blur">
                    No open tasks.
                  </div>
                )}
                {openTasks.map((task) => (
                  <KanbanTaskCard
                    key={task.id.toString()}
                    title={task.title}
                    reward={`${formatCompactAmount(task.rewardTokenAmount)} ${stableTaskConfig.rewardToken.symbol}`}
                    deadlineLabel={formatDeadlineLabel(task.deadline)}
                    actionLabel="Accept"
                    onAction={() => acceptTask(task.id)}
                    actionDisabled={!isConnected}
                  />
                ))}
              </div>
            </div>

            <div className="w-72 shrink-0 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-blue-200/60 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900 backdrop-blur">
                <span>In progress</span>
                <span className="text-xs font-semibold text-blue-700">{inProgressTasks.length}</span>
              </div>
              <div className="grid gap-3">
                {inProgressTasks.length === 0 && (
                  <div className="rounded-2xl border border-blue-200/60 bg-white/70 px-4 py-3 text-xs text-slate-500 backdrop-blur">
                    Accept a task to start.
                  </div>
                )}
                {inProgressTasks.map((task) => (
                  <KanbanTaskCard
                    key={task.id.toString()}
                    title={task.title}
                    reward={`${formatCompactAmount(task.rewardTokenAmount)} ${stableTaskConfig.rewardToken.symbol}`}
                    deadlineLabel={formatDeadlineLabel(task.deadline)}
                    actionLabel="Mark done"
                    onAction={() => handleVisitTask(task.id, task.visitUrl, task.isCompleted)}
                    actionDisabled={!isConnected || Boolean(pendingAction)}
                  />
                ))}
              </div>
            </div>

            <div className="w-72 shrink-0 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-blue-200/60 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900 backdrop-blur">
                <span>Done</span>
                <span className="text-xs font-semibold text-blue-700">{doneTasks.length}</span>
              </div>
              <div className="grid gap-3">
                {doneTasks.length === 0 && (
                  <div className="rounded-2xl border border-blue-200/60 bg-white/70 px-4 py-3 text-xs text-slate-500 backdrop-blur">
                    Finish a task to see it here.
                  </div>
                )}
                {doneTasks.map((task) => (
                  <KanbanTaskCard
                    key={task.id.toString()}
                    title={task.title}
                    reward={`${formatCompactAmount(task.rewardTokenAmount)} ${stableTaskConfig.rewardToken.symbol}`}
                    deadlineLabel={formatDeadlineLabel(task.deadline)}
                    actionLabel="Done"
                    actionDisabled
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Task List</h2>
            <button
              type="button"
              onClick={() => {
                setCreateError(null)
                setIsCreateOpen(true)
              }}
              className="rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Create Task
            </button>
          </div>
          <div className="grid gap-4">
            {isFetchingTasks && (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            )}
            {!isFetchingTasks && visibleTasks.length === 0 && (
              <div className="rounded-[1.75rem] border border-blue-200/70 bg-white/80 px-4 py-5 text-sm text-slate-500 shadow-sm">
                No active vault tasks right now. Claimed items now appear in the Rewards tab.
              </div>
            )}
            {visibleTasks.map((task) => {
              const isPendingThisTask = pendingAction?.taskId === task.id
              const visitState =
                isPendingThisTask && pendingAction?.kind === 'visit'
                  ? 'pending'
                  : task.isCompleted
                    ? 'success'
                    : 'idle'
              const claimState =
                isPendingThisTask && pendingAction?.kind === 'claim'
                  ? 'pending'
                  : task.hasClaimedPoint
                    ? 'success'
                    : 'idle'
              const helperText = task.isCompleted
                ? `Ready to claim ${task.rewardXp} XP.`
                : 'Visit first to enable the XP claim.'

              return (
                <TaskCard
                  key={task.id.toString()}
                  taskId={task.id}
                  title={task.title}
                  description={task.description}
                  reward={`${task.rewardXp} XP`}
                  tag={task.tag}
                  visitHref={task.visitUrl}
                  onVisit={handleVisitTask}
                  onClaim={handleClaimTask}
                  isVisited={task.isCompleted}
                  visitState={visitState}
                  claimState={claimState}
                  visitDisabled={Boolean(pendingAction) || isWritePending || isConfirming}
                  claimDisabled={Boolean(pendingAction) || isWritePending || isConfirming || !task.isCompleted}
                  helperText={helperText}
                />
              )
            })}
          </div>
        </section>

      </main>

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-4 pb-4 pt-10 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (!pendingAction) {
              setIsCreateOpen(false)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[2rem] border border-blue-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.98))] p-5 shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Create a task</div>
                <div className="mt-1 text-xs text-slate-500">
                  Create a public visit or reading task directly in the vault.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Onchain
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={Boolean(pendingAction)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-white text-lg text-slate-500 transition hover:bg-blue-50 disabled:opacity-60"
                  aria-label="Close create task modal"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
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
              <input
                value={newTask.visitUrl}
                onChange={(event) =>
                  setNewTask((prev) => ({
                    ...prev,
                    visitUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/task"
                className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
              />
              <input
                value={newTask.deadline}
                onChange={(event) =>
                  setNewTask((prev) => ({
                    ...prev,
                    deadline: event.target.value,
                  }))
                }
                type="date"
                className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
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
                  <option value="reading">Reading task</option>
                </select>
                <input
                  value={newTask.rewardXp}
                  onChange={(event) =>
                    setNewTask((prev) => ({
                      ...prev,
                      rewardXp: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="5"
                  className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
                />
              </div>
              <input
                value={newTask.rewardTokenAmount}
                onChange={(event) =>
                  setNewTask((prev) => ({
                    ...prev,
                    rewardTokenAmount: event.target.value,
                  }))
                }
                inputMode="decimal"
                placeholder="Optional external reward amount"
                className="h-11 rounded-2xl border border-blue-200 bg-slate-50/80 px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
              />
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-slate-600">
                Users can create, visit, and claim vault XP here. External reward-token payouts still remain owner-only in the current contract.
              </div>
              {createError && <p className="text-xs text-destructive">{createError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={Boolean(pendingAction)}
                  className="h-11 rounded-2xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={Boolean(pendingAction)}
                  className="h-11 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {pendingAction?.kind === 'create' ? 'Creating...' : 'Save task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
