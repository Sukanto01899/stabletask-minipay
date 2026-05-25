/**
 * Streak utility — all dates are UTC date strings ('YYYY-MM-DD').
 */

export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Calculate the new streak given the user's current streak state and today's UTC date.
 *
 * Rules:
 *  - Already active today  → return current streak unchanged (idempotent)
 *  - Active yesterday      → return streak + 1
 *  - Otherwise (gap/never) → reset to 1
 */
export function calculateNewStreak(
  currentStreak: number,
  lastActivityDate: string | null,
  today: string,
): number {
  if (!lastActivityDate) return 1

  if (lastActivityDate === today) return currentStreak // already counted today

  const yesterday = new Date(`${today}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayStr = getUtcDateString(yesterday)

  if (lastActivityDate === yesterdayStr) return currentStreak + 1 // consecutive

  return 1 // gap — restart streak
}

/**
 * Returns true if the streak should actually be updated (i.e., today is a new day).
 * Call this before persisting to avoid redundant DB writes.
 */
export function isNewActivityDay(lastActivityDate: string | null, today: string): boolean {
  return lastActivityDate !== today
}
