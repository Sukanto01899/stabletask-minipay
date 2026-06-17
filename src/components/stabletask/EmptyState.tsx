import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Centered illustration — pass an `<svg className="h-10 w-10 …" />`. */
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Optional call-to-action row, e.g. buttons or links. */
  action?: ReactNode
  className?: string
}

/**
 * EmptyState — shared "nothing here yet" panel used across lists (tasks,
 * rewards, claims, referrals). Keeps the icon + message + action layout
 * consistent so empty lists never render as a bare blank panel.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'game-panel flex flex-col items-center rounded-[1.25rem] px-5 py-8 text-center',
        className,
      )}
    >
      {icon && (
        <div className="animate-icon-breathe mb-3 text-slate-500 [&>svg]:mx-auto">{icon}</div>
      )}
      <div className="text-sm font-bold text-slate-300">{title}</div>
      {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
      {action && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">{action}</div>
      )}
    </div>
  )
}
