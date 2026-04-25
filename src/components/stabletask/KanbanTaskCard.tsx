'use client'

import { memo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

export type KanbanTaskCardProps = {
  title: string
  reward: string
  deadlineLabel: string
  visitHref?: string
  isPinned?: boolean
  onTogglePin?: (nextPinned: boolean) => void
  isOverdue?: boolean
  actionLabel: string
  onAction?: () => void | Promise<void>
  actionDisabled?: boolean
  secondaryActionLabel?: string
  onSecondaryAction?: () => void | Promise<void>
  secondaryActionDisabled?: boolean
}

export const KanbanTaskCard = memo(function KanbanTaskCard(props: KanbanTaskCardProps) {
  const { toast } = useToast()
  const isPinned = Boolean(props.isPinned)
  const isOverdue = Boolean(props.isOverdue)

  const handleCopyLink = async () => {
    if (!props.visitHref) return
    try {
      await copyText(props.visitHref)
      toast({ title: 'Copied', description: 'Task link copied.', variant: 'success' })
    } catch (error) {
      console.error('Failed to copy task link:', error)
      toast({ title: 'Copy failed', description: 'Could not copy task link.', variant: 'error' })
    }
  }

  return (
    <Card
      className={cn(
        'rounded-[1.5rem] border border-white/70 bg-white/80 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm',
        isOverdue && 'border-rose-200/80 bg-rose-50/60',
      )}
    >
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">{props.title}</div>
            {isOverdue && (
              <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm">
                Overdue
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {props.visitHref && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                aria-label="Copy task link"
                title="Copy link"
              >
                Copy
              </button>
            )}
            {props.onTogglePin && (
              <button
                type="button"
                onClick={() => props.onTogglePin?.(!isPinned)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm shadow-sm transition ${
                  isPinned
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
                aria-label={isPinned ? 'Unpin task' : 'Pin task'}
                title={isPinned ? 'Pinned' : 'Pin'}
              >
                {isPinned ? '★' : '☆'}
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-500">{props.deadlineLabel}</div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700/70">
            Reward
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{props.reward}</div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <div className={props.onSecondaryAction ? 'grid w-full grid-cols-2 gap-2' : 'w-full'}>
          <Button
            type="button"
            className="h-10 w-full rounded-2xl text-sm font-semibold"
            onClick={props.onAction}
            disabled={props.actionDisabled}
          >
            {props.actionLabel}
          </Button>
          {props.onSecondaryAction && (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-2xl text-sm font-semibold"
              onClick={props.onSecondaryAction}
              disabled={props.secondaryActionDisabled}
            >
              {props.secondaryActionLabel ?? 'Unaccept'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
})
