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
  // Celebratory pattern once an action is confirmed on-chain.
  success: () => buzz([25, 40, 70]),
  // Longer single buzz signalling a failure.
  error: () => buzz(200),
}
