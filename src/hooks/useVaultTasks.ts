'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, usePublicClient } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'

import { stableTaskConfig } from '@/lib/app-config'

const ACTIVE_CHAIN_ID = stableTaskConfig.chain.id as 42220
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type TaskMetadata = {
  title: string
  description: string
  visitUrl?: string
  deadline?: string
}

type VaultTaskTuple = readonly [bigint, number, `0x${string}`, bigint, bigint, boolean, boolean, string]

export type OnchainTask = {
  id: bigint
  title: string
  description: string
  visitUrl?: string
  deadline?: string
  rewardXp: string
  rewardTokenAmount: string
  tag: string
  taskType: number
  active: boolean
  isCompleted: boolean
  hasClaimedPoint: boolean
}

function parseMetadataURI(metadataURI: string, fallbackId: bigint | number | undefined): TaskMetadata {
  const normalizedId =
    typeof fallbackId === 'bigint' ? fallbackId.toString() : typeof fallbackId === 'number' ? String(fallbackId) : '?'
  const fallback: TaskMetadata = {
    title: `Task #${normalizedId}`,
    description: 'Onchain task created in StableTask.',
  }

  if (!metadataURI) return fallback

  try {
    const payload = metadataURI.startsWith('data:application/json,')
      ? decodeURIComponent(metadataURI.replace('data:application/json,', ''))
      : metadataURI
    const parsed = JSON.parse(payload) as Partial<TaskMetadata>

    return {
      title: parsed.title?.trim() || fallback.title,
      description: parsed.description?.trim() || fallback.description,
      visitUrl: parsed.visitUrl?.trim() || undefined,
      deadline: parsed.deadline?.trim() || undefined,
    }
  } catch {
    return fallback
  }
}

function getTaskTag(taskType: number) {
  if (taskType === 0) return 'Visit'
  if (taskType === 2) return 'Reading'
  return 'Task'
}

export function encodeMetadataURI(metadata: TaskMetadata) {
  return `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`
}

export function useVaultTasks() {
  const { address } = useConnection()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  const [tasks, setTasks] = useState<OnchainTask[]>([])
  const [publicTaskCreationFee, setPublicTaskCreationFee] = useState<bigint>(BigInt(0))
  const [xpBalance, setXpBalance] = useState('0')
  const [isFetchingTasks, setIsFetchingTasks] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    if (!publicClient || stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
      setTasks([])
      return
    }

    setIsFetchingTasks(true)
    try {
      const [nextTaskIdResult, feeResult, xpBalanceRawResult] = await Promise.all([
        publicClient.readContract({
          address: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'nextTaskId',
        }),
        publicClient.readContract({
          address: stableTaskConfig.contracts.rewardVaultAddress,
          abi: stableTaskConfig.contracts.rewardVaultAbi,
          functionName: 'publicTaskCreationFee',
        }),
        address
          ? publicClient.readContract({
              address: stableTaskConfig.contracts.rewardVaultAddress,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address],
            })
          : Promise.resolve(BigInt(0)),
      ])

      const nextTaskId = nextTaskIdResult as bigint
      const fee = feeResult as bigint
      const xpBalanceRaw = xpBalanceRawResult as bigint

      setPublicTaskCreationFee(fee)
      setXpBalance(formatUnits(xpBalanceRaw, 18))

      const totalTasks = Number(nextTaskId)
      if (!Number.isFinite(totalTasks) || totalTasks <= 0) {
        setTasks([])
        setPageError(null)
        return
      }

      const loadedTasks = await Promise.all(
        Array.from({ length: totalTasks }, async (_, index) => {
          const taskId = BigInt(index)
          const taskResult = await publicClient.readContract({
            address: stableTaskConfig.contracts.rewardVaultAddress,
            abi: stableTaskConfig.contracts.rewardVaultAbi,
            functionName: 'tasks',
            args: [taskId],
          })
          const [id, taskType, , pointReward, rewardAmount, active, , metadataURI] = taskResult as VaultTaskTuple

          const metadata = parseMetadataURI(metadataURI, id ?? taskId)
          const [isCompletedResult, hasClaimedPointResult] = address
            ? await Promise.all([
                publicClient.readContract({
                  address: stableTaskConfig.contracts.rewardVaultAddress,
                  abi: stableTaskConfig.contracts.rewardVaultAbi,
                  functionName: 'isCompleted',
                  args: [taskId, address],
                }),
                publicClient.readContract({
                  address: stableTaskConfig.contracts.rewardVaultAddress,
                  abi: stableTaskConfig.contracts.rewardVaultAbi,
                  functionName: 'hasClaimedPoint',
                  args: [taskId, address],
                }),
              ])
            : [false, false]
          const isCompleted = isCompletedResult as boolean
          const hasClaimedPoint = hasClaimedPointResult as boolean

          return {
            id,
            title: metadata.title,
            description: metadata.description,
            visitUrl: metadata.visitUrl,
            deadline: metadata.deadline,
            rewardXp: formatUnits(pointReward, 18),
            rewardTokenAmount: formatUnits(rewardAmount, stableTaskConfig.rewardToken.decimals),
            tag: getTaskTag(taskType),
            taskType,
            active,
            isCompleted,
            hasClaimedPoint,
          } satisfies OnchainTask
        }),
      )

      setTasks(loadedTasks.filter((task) => task.active))
      setPageError(null)
    } catch (loadError) {
      console.error('Failed to load tasks:', loadError)
      setPageError('Failed to load tasks from the reward vault.')
    } finally {
      setIsFetchingTasks(false)
    }
  }, [address, publicClient])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  return {
    tasks,
    publicTaskCreationFee,
    xpBalance,
    isFetchingTasks,
    pageError,
    loadTasks,
  }
}
