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
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_58%)]" />
      <div className="pointer-events-none absolute right-[-72px] top-14 h-40 w-40 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[-88px] top-40 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />
      {isConnected && (
        <header className="mx-auto w-full max-w-md px-5 pt-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(140deg,rgba(15,23,42,0.96),rgba(29,78,216,0.92)_45%,rgba(56,189,248,0.84))] px-5 py-5 text-white shadow-[0_24px_80px_rgba(37,99,235,0.28)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.24),transparent_28%)]" />
            <div className="flex items-start justify-between gap-3">
              <div className="relative z-10">
                <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
                  StableTask
                </div>
                <h1 className="mt-3 font-heading text-[2rem] font-bold leading-none tracking-tight">{header.title}</h1>
              </div>
              <div className="relative z-10 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-xs font-semibold text-sky-50 backdrop-blur">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet'}
              </div>
            </div>
            <p className="relative z-10 mt-3 max-w-[18rem] text-sm text-sky-100/90">{header.subtitle}</p>
            <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-2 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.2em] text-sky-100/75">Chain</div>
                <div className="mt-1 text-sm font-semibold">{chainId ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-cyan-200/20 bg-sky-100/10 px-3 py-2 text-right backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.2em] text-sky-100/75">Status</div>
                <div className="mt-1 text-sm font-semibold text-cyan-100">Rewards Active</div>
              </div>
            </div>
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
