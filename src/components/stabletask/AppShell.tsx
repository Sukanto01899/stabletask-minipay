'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useConnection } from 'wagmi'

import { BottomNav } from '@/components/stabletask/BottomNav'

const HEADER_COPY: Record<string, { title: string; subtitle: string }> = {
  '/tasks': {
    title: 'Tasks',
    subtitle: 'Complete tasks and earn cUSD.',
  },
  '/rewards': {
    title: 'Rewards',
    subtitle: 'Track your claimed rewards and progress.',
  },
  '/profile': {
    title: 'Profile',
    subtitle: 'Manage your wallet and preferences.',
  },
  '/admin/fraud': {
    title: 'Fraud Dashboard',
    subtitle: 'Monitor claim patterns and suspicious activity.',
  },
}

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { address, chainId, isConnected } = useConnection()

  const header = useMemo(() => {
    return (
      HEADER_COPY[pathname] ?? {
        title: 'StableTask',
        subtitle: 'Complete tasks and earn cUSD.',
      }
    )
  }, [pathname])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {isConnected && (
        <header className="mx-auto w-full max-w-md px-5 pt-6">
          <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">StableTask</div>
                <h1 className="mt-2 text-2xl font-semibold">{header.title}</h1>
              </div>
              <div className="rounded-full border border-border/60 bg-white/70 px-3 py-1 text-xs font-semibold">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet'}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{header.subtitle}</p>
            <div className="mt-3 text-xs text-muted-foreground">Chain: {chainId ?? '—'}</div>
          </div>
        </header>
      )}
      {props.children}
      {isConnected && (
        <BottomNav
          items={[
            { label: 'Tasks', href: '/tasks' },
            { label: 'Rewards', href: '/rewards' },
            { label: 'Profile', href: '/profile' },
          ]}
        />
      )}
    </div>
  )
}
