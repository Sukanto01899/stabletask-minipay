const PENDING_REFERRAL_KEY = 'stabletask:pendingReferral'

export function buildReferralLink(code: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://stabletask.app'
  return `${origin}/?ref=${encodeURIComponent(code)}`
}

// Reads `?ref=` from the current URL (if present), persists it for later
// redemption once a wallet connects, and strips it from the address bar.
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const code = url.searchParams.get('ref')?.trim()
  if (!code) return

  window.localStorage.setItem(PENDING_REFERRAL_KEY, code)

  url.searchParams.delete('ref')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function getPendingReferralCode() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(PENDING_REFERRAL_KEY)
}

export function clearPendingReferralCode() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PENDING_REFERRAL_KEY)
}
