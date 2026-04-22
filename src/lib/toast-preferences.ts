export type ToastPreferences = {
  toastOnSuccess: boolean
  toastOnFailure: boolean
}

const DEFAULT_PREFS: ToastPreferences = {
  toastOnSuccess: true,
  toastOnFailure: true,
}

export const TOAST_PREFERENCES_STORAGE_KEY = 'stabletask:prefs:toast'

export function readToastPreferences(raw: string | null): ToastPreferences {
  if (!raw) return DEFAULT_PREFS
  try {
    const parsed = JSON.parse(raw) as Partial<ToastPreferences> | null
    return {
      toastOnSuccess: parsed?.toastOnSuccess !== false,
      toastOnFailure: parsed?.toastOnFailure !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

