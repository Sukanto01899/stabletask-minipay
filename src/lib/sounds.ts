import { readSoundPreferences, SOUND_PREFERENCES_STORAGE_KEY } from './sound-preferences'

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return readSoundPreferences(window.localStorage.getItem(SOUND_PREFERENCES_STORAGE_KEY)).soundEnabled
}

function playTone(frequency: number, startTime: number, duration: number, ctx: AudioContext, gain: GainNode) {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, startTime)
  osc.connect(gain)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export const sounds = {
  // Two-note ascending chime — small reward.
  claimSuccess: () => {
    if (!isEnabled()) return
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      gain.connect(ctx.destination)
      playTone(880, ctx.currentTime, 0.15, ctx, gain)
      playTone(1318.5, ctx.currentTime + 0.12, 0.28, ctx, gain)
      setTimeout(() => ctx.close(), 600)
    } catch {
      // AudioContext unavailable — degrade silently
    }
  },

  // Three-note ascending arpeggio — medium reward.
  claimSuccessMedium: () => {
    if (!isEnabled()) return
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.20, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
      gain.connect(ctx.destination)
      playTone(880, ctx.currentTime, 0.15, ctx, gain)
      playTone(1108.7, ctx.currentTime + 0.14, 0.18, ctx, gain)
      playTone(1318.5, ctx.currentTime + 0.30, 0.40, ctx, gain)
      setTimeout(() => ctx.close(), 1000)
    } catch {}
  },

  // Five-note triumphant fanfare — high reward.
  claimSuccessBig: () => {
    if (!isEnabled()) return
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4)
      gain.connect(ctx.destination)
      playTone(659.3, ctx.currentTime, 0.12, ctx, gain)
      playTone(880, ctx.currentTime + 0.12, 0.12, ctx, gain)
      playTone(1108.7, ctx.currentTime + 0.24, 0.12, ctx, gain)
      playTone(1318.5, ctx.currentTime + 0.36, 0.18, ctx, gain)
      playTone(1760, ctx.currentTime + 0.54, 0.55, ctx, gain)
      setTimeout(() => ctx.close(), 1500)
    } catch {}
  },
}
