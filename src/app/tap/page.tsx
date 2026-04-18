'use client'

import { useEffect, useState } from 'react'
import {
  useConnect,
  useConnectors,
  useConnection,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'

import { LoadingScreen } from '@/components/stabletask/LoadingScreen'
import { stableTaskConfig } from '@/lib/app-config'

const ACTIVE_CHAIN_ID = stableTaskConfig.chain.id as 42220
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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

export default function TapPage() {
  const { address, isConnected, isConnecting, chainId } = useConnection()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  const { error: connectError, isPending, providerMissing } = useAutoConnect(isConnected)
  const { writeContractAsync, data: tapHash, error: writeError, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError } =
    useWaitForTransactionReceipt({
      hash: tapHash,
      query: { enabled: Boolean(tapHash) },
    })

  const isDev = process.env.NODE_ENV === 'development'
  const [xpBalance, setXpBalance] = useState('0')
  const [tapsToday, setTapsToday] = useState(0)
  const [remainingTaps, setRemainingTaps] = useState(1000)
  const [dailyTapLimit, setDailyTapLimit] = useState(1000)
  const [tapXpReward, setTapXpReward] = useState('1')
  const [isLoadingTapData, setIsLoadingTapData] = useState(false)
  const [tapError, setTapError] = useState<string | null>(null)

  async function loadTapData() {
    if (!publicClient || stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
      return
    }

    setIsLoadingTapData(true)
    try {
      const [tapRewardResult, limitResult, xpBalanceResult, tapsTodayResult, remainingTapsResult] =
        await Promise.all([
          publicClient.readContract({
            address: stableTaskConfig.contracts.rewardVaultAddress,
            abi: stableTaskConfig.contracts.rewardVaultAbi,
            functionName: 'TAP_XP_REWARD',
          }),
          publicClient.readContract({
            address: stableTaskConfig.contracts.rewardVaultAddress,
            abi: stableTaskConfig.contracts.rewardVaultAbi,
            functionName: 'DAILY_TAP_LIMIT',
          }),
          address
            ? publicClient.readContract({
                address: stableTaskConfig.contracts.rewardVaultAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
              })
            : Promise.resolve(BigInt(0)),
          address
            ? publicClient.readContract({
                address: stableTaskConfig.contracts.rewardVaultAddress,
                abi: stableTaskConfig.contracts.rewardVaultAbi,
                functionName: 'tapsToday',
                args: [address],
              })
            : Promise.resolve(BigInt(0)),
          address
            ? publicClient.readContract({
                address: stableTaskConfig.contracts.rewardVaultAddress,
                abi: stableTaskConfig.contracts.rewardVaultAbi,
                functionName: 'remainingTaps',
                args: [address],
              })
            : Promise.resolve(BigInt(1000)),
        ])

      setTapXpReward(formatUnits(tapRewardResult as bigint, 18))
      setDailyTapLimit(Number(limitResult as bigint))
      setXpBalance(formatUnits(xpBalanceResult as bigint, 18))
      setTapsToday(Number(tapsTodayResult as bigint))
      setRemainingTaps(Number(remainingTapsResult as bigint))
      setTapError(null)
    } catch (error) {
      console.error('Failed to load tap data:', error)
      setTapError('Failed to load tap stats from the vault.')
    } finally {
      setIsLoadingTapData(false)
    }
  }

  useEffect(() => {
    void loadTapData()
  }, [publicClient, address])

  useEffect(() => {
    if (isConfirmed) {
      void loadTapData()
    }
  }, [isConfirmed])

  useEffect(() => {
    if (writeError || isReceiptError) {
      setTapError('Tap transaction failed. Please try again.')
    }
  }, [writeError, isReceiptError])

  const errorMessage = providerMissing
    ? 'window.ethereum is required. Please run this app inside MiniPay.'
    : isDev && connectError
      ? connectError.message
      : undefined

  const handleTap = async () => {
    if (!address || !isConnected) {
      setTapError('Connect your wallet to tap for XP.')
      return
    }
    if (stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) {
      setTapError('Set your vault address in src/lib/contracts.ts before using Tap.')
      return
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setTapError(`Switch to ${stableTaskConfig.chain.name} to tap.`)
      return
    }
    if (remainingTaps <= 0) {
      setTapError('Daily tap limit reached. Come back tomorrow.')
      return
    }

    setTapError(null)

    try {
      await writeContractAsync({
        address: stableTaskConfig.contracts.rewardVaultAddress,
        abi: stableTaskConfig.contracts.rewardVaultAbi,
        functionName: 'tap',
        chainId: ACTIVE_CHAIN_ID,
      })
    } catch (error) {
      console.error('Tap transaction failed:', error)
      setTapError('Tap transaction failed. Please try again.')
    }
  }

  if ((isConnecting || isPending) && !isConnected) {
    return (
      <LoadingScreen
        title="Connecting wallet..."
        subtitle="Preparing your wallet session for tap rewards."
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

  const isBusy = isWritePending || isConfirming

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      {errorMessage && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {errorMessage}
        </p>
      )}
      {tapError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {tapError}
        </p>
      )}

      <section className="flex flex-1 items-center justify-center rounded-[2rem] border border-blue-200/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-700/70">Tap To Earn</div>
          <button
            type="button"
            onClick={handleTap}
            disabled={isBusy || isLoadingTapData || remainingTaps <= 0}
            aria-busy={isBusy}
            className="relative flex h-52 w-52 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.92),rgba(96,165,250,0.95)_45%,rgba(29,78,216,1))] px-8 text-center text-3xl font-black tracking-tight text-white shadow-[0_28px_80px_rgba(37,99,235,0.35)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy && (
              <span aria-hidden className="pointer-events-none absolute inset-0">
                <span className="absolute inset-3 rounded-full border border-white/25 bg-white/5 backdrop-blur-sm" />
                <span className="animate-tap-orbit absolute inset-2">
                  <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_10px_30px_rgba(255,255,255,0.35)]" />
                </span>
                <span className="animate-tap-pulse absolute inset-6 rounded-full ring-1 ring-white/20" />
              </span>
            )}
            <span className={isBusy ? 'opacity-90' : undefined}>
              {remainingTaps <= 0 ? 'Limit Reached' : '+1 XP'}
            </span>
          </button>
          <div className="mt-5 text-sm text-slate-600">
            Tap sends one transaction and mints <span className="font-semibold text-slate-950">{tapXpReward} XP</span>.
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width]"
              style={{ width: `${dailyTapLimit === 0 ? 0 : (tapsToday / dailyTapLimit) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {tapsToday} / {dailyTapLimit} taps used today
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(224,242,254,0.98)_60%,rgba(191,219,254,0.95))] px-5 py-5 shadow-[0_24px_60px_rgba(37,99,235,0.14)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-cyan-300/25 blur-2xl" />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">Tap Arena</div>
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-slate-950">
            Every tap is an onchain transaction and earns XP.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Each successful tap mints {tapXpReward} XP. Daily limit: {dailyTapLimit} taps.
          </p>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">Earned XP</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{xpBalance}</div>
            <div className="text-xs text-slate-500">vault token balance</div>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">Today&apos;s Taps</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{tapsToday}</div>
            <div className="text-xs text-slate-500">{remainingTaps} remaining today</div>
          </div>
        </div>
      </section>
    </main>
  )
}
