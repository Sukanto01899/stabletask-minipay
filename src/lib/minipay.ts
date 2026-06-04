'use client'

import { useEffect, useState } from 'react'

import { stableTaskConfig } from '@/lib/app-config'

type MiniPayEthereum = { isMiniPay?: boolean }

/**
 * Fee currency used to pay gas in MiniPay. Celo lets gas be paid in cUSD
 * directly (it is a registered native fee currency), so the cUSD token
 * address doubles as the `feeCurrency`. Overridable via env.
 */
const GAS_FEE_CURRENCY = (process.env.NEXT_PUBLIC_GAS_FEE_CURRENCY ??
  stableTaskConfig.rewardToken.address) as `0x${string}`

/**
 * Transaction overrides to spread into wagmi `writeContract` calls.
 * Inside MiniPay, pay gas in cUSD via `feeCurrency` because MiniPay wallets
 * usually hold no CELO. Off-MiniPay returns `{}` so other wallets are untouched.
 */
export function miniPayGasOverrides(): { feeCurrency?: `0x${string}` } {
  return detectMiniPay() ? { feeCurrency: GAS_FEE_CURRENCY } : {}
}

/**
 * Synchronously detect whether the dapp is running inside the MiniPay wallet.
 * MiniPay injects `window.ethereum.isMiniPay === true`.
 * Safe to call on the server (returns false when `window` is undefined).
 */
export function detectMiniPay(): boolean {
  if (typeof window === 'undefined') return false
  const eth = (window as Window & { ethereum?: MiniPayEthereum }).ethereum
  return Boolean(eth?.isMiniPay)
}

/**
 * Client hook that resolves to `true` once mounted inside MiniPay.
 * Starts as `false` so server and first client render match (avoids hydration
 * mismatch), then flips after mount if MiniPay is detected.
 */
export function useIsMiniPay(): boolean {
  const [isMiniPay, setIsMiniPay] = useState(false)
  useEffect(() => {
    setIsMiniPay(detectMiniPay())
  }, [])
  return isMiniPay
}
