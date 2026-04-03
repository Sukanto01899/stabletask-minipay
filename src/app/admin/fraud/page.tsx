'use client'

import { useEffect, useMemo, useState } from 'react'

import { loadFraudStore, type FraudStore } from '@/lib/fraud'

export default function FraudAdminPage() {
  const [store, setStore] = useState<FraudStore>({ claims: [], suspicious: {} })

  useEffect(() => {
    setStore(loadFraudStore())
  }, [])

  const stats = useMemo(() => {
    const uniqueWallets = new Set(store.claims.map((claim) => claim.wallet.toLowerCase()))
    const suspiciousEntries = Object.entries(store.suspicious)
      .map(([fingerprint, count]) => ({ fingerprint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalClaims: store.claims.length,
      uniqueWallets: uniqueWallets.size,
      suspiciousEntries,
    }
  }, [store])

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-sm text-muted-foreground">Total claims</div>
          <div className="text-2xl font-semibold">{stats.totalClaims}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-sm text-muted-foreground">Unique wallets</div>
          <div className="text-2xl font-semibold">{stats.uniqueWallets}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-sm text-muted-foreground">Top suspicious fingerprints</div>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            {stats.suspiciousEntries.length === 0 && <div>No suspicious activity yet.</div>}
            {stats.suspiciousEntries.map((entry) => (
              <div key={entry.fingerprint} className="flex items-center justify-between">
                <span className="truncate">{entry.fingerprint}</span>
                <span className="font-semibold text-foreground">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
