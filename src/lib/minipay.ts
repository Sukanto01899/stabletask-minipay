'use client'

import { useEffect, useState } from 'react'

type MiniPayEthereum = { isMiniPay?: boolean }

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
