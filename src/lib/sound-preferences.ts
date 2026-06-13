export type SoundPreferences = {
  soundEnabled: boolean
}

const DEFAULT_PREFS: SoundPreferences = {
  soundEnabled: true,
}

export const SOUND_PREFERENCES_STORAGE_KEY = 'stabletask:prefs:sound'

export function readSoundPreferences(raw: string | null): SoundPreferences {
  if (!raw) return DEFAULT_PREFS
  try {
    const parsed = JSON.parse(raw) as Partial<SoundPreferences> | null
    return {
      soundEnabled: parsed?.soundEnabled !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}
