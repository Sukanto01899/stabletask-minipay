export type TaskViewPreferences = {
  hideCompleted: boolean
  showOnlyAccepted: boolean
  sortByDeadline: boolean
}

const DEFAULT_PREFS: TaskViewPreferences = {
  hideCompleted: false,
  showOnlyAccepted: false,
  sortByDeadline: false,
}

export function taskViewPreferencesStorageKey(address?: string) {
  const normalized = address ? address.toLowerCase() : 'guest'
  return `stabletask:prefs:tasks:${normalized}`
}

export function readTaskViewPreferences(raw: string | null): TaskViewPreferences {
  if (!raw) return DEFAULT_PREFS
  try {
    const parsed = JSON.parse(raw) as Partial<TaskViewPreferences> | null
    return {
      hideCompleted: Boolean(parsed?.hideCompleted),
      showOnlyAccepted: Boolean(parsed?.showOnlyAccepted),
      sortByDeadline: Boolean(parsed?.sortByDeadline),
    }
  } catch {
    return DEFAULT_PREFS
  }
}
