'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { readToastPreferences, TOAST_PREFERENCES_STORAGE_KEY, type ToastPreferences } from '@/lib/toast-preferences'

type ToastVariant = 'default' | 'success' | 'error'

export type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
  durationMs?: number
}

type ToastItem = Required<Pick<ToastInput, 'title'>> &
  Omit<ToastInput, 'title'> & {
    id: string
    createdAt: number
  }

type ToastContextValue = {
  toast: (input: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function variantClasses(variant: ToastVariant) {
  if (variant === 'success') return 'border-emerald-200/70 bg-emerald-50/90 text-emerald-950'
  if (variant === 'error') return 'border-destructive/30 bg-destructive/10 text-destructive'
  return 'border-border/60 bg-card/90 text-foreground'
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [prefs, setPrefs] = useState<ToastPreferences>({
    toastOnSuccess: true,
    toastOnFailure: true,
  })
  const timeoutsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPrefs(readToastPreferences(window.localStorage.getItem(TOAST_PREFERENCES_STORAGE_KEY)))

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TOAST_PREFERENCES_STORAGE_KEY) return
      setPrefs(readToastPreferences(event.newValue))
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    const timeoutId = timeoutsRef.current.get(id)
    if (timeoutId) window.clearTimeout(timeoutId)
    timeoutsRef.current.delete(id)
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const variant = input.variant ?? 'default'
      if (variant === 'success' && !prefs.toastOnSuccess) return
      if (variant === 'error' && !prefs.toastOnFailure) return

      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const durationMs = input.durationMs ?? 2200

      setItems((prev) => [
        { id, createdAt: Date.now(), title: input.title, description: input.description, variant, durationMs },
        ...prev,
      ].slice(0, 3))

      const timeoutId = window.setTimeout(() => remove(id), durationMs)
      timeoutsRef.current.set(id, timeoutId)
    },
    [prefs.toastOnFailure, prefs.toastOnSuccess, remove],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] z-[60] mx-auto w-full max-w-md px-5">
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-sm',
                variantClasses(item.variant ?? 'default'),
              )}
              role="status"
              aria-live="polite"
            >
              <div className="text-sm font-semibold">{item.title}</div>
              {item.description && (
                <div className="mt-0.5 text-xs/relaxed opacity-80">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
