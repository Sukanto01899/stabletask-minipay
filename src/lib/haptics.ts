// Lightweight haptic feedback for the mini app. Wraps navigator.vibrate so the
// patterns live in one place and degrade silently where vibration is
// unsupported (desktop browsers, iOS Safari) or disabled by the user.

import { HAPTICS_PREFERENCES_STORAGE_KEY, readHapticsPreferences } from './haptics-preferences'

type VibratePattern = number | number[]

function buzz(pattern: VibratePattern) {
  if (typeof navigator === 'undefined') return
  if (typeof window !== 'undefined') {
    const prefs = readHapticsPreferences(window.localStorage.getItem(HAPTICS_PREFERENCES_STORAGE_KEY))
    if (!prefs.hapticsEnabled) return
  }
  navigator.vibrate?.(pattern)
}

export const haptics = {
  // Immediate feedback on a button/gesture press, before any async work.
  tap: () => buzz(30),
  // Celebratory pattern — small reward.
  success: () => buzz([25, 40, 70]),
  // Slightly longer pulse — medium reward.
  successMedium: () => buzz([30, 25, 60, 25, 90]),
  // Longer celebratory burst — high reward.
  successBig: () => buzz([40, 20, 80, 20, 120, 20, 130]),
  // Longer single buzz signalling a failure.
  error: () => buzz(200),
}
