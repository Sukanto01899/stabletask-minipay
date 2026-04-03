'use client'

import { useConnection } from 'wagmi'

export default function ProfilePage() {
  const { address, isConnected, chainId } = useConnection()

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <div className="text-muted-foreground">Wallet address</div>
          <div className="mt-1 font-semibold">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet connected'}
          </div>
          <div className="mt-3 text-muted-foreground">Network</div>
          <div className="mt-1 font-semibold">Chain ID: {chainId ?? '—'}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <div className="text-muted-foreground">Status</div>
          <div className="mt-1 font-semibold">{isConnected ? 'Connected' : 'Not connected'}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
          <div className="text-muted-foreground">Preferences</div>
          <div className="mt-2 text-muted-foreground">Notification settings coming soon.</div>
        </div>
      </section>
    </main>
  )
}
