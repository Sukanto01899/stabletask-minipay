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
  if (!value) return 'No activity yet'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'No activity yet'
  return dateFormatter.format(date)
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
}) {
  return (
    <div className={`rounded-xl border ${props.borderColor} bg-slate-950/72 p-4 shadow-sm`}>
      <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${props.labelColor}`}>
        {props.label}
      </div>
      {props.loading ? (
        <div className="skeleton-shimmer mt-2 h-8 w-28 rounded-lg" />
      ) : (
        <div className="mt-2 text-2xl font-black text-slate-50">{props.value}</div>
      )}
      <div className="mt-1 text-xs text-slate-400">{props.description}</div>
    </div>
  )
}

function ReferralRowSkeleton() {
  return (
    <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-4 w-32 rounded-full" />
          <div className="skeleton-shimmer h-3 w-20 rounded-full" />
        </div>
        <div className="skeleton-shimmer h-6 w-16 rounded-full" />
      </div>
      <div className="skeleton-shimmer mt-3 h-4 w-40 rounded-full" />
    </div>
  )
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
            {profile?.referralCode
              ? `Referral code: ${profile.referralCode}`
              : 'Referral code will appear after account setup.'}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Claimed"
          value={profile ? `${profile.totalClaimedCusd.toFixed(2)} cUSD` : '0.00 cUSD'}
          description="Lifetime reward withdrawals"
          labelColor="text-lime-200"
          borderColor="border-lime-300/20"
          loading={isLoading}
        />
        <StatCard
          label="Claims Logged"
          value={profile ? String(profile.claims.length) : '0'}
          description="Recorded reward claims"
          labelColor="text-cyan-200"
          borderColor="border-cyan-300/20"
          loading={isLoading}
        />
        <StatCard
          label="Referrals Won"
          value={profile ? String(completedReferrals) : '0'}
          description="Completed referral conversions"
          labelColor="text-amber-200"
          borderColor="border-amber-300/20"
          loading={isLoading}
        />
        <StatCard
          label="Last Reward"
          value={profile ? formatDate(profile.lastClaimAt) : formatDate(null)}
          description="Most recent claim activity"
          labelColor="text-rose-200"
          borderColor="border-rose-300/20"
          loading={isLoading}
        />
      </section>

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Task Preferences</div>
        <div className="mt-1 text-xs text-slate-400">These filters apply on the Tasks screen for this wallet.</div>
        <div className="mt-4 grid gap-3">
          <ToggleRow
            label="Hide completed tasks"
            description="Hide tasks you already marked done."
            value={taskViewPrefs.hideCompleted}
            onToggle={() => setTaskViewPrefs((prev) => ({ ...prev, hideCompleted: !prev.hideCompleted }))}
          />
          <ToggleRow
            label="Show only accepted"
            description="Only show tasks you accepted (or started)."
            value={taskViewPrefs.showOnlyAccepted}
            onToggle={() => setTaskViewPrefs((prev) => ({ ...prev, showOnlyAccepted: !prev.showOnlyAccepted }))}
          />
          <ToggleRow
            label="Sort by deadline"
            description="Pinned first, then soonest deadlines."
            value={taskViewPrefs.sortByDeadline}
            onToggle={() => setTaskViewPrefs((prev) => ({ ...prev, sortByDeadline: !prev.sortByDeadline }))}
          />
        </div>
      </section>

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Notifications</div>
        <div className="mt-1 text-xs text-slate-400">Control which toast messages you want to see.</div>
        <div className="mt-4 grid gap-3">
          <ToggleRow
            label="Toast on success"
            description="Show toasts for successful actions (copy/accept/done/claim)."
            value={toastPrefs.toastOnSuccess}
            onToggle={() => setToastPrefs((prev) => ({ ...prev, toastOnSuccess: !prev.toastOnSuccess }))}
          />
          <ToggleRow
            label="Toast on failure"
            description="Show toasts when something fails (tx rejected, copy failed, etc)."
            value={toastPrefs.toastOnFailure}
            onToggle={() => setToastPrefs((prev) => ({ ...prev, toastOnFailure: !prev.toastOnFailure }))}
          />
        </div>
      </section>

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Referral</div>
        <div className="mt-1 text-xs text-slate-400">Keep your referral code with the rest of your account tools.</div>
        <div className="mt-4">
          {profile?.referralCode ? (
            <ReferralCard code={profile.referralCode} reward="0.75" />
          ) : (
            <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4 text-sm text-slate-400">
              Referral code will appear after account setup.
            </div>
          )}
        </div>
      </section>

      <section className="game-panel rounded-[1.25rem] p-5">
        <div className="text-sm font-black text-slate-50">Referral Activity</div>
        <div className="mt-1 text-xs text-slate-400">Monitor code performance and referred-account outcomes.</div>
        <div className="mt-4 grid gap-3">
          {isLoading && (
            <>
              <ReferralRowSkeleton />
              <ReferralRowSkeleton />
            </>
          )}
          {!isLoading && referrals.length === 0 && (
            <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-4 py-4 text-sm text-slate-400">
              No referral activity has been recorded yet.
            </div>
          )}
          {!isLoading &&
            referrals.slice(0, 4).map((referral) => (
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
