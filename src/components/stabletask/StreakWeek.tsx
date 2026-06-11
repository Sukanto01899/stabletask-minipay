'use client'

import { cn } from '@/lib/utils'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

/** Adds `days` to a 'YYYY-MM-DD' UTC date string, returning a new UTC date string. */
function shiftUtcDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Builds the set of UTC date strings covered by the current streak.
 * The streak is `streakCount` consecutive days ending on `lastActivityDate`.
 */
function buildActiveDates(streakCount: number, lastActivityDate: string | null): Set<string> {
  const active = new Set<string>()
  if (!lastActivityDate || streakCount <= 0) return active
  for (let i = 0; i < streakCount; i += 1) {
    active.add(shiftUtcDate(lastActivityDate, -i))
  }
  return active
}

/** Returns the 7 UTC date strings for the current Mon–Sun week. */
function currentWeekDates(): string[] {
  const todayUtc = new Date().toISOString().slice(0, 10)
  // getUTCDay(): 0=Sun..6=Sat. Days since Monday for a Monday-start week.
  const offsetFromMonday = (new Date(`${todayUtc}T00:00:00.000Z`).getUTCDay() + 6) % 7
  const monday = shiftUtcDate(todayUtc, -offsetFromMonday)
  return Array.from({ length: 7 }, (_, i) => shiftUtcDate(monday, i))
}

/**
 * StreakWeek — a row of 7 dots for the current Mon–Sun week.
 * Active days (within the current streak) are filled, today is ringed,
 * and future days are muted.
 */
export function StreakWeek(props: {
  streakCount: number
  lastActivityDate: string | null
  className?: string
}) {
  const todayUtc = new Date().toISOString().slice(0, 10)
  const week = currentWeekDates()
  const activeDates = buildActiveDates(props.streakCount, props.lastActivityDate)

  return (
    <div className={cn('flex items-center justify-between gap-1', props.className)}>
      {week.map((dateStr, i) => {
        const isActive = activeDates.has(dateStr)
        const isToday = dateStr === todayUtc
        const isFuture = dateStr > todayUtc

        return (
          <div key={dateStr} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                'text-[10px] font-bold uppercase',
                isToday ? 'text-orange-200' : 'text-slate-500',
              )}
            >
              {DAY_LABELS[i]}
            </span>
            <span
              aria-hidden
              className={cn(
                'h-3 w-3 rounded-full border transition-colors',
                isActive
                  ? 'border-orange-300/60 bg-gradient-to-br from-orange-400 to-amber-300 shadow-[0_0_8px_rgba(251,146,60,0.5)]'
                  : isFuture
                    ? 'border-slate-700/60 bg-slate-800/40'
                    : 'border-slate-700 bg-slate-800',
                isToday && 'ring-2 ring-orange-300/50 ring-offset-1 ring-offset-slate-950',
              )}
            />
          </div>
        )
      })}
    </div>
  )
}
