'use client'

import { useConnection } from 'wagmi'

export default function RewardsPage() {
  const { address, isConnected, chainId } = useConnection()

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-sm text-muted-foreground">Total rewards</div>
          <div className="text-2xl font-semibold">0.1 cUSD</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="text-sm text-muted-foreground">Claim history</div>
          <div className="mt-2 text-sm text-muted-foreground">No claims recorded yet.</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          Status: {isConnected ? 'Connected' : 'Not connected'} · Wallet:{' '}
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet'} · Chain: {chainId ?? '—'}
        </div>
      </section>
    </main>
  )
}
