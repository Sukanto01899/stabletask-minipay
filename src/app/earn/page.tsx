'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'
import { erc20Abi, formatUnits, parseUnits } from 'viem'

import { stableTaskConfig } from '@/lib/app-config'
import { useToast } from '@/components/ui/toast'
import { EmptyState } from '@/components/stabletask/EmptyState'
import { AnimatedNumber } from '@/components/stabletask/AnimatedNumber'

const ZERO = '0x0000000000000000000000000000000000000000'
const CHAIN_ID = stableTaskConfig.chain.id as 42220

function fmt(wei: bigint, dec = 18) {
  const n = parseFloat(formatUnits(wei, dec))
  if (n === 0) return '0'
  if (n < 0.01) return n.toFixed(4)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function safeParseUnits(value: string, decimals = 18): bigint {
  try {
    return parseUnits(value.trim(), decimals)
  } catch {
    return BigInt(0)
  }
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />
}

type TxState = 'idle' | 'approving' | 'pending' | 'success' | 'error'

export default function EarnPage() {
  const { address, isConnected } = useConnection()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID })
  const { toast } = useToast()

  const yieldVaultAddress = stableTaskConfig.contracts.yieldVaultAddress
  const yieldVaultAbi = stableTaskConfig.contracts.yieldVaultAbi
  const cusdAddress = stableTaskConfig.rewardToken.address
  const isDeployed = yieldVaultAddress !== ZERO

  const [depositedWei, setDepositedWei] = useState<bigint>(BigInt(0))
  const [pendingXpWei, setPendingXpWei] = useState<bigint>(BigInt(0))
  const [cusdBalanceWei, setCusdBalanceWei] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState(false)

  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [depositTx, setDepositTx] = useState<TxState>('idle')
  const [withdrawTx, setWithdrawTx] = useState<TxState>('idle')
  const [claimTx, setClaimTx] = useState<TxState>('idle')

  const loadData = useCallback(async () => {
    if (!publicClient || !address || !isDeployed) return
    setIsLoading(true)
    try {
      const [deposited, pending, cusdBal] = await Promise.all([
        publicClient.readContract({
          address: yieldVaultAddress,
          abi: yieldVaultAbi,
          functionName: 'depositOf',
          args: [address],
        }),
        publicClient.readContract({
          address: yieldVaultAddress,
          abi: yieldVaultAbi,
          functionName: 'pendingXP',
          args: [address],
        }),
        publicClient.readContract({
          address: cusdAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
      ])
      setDepositedWei(deposited as bigint)
      setPendingXpWei(pending as bigint)
      setCusdBalanceWei(cusdBal as bigint)
    } catch (e) {
      console.error('loadData failed', e)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, address, isDeployed, yieldVaultAddress, yieldVaultAbi, cusdAddress])

  useEffect(() => { void loadData() }, [loadData])

  // Poll pending XP every 30s so it ticks up live
  useEffect(() => {
    if (!isDeployed || !address) return
    const id = setInterval(() => { void loadData() }, 30_000)
    return () => clearInterval(id)
  }, [isDeployed, address, loadData])

  const handleDeposit = async () => {
    if (!walletClient || !address || !publicClient) return
    const amount = safeParseUnits(depositInput)
    if (amount === BigInt(0)) return toast({ title: 'Enter an amount', variant: 'error' })
    if (amount > cusdBalanceWei) return toast({ title: 'Insufficient cUSD balance', variant: 'error' })

    try {
      setDepositTx('approving')
      // Approve
      const approveTx = await walletClient.writeContract({
        address: cusdAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [yieldVaultAddress, amount],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      setDepositTx('pending')
      const tx = await walletClient.writeContract({
        address: yieldVaultAddress,
        abi: yieldVaultAbi,
        functionName: 'deposit',
        args: [amount],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })

      setDepositTx('success')
      setDepositInput('')
      toast({ title: 'Deposited!', description: `${depositInput} cUSD is now earning XP.`, variant: 'success' })
      void loadData()
    } catch (e) {
      console.error(e)
      setDepositTx('error')
      toast({ title: 'Deposit failed', variant: 'error' })
    } finally {
      setTimeout(() => setDepositTx('idle'), 2000)
    }
  }

  const handleWithdraw = async () => {
    if (!walletClient || !address || !publicClient) return
    const amount = safeParseUnits(withdrawInput)
    if (amount === BigInt(0)) return toast({ title: 'Enter an amount', variant: 'error' })
    if (amount > depositedWei) return toast({ title: 'Exceeds your deposit', variant: 'error' })

    try {
      setWithdrawTx('pending')
      const tx = await walletClient.writeContract({
        address: yieldVaultAddress,
        abi: yieldVaultAbi,
        functionName: 'withdraw',
        args: [amount],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })

      setWithdrawTx('success')
      setWithdrawInput('')
      toast({ title: 'Withdrawn!', description: `${withdrawInput} cUSD returned to your wallet.`, variant: 'success' })
      void loadData()
    } catch (e) {
      console.error(e)
      setWithdrawTx('error')
      toast({ title: 'Withdrawal failed', variant: 'error' })
    } finally {
      setTimeout(() => setWithdrawTx('idle'), 2000)
    }
  }

  const handleClaimXP = async () => {
    if (!walletClient || !address || !publicClient) return
    if (pendingXpWei === BigInt(0)) return toast({ title: 'No XP to claim yet', variant: 'error' })

    try {
      setClaimTx('pending')
      const tx = await walletClient.writeContract({
        address: yieldVaultAddress,
        abi: yieldVaultAbi,
        functionName: 'claimXP',
        args: [],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })

      setClaimTx('success')
      toast({ title: 'XP Claimed!', description: `${fmt(pendingXpWei)} XP added to your balance.`, variant: 'success' })
      void loadData()
    } catch (e) {
      console.error(e)
      setClaimTx('error')
      toast({ title: 'Claim failed', variant: 'error' })
    } finally {
      setTimeout(() => setClaimTx('idle'), 2000)
    }
  }

  if (!isConnected) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">
        <EmptyState
          className="py-12"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          title="Connect your wallet"
          description="Connect on the Tap page to deposit cUSD and earn XP."
          action={
            <Link href="/tap" className="rounded-full border border-lime-300/30 bg-lime-300/15 px-5 py-2 text-xs font-bold text-lime-100 transition hover:bg-lime-300/22">
              Go to Tap
            </Link>
          }
        />
      </main>
    )
  }

  if (!isDeployed) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">
        <EmptyState
          className="py-12"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
            </svg>
          }
          title="Yield Vault not deployed yet"
          description="Deploy StableTaskYieldVault.sol and set NEXT_PUBLIC_YIELD_VAULT_ADDRESS in your .env file."
        />
      </main>
    )
  }

  const depositAmountWei = safeParseUnits(depositInput)
  const withdrawAmountWei = safeParseUnits(withdrawInput)
  const xpPerDay = depositedWei  // 1 cUSD = 1 XP/day (same decimals)

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">

      {/* Hero — pending XP */}
      <section
        className="relative overflow-hidden rounded-[1.5rem] border border-lime-300/20 px-5 py-5"
        style={{ background: 'linear-gradient(135deg,rgba(15,23,42,0.97),rgba(5,10,28,0.98))', boxShadow: '0 0 40px rgba(163,230,53,0.12)' }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/40 to-transparent" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-lime-300/8 blur-2xl" />

        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-200">XP Earning</div>
        <div className="mt-1 flex items-end gap-2">
          {isLoading ? (
            <SkeletonBlock className="h-10 w-36" />
          ) : (
            <span className="animate-fade-in flex items-end gap-2">
              <AnimatedNumber
                value={parseFloat(formatUnits(pendingXpWei, 18))}
                format={(n) => n.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                gradient
                className="text-4xl font-black leading-none"
              />
              <span className="mb-0.5 text-xl font-black text-lime-300">XP</span>
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">accrued — ready to claim</div>

        {/* Stat row */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-cyan-300/20 bg-slate-900/50 px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Deposited</div>
            {isLoading ? <SkeletonBlock className="mt-1 h-5 w-20" /> : (
              <div className="animate-fade-in mt-0.5 text-base font-black text-slate-50">{fmt(depositedWei)} <span className="text-xs text-slate-400">cUSD</span></div>
            )}
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-slate-900/50 px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">Rate</div>
            {isLoading ? <SkeletonBlock className="mt-1 h-5 w-20" /> : (
              <div className="animate-fade-in mt-0.5 text-base font-black text-slate-50">{fmt(xpPerDay)} <span className="text-xs text-slate-400">XP/day</span></div>
            )}
          </div>
        </div>

        {/* Claim button */}
        <button
          type="button"
          onClick={handleClaimXP}
          disabled={claimTx !== 'idle' || pendingXpWei === BigInt(0)}
          className="mt-4 w-full rounded-2xl border border-lime-300/30 bg-lime-300/15 py-3 text-sm font-black text-lime-100 transition hover:bg-lime-300/22 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {claimTx === 'pending' ? 'Claiming…' : claimTx === 'success' ? '✓ Claimed!' : `Claim ${fmt(pendingXpWei)} XP`}
        </button>
      </section>

      {/* Info strip */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-cyan-300/15 bg-slate-950/50 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6-3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.25 7a.75.75 0 0 0 0 1.5H7v2.25a.75.75 0 0 0 1.5 0V7.75A.75.75 0 0 0 8 7h-.75Z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-xs text-slate-400">
          <span className="font-bold text-cyan-200">1 cUSD = 1 XP per day.</span> Withdraw anytime — XP accrues every second you hold.
        </p>
      </div>

      {/* Deposit */}
      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="mb-3 text-sm font-black text-slate-50">Deposit cUSD</div>
        <div className="text-xs text-slate-500 mb-3">
          Wallet balance: <span className="font-bold text-slate-300">{fmt(cusdBalanceWei)} cUSD</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={depositInput}
            onChange={(e) => setDepositInput(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm font-bold text-slate-50 outline-none placeholder:text-slate-600 focus:border-lime-300/50"
          />
          <button
            type="button"
            onClick={() => setDepositInput(formatUnits(cusdBalanceWei, 18))}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            Max
          </button>
        </div>
        {depositInput && depositAmountWei > cusdBalanceWei && (
          <p className="mt-1.5 text-xs text-rose-400">Exceeds your cUSD balance</p>
        )}
        <button
          type="button"
          onClick={handleDeposit}
          disabled={depositTx !== 'idle' || !depositInput || depositAmountWei === BigInt(0) || depositAmountWei > cusdBalanceWei}
          className="mt-3 w-full rounded-2xl border border-lime-300/25 bg-lime-300/12 py-3 text-sm font-black text-lime-100 transition hover:bg-lime-300/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {depositTx === 'approving' ? 'Approving…' : depositTx === 'pending' ? 'Depositing…' : depositTx === 'success' ? '✓ Deposited!' : 'Deposit'}
        </button>
      </section>

      {/* Withdraw */}
      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="mb-3 text-sm font-black text-slate-50">Withdraw cUSD</div>
        <div className="text-xs text-slate-500 mb-3">
          Deposited: <span className="font-bold text-slate-300">{fmt(depositedWei)} cUSD</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={withdrawInput}
            onChange={(e) => setWithdrawInput(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm font-bold text-slate-50 outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />
          <button
            type="button"
            onClick={() => setWithdrawInput(formatUnits(depositedWei, 18))}
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            Max
          </button>
        </div>
        {withdrawInput && withdrawAmountWei > depositedWei && (
          <p className="mt-1.5 text-xs text-rose-400">Exceeds your deposited amount</p>
        )}
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={withdrawTx !== 'idle' || !withdrawInput || withdrawAmountWei === BigInt(0) || withdrawAmountWei > depositedWei}
          className="mt-3 w-full rounded-2xl border border-cyan-300/25 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/18 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {withdrawTx === 'pending' ? 'Withdrawing…' : withdrawTx === 'success' ? '✓ Withdrawn!' : 'Withdraw'}
        </button>
      </section>

    </main>
  )
}
