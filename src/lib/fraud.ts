export type FraudRecord = {
  taskId: string
  wallet: string
  fingerprint: string
  timestamp: number
}

export type FraudStore = {
  claims: FraudRecord[]
  suspicious: Record<string, number>
}

const STORAGE_KEY = 'stabletask.fraud'

function getUserAgent() {
  if (typeof window === 'undefined') return 'server'
  return window.navigator.userAgent || 'unknown'
}

export function getFingerprint(address: string) {
  return `${address.toLowerCase()}::${getUserAgent()}`
}

export function loadFraudStore(): FraudStore {
  if (typeof window === 'undefined') return { claims: [], suspicious: {} }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { claims: [], suspicious: {} }
    const parsed = JSON.parse(raw) as FraudStore
    return {
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      suspicious: parsed.suspicious ?? {},
    }
  } catch {
    return { claims: [], suspicious: {} }
  }
}

export function saveFraudStore(store: FraudStore) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function recordClaim(store: FraudStore, record: FraudRecord) {
  return {
    ...store,
    claims: [...store.claims, record],
  }
}

export function recordSuspicious(store: FraudStore, fingerprint: string) {
  const count = store.suspicious[fingerprint] ?? 0
  return {
    ...store,
    suspicious: {
      ...store.suspicious,
      [fingerprint]: count + 1,
    },
  }
}

export function getLastClaim(store: FraudStore, fingerprint: string) {
  const records = store.claims.filter((claim) => claim.fingerprint === fingerprint)
  return records.length ? records[records.length - 1] : undefined
}

export function hasClaimedTask(store: FraudStore, wallet: string, taskId: string) {
  const normalized = wallet.toLowerCase()
  return store.claims.some((claim) => claim.wallet.toLowerCase() === normalized && claim.taskId === taskId)
}

export function getSuspiciousCount(store: FraudStore, fingerprint: string) {
  return store.suspicious[fingerprint] ?? 0
}
