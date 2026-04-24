'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConnection } from 'wagmi'

import { ReferralCard } from '@/components/stabletask/ReferralCard'
import { readTaskViewPreferences, taskViewPreferencesStorageKey, type TaskViewPreferences } from '@/lib/task-view-preferences'
import { readToastPreferences, TOAST_PREFERENCES_STORAGE_KEY, type ToastPreferences } from '@/lib/toast-preferences'

type ProfileClaim = {
  _id: string
  amountCusd: number
  status: 'pending' | 'confirmed' | 'failed'
  txHash?: string | null
  claimedAt?: string | Date | null
  task?: {
    title?: string
  } | null
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
  if (!value) return 'No activity yet'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'No activity yet'

  return dateFormatter.format(date)
}

function getRiskTone(suspiciousClaimCount: number) {
  if (suspiciousClaimCount <= 0) {
    return {
      label: 'Trusted',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      description: 'No suspicious claim behavior has been recorded on this account.',
    }
  }

  if (suspiciousClaimCount < 3) {
    return {
      label: 'Reviewing',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      description: 'Some claim activity has been flagged. Keep usage clean and consistent.',
    }
  }

  return {
    label: 'High Risk',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    description: 'This wallet has repeated suspicious claim signals and may require review.',
  }
}

export default function ProfilePage() {
  const { address, isConnected, chainId } = useConnection()
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
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

        if (!response.ok) {
          throw new Error('Failed to fetch profile.')
        }

        const data = (await response.json()) as { profile: ProfilePayload }
        setProfile(data.profile)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to load profile:', error)
        setPageError('Failed to load your profile details.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => controller.abort()
  }, [address, isConnected])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setTaskViewPrefs(readTaskViewPreferences(window.localStorage.getItem(taskViewPrefsKey)))
  }, [taskViewPrefsKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(taskViewPrefsKey, JSON.stringify(taskViewPrefs))
    } catch {
      // ignore persistence failures
    }
  }, [taskViewPrefs, taskViewPrefsKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setToastPrefs(readToastPreferences(window.localStorage.getItem(TOAST_PREFERENCES_STORAGE_KEY)))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(TOAST_PREFERENCES_STORAGE_KEY, JSON.stringify(toastPrefs))
    } catch {
      // ignore persistence failures
    }
  }, [toastPrefs])

  const riskTone = useMemo(() => {
    if (!isConnected) {
      return {
        label: 'Offline',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
        description: 'Connect your wallet to load trust signals and recent reward activity.',
      }
    }

    if (isLoading && !profile) {
      return {
        label: 'Loading',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
        description: 'Loading trust signals and recent reward activity.',
      }
    }

    return getRiskTone(profile?.suspiciousClaimCount ?? 0)
  }, [isConnected, isLoading, profile])

  const claims = profile?.claims ?? []
  const referrals = profile?.referrals ?? []

  const completedReferrals = useMemo(() => {
    return referrals.reduce((count, referral) => (referral.status === 'completed' ? count + 1 : count), 0)
  }, [referrals])

  const claimCountDisplay = profile ? String(claims.length) : isLoading ? '—' : '0'
  const totalClaimedDisplay = profile ? `${profile.totalClaimedCusd.toFixed(2)} cUSD` : isLoading ? '—' : '0.00 cUSD'
  const lastClaimDisplay = profile ? formatDate(profile.lastClaimAt) : isLoading ? '—' : formatDate(null)

  if (!isConnected) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-950">Connect to view your profile</div>
          <div className="mt-1 text-xs text-slate-500">
            Link a wallet to see claims, referrals, and account trust signals.
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Wallet Status</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{formatWallet(address)}</div>
          </div>
        </section>
      </main>
    )
  }

  const toggleRow = (props: {
    label: string
    description: string
    value: boolean
    onToggle: () => void
  }) => {
    return (
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{props.label}</div>
          <div className="mt-1 text-xs text-slate-500">{props.description}</div>
        </div>
        <button
          type="button"
          onClick={props.onToggle}
          aria-pressed={props.value}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
            props.value ? 'border-emerald-200 bg-emerald-100' : 'border-slate-200 bg-white'
          }`}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full shadow-sm transition ${
              props.value ? 'left-6 bg-emerald-600' : 'left-1 bg-slate-300'
            }`}
          />
        </button>
      </div>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      {pageError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {pageError}
        </p>
      )}

      <section className="relative overflow-hidden rounded-[2rem] border border-violet-200/70 bg-[linear-gradient(150deg,rgba(255,255,255,0.96),rgba(245,243,255,0.98)_45%,rgba(224,231,255,0.96))] p-5 shadow-[0_28px_70px_rgba(79,70,229,0.14)]">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-300/25 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-sky-300/20 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[linear-gradient(180deg,#111827,#4f46e5)] text-xl font-bold text-white shadow-[0_16px_40px_rgba(79,70,229,0.25)]">
            {address ? address.slice(2, 4).toUpperCase() : 'ST'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-700">Professional Profile</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              {isConnected ? 'StableTask member record' : 'Connect your wallet to unlock your profile'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Wallet identity, reward history, referral activity, and account trust signals in one place.
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex items-center justify-between gap-3 rounded-[1.5rem] border border-white/70 bg-white/75 px-4 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Primary Wallet</div>
            <div className="mt-1 truncate text-lg font-semibold text-slate-950">{formatWallet(address)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {profile?.referralCode ? `Referral code: ${profile.referralCode}` : 'Referral code will appear after account setup.'}
            </div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskTone.className}`}>
            {riskTone.label}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total Claimed</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{totalClaimedDisplay}</div>
          <div className="mt-1 text-xs text-slate-500">Lifetime reward withdrawals</div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Claims Logged</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{claimCountDisplay}</div>
          <div className="mt-1 text-xs text-slate-500">Recorded reward claims</div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Referrals Won</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{profile ? completedReferrals : isLoading ? '—' : '0'}</div>
          <div className="mt-1 text-xs text-slate-500">Completed referral conversions</div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Last Reward</div>
          <div className="mt-2 text-lg font-bold text-slate-950">{lastClaimDisplay}</div>
          <div className="mt-1 text-xs text-slate-500">Most recent claim activity</div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">Account Overview</div>
            <div className="mt-1 text-xs text-slate-500">A cleaner view of your wallet reputation and app access.</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {isConnected ? 'Active' : 'Offline'}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Wallet Address</div>
            <div className="mt-1 break-all text-sm font-medium text-slate-900">{address ?? 'No wallet connected'}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Network</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{chainId ? `Chain ID ${chainId}` : 'Unavailable'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Risk Signals</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{profile?.suspiciousClaimCount ?? 0} flags</div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            {riskTone.description}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Task Preferences</div>
        <div className="mt-1 text-xs text-slate-500">These filters apply on the Tasks screen for this wallet.</div>

        <div className="mt-4 grid gap-3">
          {toggleRow({
            label: 'Hide completed tasks',
            description: 'Hide tasks you already marked done.',
            value: taskViewPrefs.hideCompleted,
            onToggle: () =>
              setTaskViewPrefs((prev) => ({ ...prev, hideCompleted: !prev.hideCompleted })),
          })}
          {toggleRow({
            label: 'Show only accepted',
            description: 'Only show tasks you accepted (or started).',
            value: taskViewPrefs.showOnlyAccepted,
            onToggle: () =>
              setTaskViewPrefs((prev) => ({
                ...prev,
                showOnlyAccepted: !prev.showOnlyAccepted,
              })),
          })}
          {toggleRow({
            label: 'Sort by deadline',
            description: 'Pinned first, then soonest deadlines.',
            value: taskViewPrefs.sortByDeadline,
            onToggle: () =>
              setTaskViewPrefs((prev) => ({
                ...prev,
                sortByDeadline: !prev.sortByDeadline,
              })),
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Notifications</div>
        <div className="mt-1 text-xs text-slate-500">Control which toast messages you want to see.</div>

        <div className="mt-4 grid gap-3">
          {toggleRow({
            label: 'Toast on success',
            description: 'Show toasts for successful actions (copy/accept/done/claim).',
            value: toastPrefs.toastOnSuccess,
            onToggle: () =>
              setToastPrefs((prev) => ({ ...prev, toastOnSuccess: !prev.toastOnSuccess })),
          })}
          {toggleRow({
            label: 'Toast on failure',
            description: 'Show toasts when something fails (tx rejected, copy failed, etc).',
            value: toastPrefs.toastOnFailure,
            onToggle: () =>
              setToastPrefs((prev) => ({ ...prev, toastOnFailure: !prev.toastOnFailure })),
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Recent Claims</div>
        <div className="mt-1 text-xs text-slate-500">Latest reward payouts tied to your account.</div>

        <div className="mt-4 grid gap-3">
          {isLoading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
              Loading profile activity...
            </div>
          )}
          {!isLoading && claims.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
              No claims recorded yet for this wallet.
            </div>
          )}
          {claims.slice(0, 4).map((claim) => (
            <div
              key={claim._id}
              className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{claim.task?.title || 'Reward claim'}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(claim.claimedAt)}</div>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {claim.amountCusd.toFixed(2)} cUSD
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>Status: {claim.status}</span>
                <span>{claim.txHash ? `${claim.txHash.slice(0, 8)}...${claim.txHash.slice(-6)}` : 'No tx hash'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Referral</div>
        <div className="mt-1 text-xs text-slate-500">Keep your referral code with the rest of your account tools.</div>

        <div className="mt-4">
          <ReferralCard code={profile?.referralCode ?? ''} reward="0.75" />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-950">Referral Activity</div>
        <div className="mt-1 text-xs text-slate-500">Monitor code performance and referred-account outcomes.</div>

        <div className="mt-4 grid gap-3">
          {!isLoading && referrals.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
              No referral activity has been recorded yet.
            </div>
          )}
          {referrals.slice(0, 4).map((referral) => (
            <div key={referral._id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{referral.code}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(referral.createdAt)}</div>
                </div>
                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    referral.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {referral.status}
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-600">Reward value: {referral.rewardCusd.toFixed(2)} cUSD</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
