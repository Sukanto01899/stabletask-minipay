export type HapticsPreferences = {
  hapticsEnabled: boolean
}

const DEFAULT_PREFS: HapticsPreferences = {
  hapticsEnabled: true,
}

export const HAPTICS_PREFERENCES_STORAGE_KEY = 'stabletask:prefs:haptics'

export function readHapticsPreferences(raw: string | null): HapticsPreferences {
  if (!raw) return DEFAULT_PREFS
  try {
    const parsed = JSON.parse(raw) as Partial<HapticsPreferences> | null
    return {
      hapticsEnabled: parsed?.hapticsEnabled !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}
