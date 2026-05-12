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
      className: 'border-lime-300/35 bg-lime-300/12 text-lime-100',
      description: 'No suspicious claim behavior has been recorded on this account.',
    }
  }

  if (suspiciousClaimCount < 3) {
    return {
      label: 'Reviewing',
      className: 'border-amber-300/35 bg-amber-300/12 text-amber-100',
      description: 'Some claim activity has been flagged. Keep usage clean and consistent.',
    }
  }

  return {
    label: 'High Risk',
    className: 'border-rose-300/35 bg-rose-500/15 text-rose-100',
    description: 'This wallet has repeated suspicious claim signals and may require review.',
  }
}

export default function ProfilePage() {
  const { address, isConnected } = useConnection()
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
        className: 'border-cyan-300/20 bg-slate-900/70 text-slate-300',
        description: 'Connect your wallet to load trust signals and recent reward activity.',
      }
    }

    if (isLoading && !profile) {
      return {
        label: 'Loading',
        className: 'border-cyan-300/20 bg-slate-900/70 text-slate-300',
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
        <section className="game-panel-strong rounded-[1.5rem] p-5">
          <div className="text-sm font-black text-slate-50">Connect to view your profile</div>
          <div className="mt-1 text-xs text-slate-400">
            Link a wallet to see claims, referrals, and account trust signals.
          </div>
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Wallet Status</div>
            <div className="mt-1 text-sm font-semibold text-slate-50">{formatWallet(address)}</div>
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-28 pt-4">
      {pageError && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {pageError}
        </p>
      )}

      <section className="relative flex items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4 backdrop-blur">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Primary Wallet</div>
          <div className="mt-1 truncate text-lg font-black text-slate-50">{formatWallet(address)}</div>
          <div className="mt-1 text-xs text-slate-400">
            {profile?.referralCode ? `Referral code: ${profile.referralCode}` : 'Referral code will appear after account setup.'}
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-bold ${riskTone.className}`}>
          {riskTone.label}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-lime-300/20 bg-slate-950/72 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-200">Total Claimed</div>
          <div className="mt-2 text-2xl font-black text-slate-50">{totalClaimedDisplay}</div>
          <div className="mt-1 text-xs text-slate-400">Lifetime reward withdrawals</div>
        </div>
        <div className="rounded-xl border border-cyan-300/20 bg-slate-950/72 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Claims Logged</div>
          <div className="mt-2 text-2xl font-black text-slate-50">{claimCountDisplay}</div>
          <div className="mt-1 text-xs text-slate-400">Recorded reward claims</div>
        </div>
        <div className="rounded-xl border border-amber-300/20 bg-slate-950/72 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">Referrals Won</div>
          <div className="mt-2 text-2xl font-black text-slate-50">{profile ? completedReferrals : isLoading ? '—' : '0'}</div>
          <div className="mt-1 text-xs text-slate-400">Completed referral conversions</div>
        </div>
        <div className="rounded-xl border border-rose-300/20 bg-slate-950/72 p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-200">Last Reward</div>
          <div className="mt-2 text-lg font-black text-slate-50">{lastClaimDisplay}</div>
          <div className="mt-1 text-xs text-slate-400">Most recent claim activity</div>
        </div>
      </section>

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Task Preferences</div>
        <div className="mt-1 text-xs text-slate-400">These filters apply on the Tasks screen for this wallet.</div>

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

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Notifications</div>
        <div className="mt-1 text-xs text-slate-400">Control which toast messages you want to see.</div>

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

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Referral</div>
        <div className="mt-1 text-xs text-slate-400">Keep your referral code with the rest of your account tools.</div>

        <div className="mt-4">
          <ReferralCard code={profile?.referralCode ?? ''} reward="0.75" />
        </div>
      </section>

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Referral Activity</div>
        <div className="mt-1 text-xs text-slate-400">Monitor code performance and referred-account outcomes.</div>

        <div className="mt-4 grid gap-3">
          {!isLoading && referrals.length === 0 && (
            <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4 text-sm text-slate-400">
              No referral activity has been recorded yet.
            </div>
          )}
          {referrals.slice(0, 4).map((referral) => (
            <div key={referral._id} className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-50">{referral.code}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(referral.createdAt)}</div>
                </div>
                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    referral.status === 'completed'
                      ? 'border-lime-300/35 bg-lime-300/12 text-lime-100'
                      : 'border-amber-300/35 bg-amber-300/12 text-amber-100'
                  }`}
                >
                  {referral.status}
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-300">Reward value: {referral.rewardCusd.toFixed(2)} cUSD</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
