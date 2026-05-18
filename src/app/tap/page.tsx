'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useConnect,
  useConnectors,
  useConnection,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
  type Connector,
} from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'

import { stableTaskConfig } from '@/lib/app-config'

const ACTIVE_CHAIN_ID = stableTaskConfig.chain.id as 42220
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const WALLET_META: Record<string, { border: string; bg: string; icon: string; desc: string }> = {
  metaMask: {
    border: 'border-orange-400/35',
    bg: 'hover:bg-orange-400/10',
    icon: 'bg-orange-500/20 text-orange-300',
    desc: 'Connect with MetaMask',
  },
  rabby: {
    border: 'border-purple-400/35',
    bg: 'hover:bg-purple-400/10',
    icon: 'bg-purple-500/20 text-purple-300',
    desc: 'Connect with Rabby Wallet',
  },
  injected: {
    border: 'border-cyan-400/35',
    bg: 'hover:bg-cyan-400/10',
    icon: 'bg-cyan-500/20 text-cyan-300',
    desc: 'MiniPay or browser wallet',
  },
}

const WALLET_LETTER: Record<string, string> = {
  metaMask: 'M',
  rabby: 'R',
  injected: 'W',
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
    <div className={`rounded-xl border ${props.borderColor} bg-slate-900/72 px-4 py-3 backdrop-blur`}>
      <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${props.labelColor}`}>
        {props.label}
      </div>
      {props.loading ? (
        <div className="skeleton-shimmer mt-1 h-7 w-20 rounded-lg" />
      ) : (
        <div className="mt-1 text-xl font-black text-slate-50">{props.value}</div>
      )}
      <div className="text-xs text-slate-400">{props.sub}</div>
    </div>
  )
}

export default function TapPage() {
  const { address, isConnected, chainId } = useConnection()
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  const connectors = useConnectors()
  const { connect, isPending: isConnecting } = useConnect()
  const { writeContractAsync, data: tapHash, error: writeError, isPending: isWritePending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError } =
    useWaitForTransactionReceipt({
      hash: tapHash,
      query: { enabled: Boolean(tapHash) },
    })

  const [xpBalance, setXpBalance] = useState('0')
  const [tapsToday, setTapsToday] = useState(0)
  const [remainingTaps, setRemainingTaps] = useState(1000)
  const [dailyTapLimit, setDailyTapLimit] = useState(1000)
  const [tapXpReward, setTapXpReward] = useState('1')
  const [isLoadingTapData, setIsLoadingTapData] = useState(false)
  const [tapError, setTapError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number }[]>([])
  const bubbleIdRef = useRef(0)

  const loadTapData = useCallback(async () => {
    if (!publicClient || stableTaskConfig.contracts.rewardVaultAddress === ZERO_ADDRESS) return

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
  }, [publicClient, address])

  useEffect(() => {
    void loadTapData()
  }, [loadTapData])

  useEffect(() => {
    if (isConfirmed) void loadTapData()
  }, [isConfirmed, loadTapData])

  useEffect(() => {
    if (writeError || isReceiptError) {
      setTapError('Tap transaction failed. Please try again.')
    }
  }, [writeError, isReceiptError])

  const isBusy = isWritePending || isConfirming
  const isLimitReached = remainingTaps <= 0

  const handleConnectWith = (connector: Connector) => {
    setConnectingId(connector.id)
    setConnectError(null)
    connect(
      { connector },
      {
        onError(err) {
          setConnectError(err.message ?? 'Failed to connect. Make sure the wallet is installed.')
          setConnectingId(null)
        },
        onSuccess() {
          setConnectingId(null)
        },
      },
    )
  }

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
    if (isLimitReached) {
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
    if (!isBusy && !isLoadingTapData && !isLimitReached) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left + (Math.random() - 0.5) * 40
      const y = e.clientY - rect.top
      const id = bubbleIdRef.current++
      setBubbles(prev => [...prev, { id, x, y }])
      setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 850)
    }
    await handleTap()
  }

  const tapProgress = dailyTapLimit === 0 ? 0 : (tapsToday / dailyTapLimit) * 100

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      {tapError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {tapError}
        </p>
      )}

      <section className="game-panel-strong flex flex-1 items-center justify-center rounded-[1.5rem] p-5">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <div className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-lime-200">Tap To Earn</div>

          {!isConnected ? (
            <div className="flex w-full flex-col items-center gap-5">
              {/* Dimmed placeholder circle */}
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 border-lime-300/15 bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.08)_0%,rgba(20,184,166,0.12)_36%,rgba(8,16,42,0.9)_100%)] opacity-40 blur-[1.5px]">
                <span className="text-2xl font-black text-white/20">+1 XP</span>
              </div>

              <div className="w-full">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Choose wallet to connect
                </p>

                {connectError && (
                  <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {connectError}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {connectors.map(connector => {
                    const meta = WALLET_META[connector.id] ?? WALLET_META.injected
                    const letter = WALLET_LETTER[connector.id] ?? 'W'
                    const isLoading = isConnecting && connectingId === connector.id

                    return (
                      <button
                        key={connector.uid}
                        type="button"
                        onClick={() => handleConnectWith(connector)}
                        disabled={isConnecting}
                        className={`flex items-center gap-4 rounded-2xl border bg-slate-900/60 px-4 py-3 text-left backdrop-blur transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${meta.border} ${meta.bg}`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${meta.icon}`}>
                          {letter}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-black text-slate-100">{connector.name}</span>
                          <span className="text-xs text-slate-500">
                            {isLoading ? 'Connecting…' : meta.desc}
                          </span>
                        </span>
                        {isLoading && (
                          <span className="ml-auto h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTapClick}
                disabled={isBusy || isLoadingTapData || isLimitReached}
                aria-busy={isBusy}
                className={`relative flex h-52 w-52 items-center justify-center rounded-full border-2 px-8 text-center text-3xl font-black tracking-tight text-white shadow-[0_0_0_12px_rgba(132,204,22,0.08),0_32px_100px_rgba(20,184,166,0.42),inset_0_-14px_32px_rgba(0,0,0,0.65),inset_0_7px_18px_rgba(255,255,255,0.22)] transition active:scale-[0.97] disabled:cursor-not-allowed ${
                  isLimitReached
                    ? 'border-slate-600/50 bg-[radial-gradient(circle_at_30%_22%,rgba(30,41,59,0.9)_0%,rgba(15,23,42,0.98)_60%)] opacity-50'
                    : 'border-lime-300/50 bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.95)_0%,rgba(204,251,241,0.88)_8%,rgba(20,184,166,0.97)_36%,rgba(8,16,42,1)_68%,rgba(4,8,24,1)_100%)]'
                }`}
              >
                {/* 3D specular highlights — hidden when limit reached */}
                {!isLimitReached && (
                  <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                    <span className="absolute left-[16%] top-[8%] h-16 w-20 rounded-full bg-white opacity-20 blur-md" />
                    <span className="absolute left-[25%] top-[13%] h-7 w-8 rounded-full bg-white opacity-55 blur-[5px]" />
                    <span className="absolute bottom-[7%] left-1/2 h-7 w-36 -translate-x-1/2 rounded-full bg-black opacity-40 blur-xl" />
                  </span>
                )}
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
                  {isLimitReached ? 'Limit Reached' : '+1 XP'}
                </span>
              </button>

              {isLimitReached ? (
                <p className="mt-4 text-xs text-slate-500">
                  Daily limit reached — resets at midnight UTC.
                </p>
              ) : (
                <div className="mt-5 text-sm text-slate-300">
                  Tap sends one transaction and mints{' '}
                  <span className="font-black text-lime-100">{tapXpReward} XP</span>.
                </div>
              )}

              {isLoadingTapData ? (
                <div className="skeleton-shimmer mt-2 h-3 w-full rounded-full" />
              ) : (
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-cyan-300/20 bg-slate-900">
                  <div
                    className={`h-full rounded-full transition-[width] ${
                      isLimitReached
                        ? 'bg-slate-600'
                        : 'bg-linear-to-r from-lime-300 via-cyan-300 to-amber-300'
                    }`}
                    style={{ width: `${tapProgress}%` }}
                  />
                </div>
              )}

              {isLoadingTapData ? (
                <div className="skeleton-shimmer mt-2 h-3 w-36 rounded-full" />
              ) : (
                <div className="mt-2 text-xs text-slate-400">
                  {tapsToday} / {dailyTapLimit} taps used today
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="game-panel relative overflow-hidden rounded-[1.5rem] px-5 py-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-lime-300 via-cyan-300 to-amber-300" />
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <StatCard
            label="Earned XP"
            labelColor="text-lime-200"
            borderColor="border-lime-300/20"
            value={xpBalance}
            sub="vault token balance"
            loading={isLoadingTapData}
          />
          <StatCard
            label="Today's Taps"
            labelColor="text-amber-200"
            borderColor="border-amber-300/20"
            value={String(tapsToday)}
            sub={`${remainingTaps} remaining today`}
            loading={isLoadingTapData}
          />
        </div>
      </section>
    </main>
  )
}
