'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useConnection } from 'wagmi'

import { stableTaskConfig } from '@/lib/app-config'
import { ReferralCard } from '@/components/stabletask/ReferralCard'
import { EmptyState } from '@/components/stabletask/EmptyState'
import { copyText } from '@/lib/clipboard'
import {
  readTaskViewPreferences,
  taskViewPreferencesStorageKey,
  type TaskViewPreferences,
} from '@/lib/task-view-preferences'
import {
  readToastPreferences,
  TOAST_PREFERENCES_STORAGE_KEY,
  type ToastPreferences,
} from '@/lib/toast-preferences'

type ProfileClaim = {
  _id: string
  amountCusd: number
  status: 'pending' | 'confirmed' | 'failed'
  txHash?: string | null
  claimedAt?: string | Date | null
  task?: { title?: string } | null
}

type ProfileReferral = {
  _id: string
  code: string
  status: 'pending' | 'completed'
  rewardCusd: number
  createdAt?: string | Date
}

type ProfilePayload = {
  walletAddress: string
  totalClaimedCusd: number
  suspiciousClaimCount: number
  referralCode: string | null
  lastClaimAt?: string | Date | null
  claims: ProfileClaim[]
  referrals: ProfileReferral[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatWallet(address?: string) {
  if (!address) return 'No wallet connected'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

const CLAIM_BADGE: Record<ProfileClaim['status'], string> = {
  confirmed: 'bg-lime-300/15 text-lime-300 border border-lime-300/25',
  pending:   'bg-amber-300/15 text-amber-300 border border-amber-300/25',
  failed:    'bg-rose-400/15 text-rose-300 border border-rose-300/25',
}

const CLAIM_STATUS_LABEL: Record<ProfileClaim['status'], string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  failed: 'Failed',
}

function SectionHeader({
  icon,
  title,
  description,
  badge,
}: {
  icon: ReactNode
  title: string
  description: string
  badge?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-slate-900/70 text-cyan-300">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-black text-slate-50">{title}</div>
          {badge}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">{description}</div>
      </div>
    </div>
  )
}

function ToggleRow(props: {
  label: string
  description: string
  value: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-3">
      <div>
        <div className="text-sm font-bold text-slate-50">{props.label}</div>
        <div className="mt-1 text-xs text-slate-400">{props.description}</div>
      </div>
      <button
        type="button"
        onClick={props.onToggle}
        aria-pressed={props.value}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
          props.value ? 'border-lime-300/40 bg-lime-300/20' : 'border-cyan-300/20 bg-slate-950'
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full shadow-sm transition-[left] duration-200 ${
            props.value ? 'left-6 bg-lime-300' : 'left-1 bg-slate-500'
          }`}
        />
      </button>
    </div>
  )
}

function StatCard(props: {
  label: string
  value: string
  description: string
  labelColor: string
  borderColor: string
  loading: boolean
  valueSize?: 'lg' | '2xl'
  icon?: ReactNode
}) {
  const sizeClass = props.valueSize === 'lg' ? 'text-lg' : 'text-2xl'
  return (
    <div className={`rounded-xl border ${props.borderColor} bg-slate-950/72 p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${props.labelColor}`}>
          {props.label}
        </div>
        {props.icon && (
          <span className={`opacity-40 ${props.labelColor}`}>{props.icon}</span>
        )}
      </div>
      {props.loading ? (
        <div className="skeleton-shimmer mt-2 h-8 w-28 rounded-lg" />
      ) : (
        <div className={`mt-2 ${sizeClass} font-black text-slate-50`}>{props.value}</div>
      )}
      <div className="mt-1 text-xs text-slate-400">{props.description}</div>
    </div>
  )
}

function ClaimRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="skeleton-shimmer h-5 w-16 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton-shimmer h-4 w-40 rounded-full" />
        <div className="skeleton-shimmer h-3 w-20 rounded-full" />
      </div>
      <div className="space-y-1 text-right">
        <div className="skeleton-shimmer h-4 w-20 rounded-full" />
        <div className="skeleton-shimmer h-3 w-14 rounded-full" />
      </div>
    </div>
  )
}

function ReferralRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="skeleton-shimmer h-5 w-16 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton-shimmer h-4 w-28 rounded-full" />
        <div className="skeleton-shimmer h-3 w-16 rounded-full" />
      </div>
      <div className="space-y-1 text-right">
        <div className="skeleton-shimmer h-3.5 w-16 rounded-full" />
        <div className="skeleton-shimmer h-3 w-12 rounded-full" />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { address, isConnected } = useConnection()
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [addressCopied, setAddressCopied] = useState(false)
  const [taskViewPrefs, setTaskViewPrefs] = useState<TaskViewPreferences>({
    hideCompleted: false,
    showOnlyAccepted: false,
    sortByDeadline: false,
    sortByReward: false,
  })
  const [toastPrefs, setToastPrefs] = useState<ToastPreferences>({
    toastOnSuccess: true,
    toastOnFailure: true,
  })

  const taskViewPrefsKey = useMemo(() => taskViewPreferencesStorageKey(address), [address])

  useEffect(() => {
    if (!address || !isConnected) {
      setProfile(null)
      setPageError(null)
      return
    }

    const controller = new AbortController()

    const loadProfile = async () => {
      setIsLoading(true)
      setPageError(null)

      try {
        const response = await fetch(`/api/profile?walletAddress=${encodeURIComponent(address)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Failed to fetch profile.')
        const data = (await response.json()) as { profile: ProfilePayload }
        setProfile(data.profile)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to load profile:', error)
        setPageError('Failed to load your profile details.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadProfile()
    return () => controller.abort()
  }, [address, isConnected])

  useEffect(() => {
    setTaskViewPrefs(readTaskViewPreferences(window.localStorage.getItem(taskViewPrefsKey)))
  }, [taskViewPrefsKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(taskViewPrefsKey, JSON.stringify(taskViewPrefs))
    } catch {
      // ignore persistence failures
    }
  }, [taskViewPrefs, taskViewPrefsKey])

  useEffect(() => {
    setToastPrefs(readToastPreferences(window.localStorage.getItem(TOAST_PREFERENCES_STORAGE_KEY)))
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(TOAST_PREFERENCES_STORAGE_KEY, JSON.stringify(toastPrefs))
    } catch {
      // ignore persistence failures
    }
  }, [toastPrefs])

  const referrals = profile?.referrals ?? []
  const completedReferrals = useMemo(
    () => referrals.reduce((n, r) => (r.status === 'completed' ? n + 1 : n), 0),
    [referrals],
  )
  const totalReferralEarned = useMemo(
    () => referrals.reduce((sum, r) => (r.status === 'completed' ? sum + r.rewardCusd : sum), 0),
    [referrals],
  )
  const pendingClaims = useMemo(
    () => (profile?.claims ?? []).filter((c) => c.status === 'pending'),
    [profile],
  )

  const handleCopyAddress = async () => {
    if (!address) return
    try {
      await copyText(address)
      setAddressCopied(true)
      setTimeout(() => setAddressCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  if (!isConnected) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.97),rgba(5,10,28,0.98))] p-10 text-center shadow-[0_0_60px_rgba(34,211,238,0.06)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-300/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-lime-300/5 blur-3xl" />
          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-slate-900/80 shadow-[0_0_0_1px_rgba(34,211,238,0.1)]">
              <svg
                className="h-9 w-9 text-cyan-400/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                />
              </svg>
            </div>
            <div className="mt-5 text-base font-black text-slate-50">No wallet connected</div>
            <div className="mt-2 text-sm text-slate-400">
              Connect a wallet on the Tap page to see your profile, claims, and referrals.
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-[11px] font-semibold text-cyan-300/70">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
              Celo Mainnet
            </div>
          </div>
        </section>
      </main>
    )
  }

  const monogram = address ? address.slice(2, 4).toUpperCase() : '??'
  const isTrusted = profile !== null && profile.suspiciousClaimCount === 0

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-28 pt-4">
      {pageError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {pageError}
        </p>
      )}

      {/* Wallet hero */}
      <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(15,23,42,0.97),rgba(5,10,28,0.98))] px-5 py-5 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-cyan-300/8 blur-2xl" />

        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-lime-400/20 text-xl font-black text-slate-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_0_3px_rgba(34,211,238,0.06),inset_0_1px_0_rgba(255,255,255,0.1)]">
              {monogram}
            </div>
            {!isLoading && isTrusted && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-900 bg-lime-400 shadow-sm">
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3 text-slate-900">
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L5 8.586l5.293-5.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                Primary Wallet
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-0.5 text-[10px] font-semibold text-cyan-300/70">
                <span className="h-1 w-1 rounded-full bg-cyan-400/70" />
                Celo
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <span className="truncate font-mono text-base font-black text-slate-50">
                {formatWallet(address)}
              </span>
              <button
                type="button"
                onClick={handleCopyAddress}
                className="shrink-0 rounded-lg border border-cyan-300/20 bg-slate-950/60 px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition hover:bg-cyan-300/10 hover:text-slate-200"
              >
                {addressCopied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={`${stableTaskConfig.chain.blockExplorers?.default.url}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-cyan-300/20 bg-slate-950/60 px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition hover:bg-cyan-300/10 hover:text-slate-200"
              >
                Explorer ↗
              </a>
            </div>

            <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
              {isLoading ? (
                <div className="skeleton-shimmer h-3 w-36 rounded-full" />
              ) : (
                <>
                  {profile?.referralCode ? (
                    <span>
                      Code:{' '}
                      <span className="font-bold text-lime-200">{profile.referralCode}</span>
                    </span>
                  ) : (
                    <span>No referral code</span>
                  )}
                  {profile?.lastClaimAt && (
                    <span className="text-slate-600">·</span>
                  )}
                  {profile?.lastClaimAt && (
                    <span>Last active {formatDate(profile.lastClaimAt)}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Claimed"
          value={profile ? `${profile.totalClaimedCusd.toFixed(2)} cUSD` : '—'}
          description="Lifetime withdrawals"
          labelColor="text-lime-200"
          borderColor="border-lime-300/20"
          loading={isLoading}
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" />
            </svg>
          }
        />
        <StatCard
          label="Claims Logged"
          value={profile ? String(profile.claims.length) : '—'}
          description="Recorded reward claims"
          labelColor="text-cyan-200"
          borderColor="border-cyan-300/20"
          loading={isLoading}
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.857-8.809a.75.75 0 00-1.214-.882l-3.17 4.36-1.767-1.767a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l3.574-4.172z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="Referrals Won"
          value={profile ? String(completedReferrals) : '—'}
          description="Completed conversions"
          labelColor="text-amber-200"
          borderColor="border-amber-300/20"
          loading={isLoading}
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 00-11.215 0c-.22.578.254 1.139.872 1.139h9.47z" />
            </svg>
          }
        />
        <StatCard
          label="Last Reward"
          value={profile ? formatDate(profile.lastClaimAt) : '—'}
          description="Most recent claim date"
          labelColor="text-rose-200"
          borderColor="border-rose-300/20"
          loading={isLoading}
          valueSize="lg"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M1 8a7 7 0 1114 0A7 7 0 011 8zm7.75-4.25a.75.75 0 00-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 000-1.5h-2.5v-3.5z" clipRule="evenodd" />
            </svg>
          }
        />
        <div className="col-span-2">
          <StatCard
            label="Referral Earnings"
            value={profile ? `${totalReferralEarned.toFixed(2)} cUSD` : '—'}
            description={`from ${completedReferrals} completed referral${completedReferrals !== 1 ? 's' : ''}`}
            labelColor="text-violet-200"
            borderColor="border-violet-300/20"
            loading={isLoading}
            icon={
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM6.75 5.5a1.25 1.25 0 112.5 0 1.25 1.25 0 01-2.5 0zM5.5 10.5a2.5 2.5 0 115 0H5.5z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Pending claims callout */}
      {!isLoading && pendingClaims.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-amber-300">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-10.25a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm-.75 7a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-amber-200">
              {pendingClaims.length} claim{pendingClaims.length !== 1 ? 's' : ''} pending
            </div>
            <div className="text-[10px] text-slate-500">Awaiting on-chain confirmation</div>
          </div>
        </div>
      )}

      {/* Recent Claims */}
      {(isLoading || (profile && profile.claims.length > 0)) && (
        <section className="game-panel rounded-[1.25rem] p-5">
          <SectionHeader
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            }
            title="Recent Claims"
            description="Your latest reward claim activity."
            badge={
              !isLoading && profile && profile.claims.length > 0 ? (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black text-cyan-300">
                  {profile.claims.length}
                </span>
              ) : undefined
            }
          />
          <div className="divide-y divide-cyan-300/10">
            {isLoading && (
              <>
                <ClaimRowSkeleton />
                <ClaimRowSkeleton />
                <ClaimRowSkeleton />
              </>
            )}
            {!isLoading &&
              profile?.claims.slice(0, 5).map((claim) => (
                <div key={claim._id} className="flex items-center gap-3 py-3">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${CLAIM_BADGE[claim.status]}`}
                  >
                    {CLAIM_STATUS_LABEL[claim.status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-50">
                      {claim.task?.title ?? 'Task reward'}
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(claim.claimedAt)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-black text-lime-100">
                      +{claim.amountCusd.toFixed(2)} cUSD
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Empty claims state */}
      {!isLoading && profile && profile.claims.length === 0 && (
        <EmptyState
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/20 bg-slate-900/60 text-cyan-400/40">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          }
          title="No claims yet"
          description="Complete tasks to record your first reward claim."
        />
      )}

      {/* Settings */}
      <section className="game-panel rounded-[1.25rem] p-5">
        <SectionHeader
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.31 1.726a6.06 6.06 0 011.48.85l1.634-.596a1 1 0 011.21.48l1.18 2.044a1 1 0 01-.26 1.26l-1.39 1.044a6.098 6.098 0 010 1.72l1.39 1.044a1 1 0 01.26 1.26l-1.18 2.044a1 1 0 01-1.21.48l-1.634-.596a6.06 6.06 0 01-1.48.85l-.31 1.726a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.31-1.726a6.06 6.06 0 01-1.48-.85l-1.634.596a1 1 0 01-1.21-.48L2.026 13.17a1 1 0 01.26-1.26l1.39-1.044a6.098 6.098 0 010-1.72L2.286 8.102a1 1 0 01-.26-1.26L3.206 4.8a1 1 0 011.21-.48l1.634.596a6.06 6.06 0 011.48-.85l.31-1.726zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          }
          title="Settings"
          description="Display and notification preferences for this wallet."
        />

        <div className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
          Task View
        </div>
        <div className="grid gap-3">
          <ToggleRow
            label="Hide completed tasks"
            description="Hide tasks you already marked done."
            value={taskViewPrefs.hideCompleted}
            onToggle={() =>
              setTaskViewPrefs((prev) => ({ ...prev, hideCompleted: !prev.hideCompleted }))
            }
          />
          <ToggleRow
            label="Show only accepted"
            description="Only show tasks you accepted or started."
            value={taskViewPrefs.showOnlyAccepted}
            onToggle={() =>
              setTaskViewPrefs((prev) => ({
                ...prev,
                showOnlyAccepted: !prev.showOnlyAccepted,
              }))
            }
          />
          <ToggleRow
            label="Sort by deadline"
            description="Pinned first, then soonest deadlines."
            value={taskViewPrefs.sortByDeadline}
            onToggle={() =>
              setTaskViewPrefs((prev) => ({ ...prev, sortByDeadline: !prev.sortByDeadline }))
            }
          />
          <ToggleRow
            label="Sort by reward"
            description="Pinned first, then highest cUSD (then XP). Takes priority over deadline sort."
            value={taskViewPrefs.sortByReward}
            onToggle={() =>
              setTaskViewPrefs((prev) => ({ ...prev, sortByReward: !prev.sortByReward }))
            }
          />
        </div>

        <div className="my-4 border-t border-slate-800/60" />

        <div className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
          Notifications
        </div>
        <div className="grid gap-3">
          <ToggleRow
            label="Toast on success"
            description="Show toasts for successful actions."
            value={toastPrefs.toastOnSuccess}
            onToggle={() =>
              setToastPrefs((prev) => ({ ...prev, toastOnSuccess: !prev.toastOnSuccess }))
            }
          />
          <ToggleRow
            label="Toast on failure"
            description="Show toasts when something fails."
            value={toastPrefs.toastOnFailure}
            onToggle={() =>
              setToastPrefs((prev) => ({ ...prev, toastOnFailure: !prev.toastOnFailure }))
            }
          />
        </div>
      </section>

      {/* Referral */}
      <section className="game-panel rounded-[1.25rem] p-5">
        <SectionHeader
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          }
          title="Referral"
          description="Share your code and track referred accounts."
        />

        {isLoading && !profile?.referralCode ? (
          <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4">
            <div className="skeleton-shimmer h-4 w-48 rounded-full" />
          </div>
        ) : profile?.referralCode ? (
          <ReferralCard code={profile.referralCode} reward="0.75" />
        ) : (
          <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4 text-sm text-slate-400">
            Referral code will appear after account setup.
          </div>
        )}

        {(isLoading || referrals.length > 0) && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                Activity
              </div>
              {!isLoading && totalReferralEarned > 0 && (
                <div className="text-xs font-black text-lime-300">
                  +{totalReferralEarned.toFixed(2)} cUSD earned
                </div>
              )}
            </div>
            <div className="divide-y divide-cyan-300/10">
              {isLoading && (
                <>
                  <ReferralRowSkeleton />
                  <ReferralRowSkeleton />
                </>
              )}
              {!isLoading &&
                referrals.slice(0, 4).map((referral) => (
                  <div key={referral._id} className="flex items-center gap-3 py-3">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        referral.status === 'completed'
                          ? 'border border-lime-300/25 bg-lime-300/15 text-lime-300'
                          : 'border border-amber-300/25 bg-amber-300/15 text-amber-300'
                      }`}
                    >
                      {referral.status === 'completed' ? 'Done' : 'Pending'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-50">{referral.code}</div>
                      <div className="text-xs text-slate-400">{formatDate(referral.createdAt)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-black text-lime-100">
                        {referral.rewardCusd.toFixed(2)} cUSD
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!isLoading && referrals.length === 0 && (
          <EmptyState
            className="mt-4"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            }
            title="No referrals yet"
            description="Share your code to start earning cUSD per friend."
          />
        )}
      </section>
    </main>
  )
}
