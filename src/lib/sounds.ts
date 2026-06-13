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
  // Two-note ascending chime played on a successful task claim.
  claimSuccess: () => {
    if (!isEnabled()) return
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      gain.connect(ctx.destination)
      playTone(880, ctx.currentTime, 0.15, ctx, gain)       // A5
      playTone(1318.5, ctx.currentTime + 0.12, 0.28, ctx, gain) // E6
      setTimeout(() => ctx.close(), 600)
    } catch {
      // AudioContext unavailable — degrade silently
    }
  },
}
