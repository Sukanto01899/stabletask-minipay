'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useConnection } from 'wagmi'

import { ReferralCard } from '@/components/stabletask/ReferralCard'
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
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

const CLAIM_STATUS_DOT: Record<ProfileClaim['status'], string> = {
  confirmed: 'bg-lime-400',
  pending: 'bg-amber-400',
  failed: 'bg-rose-400',
}

const CLAIM_STATUS_TEXT: Record<ProfileClaim['status'], string> = {
  confirmed: 'text-lime-400',
  pending: 'text-amber-400',
  failed: 'text-rose-400',
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
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-slate-900/70 text-cyan-300">
        {icon}
      </div>
      <div>
        <div className="text-sm font-black text-slate-50">{title}</div>
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
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full shadow-sm transition ${
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
}) {
  const sizeClass = props.valueSize === 'lg' ? 'text-lg' : 'text-2xl'
  return (
    <div className={`rounded-xl border ${props.borderColor} bg-slate-950/72 p-4 shadow-sm`}>
      <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${props.labelColor}`}>
        {props.label}
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
      <div className="skeleton-shimmer h-2 w-2 shrink-0 rounded-full" />
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
      <div className="skeleton-shimmer h-2 w-2 shrink-0 rounded-full" />
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
        <section className="game-panel-strong flex flex-col items-center rounded-[1.5rem] p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/8">
            <svg
              className="h-8 w-8 text-cyan-400/60"
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
          <div className="mt-4 text-base font-black text-slate-50">No wallet connected</div>
          <div className="mt-2 max-w-[260px] text-sm text-slate-400">
            Connect a wallet on the Tap page to see your claims, referrals, and account details.
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
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-lime-400/15 text-xl font-black text-slate-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]">
            {monogram}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                Primary Wallet
              </div>
              {isTrusted && !isLoading && (
                <span className="rounded-full border border-lime-300/35 bg-lime-300/12 px-2 py-0.5 text-[10px] font-black text-lime-200">
                  Trusted
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate font-mono text-base font-black text-slate-50">
                {formatWallet(address)}
              </span>
              <button
                type="button"
                onClick={handleCopyAddress}
                className="shrink-0 rounded-lg border border-cyan-300/20 bg-slate-950/60 px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition hover:bg-cyan-300/10 hover:text-slate-200"
              >
                {addressCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {isLoading ? (
              <div className="skeleton-shimmer mt-1.5 h-3 w-36 rounded-full" />
            ) : (
              <div className="mt-1.5 text-xs text-slate-400">
                {profile?.referralCode ? (
                  <>
                    Code:{' '}
                    <span className="font-bold text-lime-200">{profile.referralCode}</span>
                  </>
                ) : (
                  'No referral code yet'
                )}
              </div>
            )}
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
        />
        <StatCard
          label="Claims Logged"
          value={profile ? String(profile.claims.length) : '—'}
          description="Recorded reward claims"
          labelColor="text-cyan-200"
          borderColor="border-cyan-300/20"
          loading={isLoading}
        />
        <StatCard
          label="Referrals Won"
          value={profile ? String(completedReferrals) : '—'}
          description="Completed conversions"
          labelColor="text-amber-200"
          borderColor="border-amber-300/20"
          loading={isLoading}
        />
        <StatCard
          label="Last Reward"
          value={profile ? formatDate(profile.lastClaimAt) : '—'}
          description="Most recent claim"
          labelColor="text-rose-200"
          borderColor="border-rose-300/20"
          loading={isLoading}
          valueSize="lg"
        />
      </section>

      {/* Recent Claims — only rendered when loading or data exists */}
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
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${CLAIM_STATUS_DOT[claim.status]}`}
                  />
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
                    <div className={`text-[10px] font-semibold ${CLAIM_STATUS_TEXT[claim.status]}`}>
                      {CLAIM_STATUS_LABEL[claim.status]}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Settings — Task Preferences + Notifications in one panel */}
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
        </div>

        <div className="mb-2 mt-5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
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

      {/* Referral — Card + Activity in one panel */}
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
            <div className="mb-1 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
              Activity
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
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        referral.status === 'completed' ? 'bg-lime-400' : 'bg-amber-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-50">{referral.code}</div>
                      <div className="text-xs text-slate-400">{formatDate(referral.createdAt)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-xs font-semibold ${
                          referral.status === 'completed' ? 'text-lime-300' : 'text-amber-300'
                        }`}
                      >
                        {referral.status === 'completed' ? 'Completed' : 'Pending'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {referral.rewardCusd.toFixed(2)} cUSD
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!isLoading && referrals.length === 0 && (
          <p className="mt-4 text-xs text-slate-500">No referral activity recorded yet.</p>
        )}
      </section>
    </main>
  )
}
