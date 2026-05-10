'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import Link from 'next/link'
import {
  useConnect,
  useConnectors,
  useConnection,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { erc20Abi, formatEther, formatUnits, parseEther, parseUnits } from 'viem'

import { LoadingScreen } from '@/components/stabletask/LoadingScreen'
import { TaskCard } from '@/components/stabletask/TaskCard'
import { TaskCardSkeleton } from '@/components/stabletask/TaskCardSkeleton'
import { useToast } from '@/components/ui/toast'
import { encodeMetadataURI, type OnchainTask, useVaultTasks } from '@/hooks/useVaultTasks'
import { stableTaskConfig } from '@/lib/app-config'
import { readTaskViewPreferences, taskViewPreferencesStorageKey, type TaskViewPreferences } from '@/lib/task-view-preferences'

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

function parseLocalDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(year, month - 1, day)
}

function isDeadlineOverdue(deadline: string | undefined) {
  if (!deadline) return false
  const deadlineDate = parseLocalDateOnly(deadline) ?? new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadlineDate.setHours(0, 0, 0, 0)
  return deadlineDate.getTime() < today.getTime()
}

function getEthereumProvider() {
  if (typeof window === 'undefined' || !(window as Window & { ethereum?: unknown }).ethereum) {
    throw new Error('window.ethereum is required. Please run this app inside MiniPay.')
  }
  return (window as Window & { ethereum?: unknown }).ethereum
}

async function estimateCeloGasFee(args: {
  publicClient: ReturnType<typeof usePublicClient>
  account: `0x${string}`
  to: `0x${string}`
  abi: readonly unknown[]
  functionName: string
  functionArgs: readonly unknown[]
  value?: bigint
}) {
  const { publicClient, account, to, abi, functionName, functionArgs, value } = args
  if (!publicClient) return null

  try {
    const gas = (await publicClient.estimateContractGas({
      address: to,
      abi,
      functionName: functionName as never,
      args: functionArgs as never,
      account,
      value,
    })) as bigint

    let gasPrice: bigint
    try {
      const fees = (await publicClient.estimateFeesPerGas()) as { maxFeePerGas?: bigint } | null
      gasPrice = fees?.maxFeePerGas ?? ((await publicClient.getGasPrice()) as bigint)
    } catch {
      gasPrice = (await publicClient.getGasPrice()) as bigint
    }

    const fee = gas * gasPrice
    return {
      gas,
      gasPrice,
      fee,
      feeFormatted: formatEther(fee),
    }
  } catch {
    return null
  }
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
  const { toast } = useToast()
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
  const [pinnedTasks, setPinnedTasks] = useState<Record<string, true>>({})
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({})
  const [taskViewPrefs, setTaskViewPrefs] = useState<TaskViewPreferences>({
    hideCompleted: false,
    showOnlyAccepted: false,
    sortByDeadline: false,
  })
  const [createGasFeeEstimate, setCreateGasFeeEstimate] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullReady, setPullReady] = useState(false)
  const pullStartYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    visitUrl: '',
    deadline: '',
    rewardXp: '5',
    rewardTokenAmount: '0.01',
    maxClaims: '1',
    taskType: 'visit' as TaskTypeOption,
  })
  const activeOnchainTasks = useMemo(
    () => tasks.filter((task) => task.active && (task.maxClaims === BigInt(0) || task.claimCount < task.maxClaims)),
    [tasks],
  )
  const baseVisibleTasks = activeOnchainTasks.filter((task) => !task.hasClaimedPoint)
  const activeTasksCount = activeOnchainTasks.filter((task) => !task.isCompleted && !task.hasClaimedPoint).length
  const pendingPayoutsCount = activeOnchainTasks.filter((task) => task.isCompleted && !task.hasClaimedPoint).length

  const acceptedStorageKey = useMemo(() => {
    const normalizedAddress = address ? address.toLowerCase() : 'guest'
    return `stabletask:accepted:${normalizedAddress}`
  }, [address])

  const pinnedStorageKey = useMemo(() => {
    const normalizedAddress = address ? address.toLowerCase() : 'guest'
    return `stabletask:pinned:${normalizedAddress}`
  }, [address])

  const notesStorageKey = useMemo(() => {
    const normalizedAddress = address ? address.toLowerCase() : 'guest'
    return `stabletask:notes:${normalizedAddress}`
  }, [address])

  const taskViewPrefsKey = useMemo(() => taskViewPreferencesStorageKey(address), [address])

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(pinnedStorageKey)
      if (!stored) {
        setPinnedTasks({})
        return
      }
      const parsed = JSON.parse(stored) as Record<string, true>
      setPinnedTasks(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setPinnedTasks({})
    }
  }, [pinnedStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(pinnedStorageKey, JSON.stringify(pinnedTasks))
    } catch {
      // ignore persistence failures
    }
  }, [pinnedStorageKey, pinnedTasks])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(notesStorageKey)
      if (!stored) {
        setTaskNotes({})
        return
      }
      const parsed = JSON.parse(stored) as Record<string, string>
      setTaskNotes(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setTaskNotes({})
    }
  }, [notesStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(notesStorageKey, JSON.stringify(taskNotes))
    } catch {
      // ignore persistence failures
    }
  }, [notesStorageKey, taskNotes])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setTaskViewPrefs(readTaskViewPreferences(window.localStorage.getItem(taskViewPrefsKey)))
  }, [taskViewPrefsKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(taskViewPrefsKey, JSON.stringify(taskViewPrefs))
    } catch {
      // ignore persistence failures
    }
  }, [taskViewPrefs, taskViewPrefsKey])

  const isTaskAccepted = useCallback(
    (taskId: bigint) => Boolean(acceptedTasks[taskId.toString()]),
    [acceptedTasks],
  )

  const isTaskPinned = useCallback(
    (taskId: bigint) => Boolean(pinnedTasks[taskId.toString()]),
    [pinnedTasks],
  )

  const togglePinTask = useCallback(
    (taskId: bigint, nextPinned: boolean) => {
      let snapshot: Record<string, true> | null = null

      setPinnedTasks((prev) => {
        snapshot = prev
        const key = taskId.toString()
        if (nextPinned) return { ...prev, [key]: true }
        if (!prev[key]) return prev
        const { [key]: _, ...rest } = prev
        return rest
      })
      toast({
        title: nextPinned ? 'Pinned' : 'Unpinned',
        description: nextPinned ? 'Task pinned to the top.' : 'Task unpinned.',
        variant: 'default',
        action: {
          label: 'Undo',
          onClick: () => setPinnedTasks(snapshot ?? {}),
        },
      })
    },
    [toast],
  )

  const fetchCusdBalance = useCallback(async () => {
    if (!isConnected || !address) {
      setCusdBalance(null)
      return
    }
    if (chainId && chainId !== ACTIVE_CHAIN_ID) return
    if (!publicClient) return

    setIsFetchingBalance(true)
    try {
      const balanceRaw = (await publicClient.readContract({
        address: stableTaskConfig.rewardToken.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })) as bigint

      setCusdBalance(formatUnits(balanceRaw, stableTaskConfig.rewardToken.decimals))
    } catch (error) {
      console.error('Failed to load cUSD balance:', error)
      setCusdBalance(null)
    } finally {
      setIsFetchingBalance(false)
    }
  }, [address, chainId, isConnected, publicClient])

  useEffect(() => {
    void fetchCusdBalance()
  }, [fetchCusdBalance])

  const handleRefresh = useCallback(async () => {
    setLocalPageError(null)
    toast({ title: 'Refreshing…', description: 'Updating tasks and balance.', variant: 'default' })
    try {
      await Promise.all([loadTasks(), fetchCusdBalance()])
      toast({ title: 'Up to date', description: 'Latest tasks loaded.', variant: 'success' })
    } catch (error) {
      console.error('Refresh failed:', error)
      toast({ title: 'Refresh failed', description: 'Please try again.', variant: 'error' })
    }
  }, [fetchCusdBalance, loadTasks, toast])

  const isRefreshing = isFetchingTasks || isFetchingBalance

  const resetPull = useCallback(() => {
    pullStartYRef.current = null
    isPullingRef.current = false
    setPullDistance(0)
    setPullReady(false)
  }, [])

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (isRefreshing) return
      if (event.touches.length !== 1) return
      if (typeof window !== 'undefined' && window.scrollY > 0) return
      pullStartYRef.current = event.touches[0]?.clientY ?? null
      isPullingRef.current = false
    },
    [isRefreshing],
  )

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (isRefreshing) return
      const startY = pullStartYRef.current
      if (startY === null) return
      if (event.touches.length !== 1) return
      if (typeof window !== 'undefined' && window.scrollY > 0) return

      const currentY = event.touches[0]?.clientY ?? startY
      const deltaY = currentY - startY
      if (deltaY <= 0) return

      isPullingRef.current = true
      const eased = Math.min(120, Math.round(deltaY * 0.6))
      setPullDistance(eased)
      setPullReady(eased >= 70)
    },
    [isRefreshing],
  )

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) {
      resetPull()
      return
    }
    const shouldRefresh = pullReady && !isRefreshing
    resetPull()
    if (shouldRefresh) {
      await handleRefresh()
    }
  }, [handleRefresh, isRefreshing, pullReady, resetPull])

  useEffect(() => {
    if (!pendingAction) return
    if (isConfirmed) {
      if (pendingAction.kind === 'visit') {
        toast({ title: 'Done', description: 'Task marked as done.', variant: 'success' })
      } else if (pendingAction.kind === 'claim') {
        toast({ title: 'Claimed', description: 'Rewards claimed successfully.', variant: 'success' })
      }
      setPendingAction(null)
      void loadTasks()
    }
  }, [isConfirmed, loadTasks, pendingAction, toast])

  useEffect(() => {
    if (!pendingAction) return
    if (writeError || isReceiptError) {
      if (pendingAction.kind === 'visit') {
        toast({ title: 'Failed', description: 'Could not mark task as done.', variant: 'error' })
      } else if (pendingAction.kind === 'claim') {
        toast({ title: 'Failed', description: 'Could not claim rewards.', variant: 'error' })
      }
      setLocalPageError(
        pendingAction.kind === 'create'
          ? 'Task creation failed. Please try again.'
          : pendingAction.kind === 'visit'
            ? 'Visit completion failed. Please try again.'
            : 'Reward claim failed. Please try again.',
      )
      setPendingAction(null)
    }
  }, [isReceiptError, pendingAction, toast, writeError])

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

  useEffect(() => {
    if (!isCreateOpen) {
      setCreateGasFeeEstimate(null)
      return
    }
    if (!address || !isConnected) {
      setCreateGasFeeEstimate(null)
      return
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setCreateGasFeeEstimate(null)
      return
    }
    if (!publicClient) return
    if (stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) return

    const trimmedTitle = newTask.title.trim()
    const trimmedDescription = newTask.description.trim()
    const trimmedVisitUrl = newTask.visitUrl.trim()
    if (!trimmedTitle || !trimmedDescription || !trimmedVisitUrl) {
      setCreateGasFeeEstimate(null)
      return
    }
    if (!/^https?:\/\//i.test(trimmedVisitUrl)) {
      setCreateGasFeeEstimate(null)
      return
    }
    const maxClaims = Number(newTask.maxClaims)
    if (!Number.isInteger(maxClaims) || maxClaims <= 0) {
      setCreateGasFeeEstimate(null)
      return
    }

    let cancelled = false

    const run = async () => {
      const fee = await estimateCeloGasFee({
        publicClient,
        account: address,
        to: stableTaskConfig.contracts.rewardVaultAddress,
        abi: stableTaskConfig.contracts.rewardVaultAbi,
        functionName: 'createPublicTask',
        functionArgs: [
          newTask.taskType === 'visit' ? 0 : 2,
          parseEther(newTask.rewardXp || '0'),
          parseUnits(newTask.rewardTokenAmount || '0', stableTaskConfig.rewardToken.decimals),
          BigInt(maxClaims),
          encodeMetadataURI({
            title: trimmedTitle,
            description: trimmedDescription,
            visitUrl: trimmedVisitUrl,
            deadline: newTask.deadline.trim() || undefined,
          }),
        ],
        value: publicTaskCreationFee,
      })
      if (cancelled) return
      setCreateGasFeeEstimate(fee?.feeFormatted ?? null)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    address,
    chainId,
    isConnected,
    isCreateOpen,
    newTask.deadline,
    newTask.description,
    newTask.maxClaims,
    newTask.rewardTokenAmount,
    newTask.rewardXp,
    newTask.taskType,
    newTask.title,
    newTask.visitUrl,
    publicClient,
    publicTaskCreationFee,
  ])

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
      setAcceptedTasks((prev) =>
        prev[taskId.toString()] ? prev : { ...prev, [taskId.toString()]: true },
      )

      if (visitUrl) {
        window.open(visitUrl, '_blank', 'noopener,noreferrer')
      }

      setLocalPageError(null)
      setPendingAction({ kind: 'visit', taskId })
      toast({
        title: 'Marking done…',
        description: 'Confirm the transaction in your wallet.',
        variant: 'default',
      })
      if (publicClient) {
        const fee = await estimateCeloGasFee({
          publicClient,
          account: address,
          to: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'selfCompleteTask',
          functionArgs: [taskId],
        })
        if (fee) {
          toast({
            title: 'Estimated fee',
            description: `${fee.feeFormatted} CELO (gas)`,
            variant: 'default',
          })
        }
      }

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
        toast({ title: 'Failed', description: 'Could not mark task as done.', variant: 'error' })
      }
    },
    [address, chainId, isConnected, publicClient, toast, writeContractAsync],
  )

  const handleClaim = useCallback(
    async (taskId: bigint, isVisited?: boolean, isClaimed?: boolean) => {
      if (!address || !isConnected) {
        setLocalPageError('Connect your wallet to claim rewards.')
        return
      }
      if (stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
        setLocalPageError('Set your vault address in src/lib/contracts.ts before using tasks.')
        return
      }
      if (chainId !== ACTIVE_CHAIN_ID) {
        setLocalPageError(`Switch to ${stableTaskConfig.chain.name} to claim rewards.`)
        return
      }
      if (pendingActionRef.current || isClaimed || !isVisited) return
      setAcceptedTasks((prev) =>
        prev[taskId.toString()] ? prev : { ...prev, [taskId.toString()]: true },
      )

      setLocalPageError(null)
      setPendingAction({ kind: 'claim', taskId })
      toast({
        title: 'Claiming…',
        description: 'Confirm the transaction in your wallet.',
        variant: 'default',
      })
      if (publicClient) {
        const fee = await estimateCeloGasFee({
          publicClient,
          account: address,
          to: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'claimTaskPoint',
          functionArgs: [taskId],
        })
        if (fee) {
          toast({
            title: 'Estimated fee',
            description: `${fee.feeFormatted} CELO (gas)`,
            variant: 'default',
          })
        }
      }

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
        setLocalPageError('Reward claim failed. Please try again.')
        setPendingAction(null)
        toast({ title: 'Failed', description: 'Could not claim rewards.', variant: 'error' })
      }
    },
    [address, chainId, isConnected, publicClient, toast, writeContractAsync],
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

  const visibleTasks = useMemo(() => {
    let filtered = baseVisibleTasks
    if (taskViewPrefs.hideCompleted) {
      filtered = filtered.filter((task) => !task.isCompleted)
    }
    if (taskViewPrefs.showOnlyAccepted) {
      filtered = filtered.filter((task) => isTaskAccepted(task.id))
    }

    const getDeadlineTs = (deadline: string | undefined) => {
      if (!deadline) return null
      const d = parseLocalDateOnly(deadline) ?? new Date(deadline)
      if (Number.isNaN(d.getTime())) return null
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }

    if (taskViewPrefs.sortByDeadline) {
      return [...filtered].sort((a, b) => {
        const ap = isTaskPinned(a.id) ? 1 : 0
        const bp = isTaskPinned(b.id) ? 1 : 0
        if (ap !== bp) return bp - ap

        const ad = getDeadlineTs(a.deadline)
        const bd = getDeadlineTs(b.deadline)
        if (ad === null && bd !== null) return 1
        if (ad !== null && bd === null) return -1
        if (ad !== null && bd !== null && ad !== bd) return ad - bd

        if (a.id === b.id) return 0
        return a.id > b.id ? 1 : -1
      })
    }

    const pinned: typeof filtered = []
    const unpinned: typeof filtered = []
    for (const task of filtered) {
      if (isTaskPinned(task.id)) pinned.push(task)
      else unpinned.push(task)
    }
    return [...pinned, ...unpinned]
  }, [
    baseVisibleTasks,
    isTaskAccepted,
    isTaskPinned,
    taskViewPrefs.hideCompleted,
    taskViewPrefs.showOnlyAccepted,
    taskViewPrefs.sortByDeadline,
  ])

  const handleNoteChange = useCallback((taskId: bigint, note: string) => {
    setTaskNotes((prev) => {
      const key = taskId.toString()
      const trimmed = note
      if (!trimmed) {
        if (!prev[key]) return prev
        const { [key]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: trimmed }
    })
  }, [])

  const handleCreateTask = async () => {
    const trimmedTitle = newTask.title.trim()
    const trimmedDescription = newTask.description.trim()
    const trimmedVisitUrl = newTask.visitUrl.trim()
    const trimmedDeadline = newTask.deadline.trim()
    const xpReward = Number(newTask.rewardXp)
    const rewardTokenAmount = Number(newTask.rewardTokenAmount)
    const maxClaims = Number(newTask.maxClaims)

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
    if (!Number.isFinite(rewardTokenAmount) || rewardTokenAmount <= 0) {
      setCreateError('cUSD reward per user must be greater than 0.')
      return
    }
    if (!Number.isInteger(maxClaims) || maxClaims <= 0) {
      setCreateError('Claim slots must be a whole number greater than 0.')
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

      if (publicClient) {
        const fee = await estimateCeloGasFee({
          publicClient,
          account: address,
          to: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'createPublicTask',
          functionArgs: [
            newTask.taskType === 'visit' ? 0 : 2,
            parseEther(newTask.rewardXp),
            parseUnits(newTask.rewardTokenAmount, stableTaskConfig.rewardToken.decimals),
            BigInt(maxClaims),
            encodeMetadataURI({
              title: trimmedTitle,
              description: trimmedDescription,
              visitUrl: trimmedVisitUrl,
              deadline: trimmedDeadline || undefined,
            }),
          ],
          value: publicTaskCreationFee,
        })
        if (fee) {
          toast({
            title: 'Estimated fee',
            description: `${fee.feeFormatted} CELO (gas)`,
            variant: 'default',
          })
        }
      }

      try {
        const rewardAmountRaw = parseUnits(newTask.rewardTokenAmount, stableTaskConfig.rewardToken.decimals)
        const totalEscrow = rewardAmountRaw * BigInt(maxClaims)
        if (totalEscrow > BigInt(0)) {
          toast({
            title: 'Approving cUSD',
            description: `Approve ${formatUnits(totalEscrow, stableTaskConfig.rewardToken.decimals)} cUSD for the task escrow.`,
            variant: 'default',
          })
          const approvalHash = await writeContractAsync({
            address: stableTaskConfig.rewardToken.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [stableTaskConfig.contracts.rewardVaultAddress, totalEscrow],
            chainId: ACTIVE_CHAIN_ID,
          })
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approvalHash })
          }
        }

        await writeContractAsync(
          {
            address: stableTaskConfig.contracts.rewardVaultAddress,
            abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'createPublicTask',
          args: [
            newTask.taskType === 'visit' ? 0 : 2,
            parseEther(newTask.rewardXp),
            rewardAmountRaw,
            BigInt(maxClaims),
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
        rewardTokenAmount: '0.01',
        maxClaims: '1',
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
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {isDev && (
        <div className="fixed bottom-20 left-4 z-50 rounded-full border border-cyan-300/25 bg-slate-950/90 px-3 py-1 text-xs text-slate-200 shadow">
          <span>connected: {isConnected ? 'yes' : 'no'}</span>
          <span className="mx-2 text-muted-foreground">|</span>
          <span>chainId: {chainId ?? '—'}</span>
        </div>
      )}
      <div className="mx-auto w-full max-w-md px-5 pt-2">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            height: pullDistance,
            transition: isPullingRef.current ? 'none' : 'height 180ms ease',
          }}
        >
          <div className="flex h-full items-end justify-center pb-2 text-xs font-semibold text-lime-200">
            {isRefreshing ? 'Refreshingâ€¦' : pullReady ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      </div>

      <main
        className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-2"
        style={{
          transform: pullDistance ? `translateY(${pullDistance}px)` : undefined,
          transition: isPullingRef.current ? 'none' : 'transform 180ms ease',
        }}
      >
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

        {isConnected && !isFetchingTasks && pendingPayoutsCount > 0 && (
          <div className="game-panel flex items-center justify-between gap-3 rounded-[1.25rem] px-4 py-3">
            <div>
              <div className="text-sm font-black text-lime-100">
                You have {pendingPayoutsCount} to claim
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                Completed tasks are ready for reward claim.
              </div>
            </div>
            <Link
              href="/rewards"
              className="shrink-0 rounded-full border border-lime-300/35 bg-lime-300/15 px-4 py-2 text-xs font-bold text-lime-100 transition hover:bg-lime-300/22"
            >
              View
            </Link>
          </div>
        )}

        <section
          id="tasks-dashboard"
          className="game-panel-strong relative overflow-hidden rounded-[1.5rem] px-5 py-5"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-300 via-cyan-300 to-amber-300" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-200">
                Stable Task
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={!isConnected || isFetchingTasks || isFetchingBalance}
                className="h-11 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/16 disabled:opacity-60"
              >
                {isFetchingTasks || isFetchingBalance ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateError(null)
                  setIsCreateOpen(true)
                }}
                className="h-11 rounded-xl bg-lime-300 px-5 text-sm font-black text-slate-950 shadow-[0_0_36px_rgba(132,204,22,0.22)] transition hover:bg-lime-200 disabled:opacity-60"
                disabled={!isConnected}
              >
                Create Task
              </button>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-cyan-300/20 bg-slate-900/72 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                Balance (cUSD)
              </div>
              <div className="mt-1 text-xl font-black text-slate-50">
                {isFetchingBalance ? '...' : formatCompactAmount(cusdBalance, 2)}
              </div>
            </div>
            <div className="rounded-xl border border-lime-300/20 bg-slate-900/72 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-200">
                Active tasks
              </div>
              <div className="mt-1 text-xl font-black text-slate-50">{activeTasksCount}</div>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-slate-900/72 px-4 py-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
                Pending payouts
              </div>
              <div className="mt-1 text-xl font-black text-slate-50">{pendingPayoutsCount}</div>
            </div>
          </div>

        </section>

        <section id="tasks-list" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-50">Task List</h2>
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
              <div className="game-panel rounded-[1.25rem] px-4 py-5 text-sm text-slate-400">
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
              const claimsLeft =
                task.maxClaims === BigInt(0) ? null : task.maxClaims > task.claimCount ? task.maxClaims - task.claimCount : BigInt(0)
              const helperText = task.isCompleted
                ? `Ready to claim ${task.rewardXp} XP and ${task.rewardTokenAmount} ${stableTaskConfig.rewardToken.symbol}.`
                : claimsLeft === null
                  ? 'Visit first to enable the reward claim.'
                  : `Visit first to claim reward. ${claimsLeft.toString()} slots left.`
              const rewardLabel = `${task.rewardXp} XP + ${task.rewardTokenAmount} ${stableTaskConfig.rewardToken.symbol}`

              return (
                <TaskCard
                  key={task.id.toString()}
                  taskId={task.id}
                  title={task.title}
                  description={task.description}
                  reward={rewardLabel}
                  tag={task.tag}
                  isPinned={isTaskPinned(task.id)}
                  onTogglePin={(taskId, nextPinned) => {
                    if (typeof taskId !== 'bigint') return
                    togglePinTask(taskId, nextPinned)
                  }}
                  deadlineLabel={task.deadline ? formatDeadlineLabel(task.deadline) : undefined}
                  isOverdue={!task.isCompleted && isDeadlineOverdue(task.deadline)}
                  note={taskNotes[task.id.toString()] ?? ''}
                  onNoteChange={(taskId, note) => {
                    if (typeof taskId !== 'bigint') return
                    handleNoteChange(taskId, note)
                  }}
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 px-4 pb-4 pt-10 backdrop-blur-sm sm:items-center"
          onClick={() => {
            if (!pendingAction) {
              setIsCreateOpen(false)
            }
          }}
        >
          <div
            className="game-panel-strong w-full max-w-md rounded-[1.5rem] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-50">Create a task</div>
                <div className="mt-1 text-xs text-slate-400">
                  Create a public visit or reading task directly in the vault.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                  Onchain
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={Boolean(pendingAction)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/20 bg-slate-900/80 text-lg text-slate-300 transition hover:bg-cyan-300/10 disabled:opacity-60"
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
                className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
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
                className="rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
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
                className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
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
                className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
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
                  className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none focus:border-lime-300/50"
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
                  className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
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
                placeholder="cUSD reward per user"
                className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
              />
              <input
                value={newTask.maxClaims}
                onChange={(event) =>
                  setNewTask((prev) => ({
                    ...prev,
                    maxClaims: event.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder="How many users can claim"
                className="h-11 rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
              />
              <div className="rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-xs text-slate-300">
                The vault escrows cUSD at creation. Total escrow:{' '}
                <span className="font-black text-lime-100">
                  {Number.isFinite(Number(newTask.rewardTokenAmount)) && Number.isFinite(Number(newTask.maxClaims))
                    ? `${(Number(newTask.rewardTokenAmount) * Number(newTask.maxClaims)).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })} ${stableTaskConfig.rewardToken.symbol}`
                    : `0 ${stableTaskConfig.rewardToken.symbol}`}
                </span>
                .
              </div>
              <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                Est. gas fee:{' '}
                <span className="font-black text-cyan-100">
                  {createGasFeeEstimate ? `${createGasFeeEstimate} CELO` : '—'}
                </span>
              </div>
              {createError && <p className="text-xs text-destructive">{createError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={Boolean(pendingAction)}
                  className="h-11 rounded-xl border border-cyan-300/25 bg-slate-900/80 px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={Boolean(pendingAction)}
                  className="h-11 rounded-xl bg-lime-300 px-4 text-sm font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-60"
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
