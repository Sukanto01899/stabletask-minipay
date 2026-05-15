'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number }[]>([])
  const bubbleIdRef = useRef(0)

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

  const isBusy = isWritePending || isConfirming

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

  const handleTapClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isBusy && !isLoadingTapData && remainingTaps > 0) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left + (Math.random() - 0.5) * 40
      const y = e.clientY - rect.top
      const id = bubbleIdRef.current++
      setBubbles(prev => [...prev, { id, x, y }])
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 850)
    }
    await handleTap()
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

      <section className="game-panel-strong flex flex-1 items-center justify-center rounded-[1.5rem] p-5">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <div className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-lime-200">Tap To Earn</div>
          <button
            type="button"
            onClick={handleTapClick}
            disabled={isBusy || isLoadingTapData || remainingTaps <= 0}
            aria-busy={isBusy}
            className="relative flex h-52 w-52 items-center justify-center rounded-full border-2 border-lime-300/50 bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.95)_0%,rgba(204,251,241,0.88)_8%,rgba(20,184,166,0.97)_36%,rgba(8,16,42,1)_68%,rgba(4,8,24,1)_100%)] px-8 text-center text-3xl font-black tracking-tight text-white shadow-[0_0_0_12px_rgba(132,204,22,0.08),0_32px_100px_rgba(20,184,166,0.42),inset_0_-14px_32px_rgba(0,0,0,0.65),inset_0_7px_18px_rgba(255,255,255,0.22)] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {/* 3D specular highlights */}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
              <span className="absolute left-[16%] top-[8%] h-16 w-20 rounded-full bg-white opacity-20 blur-md" />
              <span className="absolute left-[25%] top-[13%] h-7 w-8 rounded-full bg-white opacity-55 blur-[5px]" />
              <span className="absolute bottom-[7%] left-1/2 h-7 w-36 -translate-x-1/2 rounded-full bg-black opacity-40 blur-xl" />
            </span>
            {/* +1 floating bubbles */}
            {bubbles.map(b => (
              <span
                key={b.id}
                aria-hidden
                className="animate-float-up pointer-events-none absolute z-10 select-none text-xl font-black text-lime-200 drop-shadow-[0_0_8px_rgba(163,230,53,0.9)]"
                style={{ left: b.x, top: b.y, transform: 'translate(-50%, -50%)' }}
              >
                +1
              </span>
            ))}
            {isBusy && (
              <span aria-hidden className="pointer-events-none absolute inset-0">
                <span className="absolute inset-3 rounded-full border border-lime-200/25 bg-white/5 backdrop-blur-sm" />
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
          <div className="mt-5 text-sm text-slate-300">
            Tap sends one transaction and mints <span className="font-black text-lime-100">{tapXpReward} XP</span>.
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-cyan-300/20 bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-300 via-cyan-300 to-amber-300 transition-[width]"
              style={{ width: `${dailyTapLimit === 0 ? 0 : (tapsToday / dailyTapLimit) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {tapsToday} / {dailyTapLimit} taps used today
          </div>
        </div>
      </section>

      <section className="game-panel relative overflow-hidden rounded-[1.5rem] px-5 py-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-300 via-cyan-300 to-amber-300" />
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-lime-300/20 bg-slate-900/72 px-4 py-3 backdrop-blur">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-200">Earned XP</div>
            <div className="mt-1 text-xl font-black text-slate-50">{xpBalance}</div>
            <div className="text-xs text-slate-400">vault token balance</div>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-slate-900/72 px-4 py-3 backdrop-blur">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">Today&apos;s Taps</div>
            <div className="mt-1 text-xl font-black text-slate-50">{tapsToday}</div>
            <div className="text-xs text-slate-400">{remainingTaps} remaining today</div>
          </div>
        </div>
      </section>
    </main>
  )
}
