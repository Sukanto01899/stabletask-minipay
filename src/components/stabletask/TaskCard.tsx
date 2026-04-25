'use client'

import { memo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

type TaskCardId = bigint | number | string

export type TaskCardProps = {
  taskId?: TaskCardId
  title: string
  description: string
  reward: string
  tag?: string
  isPinned?: boolean
  onTogglePin?: (taskId: TaskCardId, nextPinned: boolean) => void
  deadlineLabel?: string
  isOverdue?: boolean
  note?: string
  onNoteChange?: (taskId: TaskCardId, note: string) => void
  visitHref?: string
  onVisit?: (taskId: TaskCardId, visitHref?: string, isVisited?: boolean) => void | Promise<void>
  onClaim?: (taskId: TaskCardId, isVisited?: boolean, isClaimed?: boolean) => void | Promise<void>
  isVisited?: boolean
  visitState?: 'idle' | 'pending' | 'success' | 'error'
  claimState?: 'idle' | 'pending' | 'success' | 'error'
  visitDisabled?: boolean
  claimDisabled?: boolean
  helperText?: string
}

function getVisitUrlLabel(href: string) {
  try {
    const url = new URL(href)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

export const TaskCard = memo(function TaskCard(props: TaskCardProps) {
  const { toast } = useToast()
  const isClaimed = props.claimState === 'success'
  const isPending = props.claimState === 'pending'
  const isVisiting = props.visitState === 'pending'
  const buttonLabel = isClaimed ? 'Claimed' : isPending ? 'Claiming...' : 'Claim XP'
  const visitLabel = props.isVisited ? 'Visited' : isVisiting ? 'Opening...' : 'Visit'
  const visitUrlLabel = props.visitHref ? getVisitUrlLabel(props.visitHref) : null
  const isPinned = Boolean(props.isPinned)
  const isOverdue = Boolean(props.isOverdue)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleVisit = () => {
    if (!props.onVisit || props.taskId === undefined) return
    props.onVisit(props.taskId, props.visitHref, props.isVisited)
  }

  const handleClaim = () => {
    if (!props.onClaim || props.taskId === undefined) return
    props.onClaim(props.taskId, props.isVisited, isClaimed)
  }

  const handleTogglePin = () => {
    if (!props.onTogglePin || props.taskId === undefined) return
    props.onTogglePin(props.taskId, !isPinned)
  }

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

  const handleNoteChange = (value: string) => {
    if (!props.onNoteChange || props.taskId === undefined) return
    props.onNoteChange(props.taskId, value)
  }

  return (
    <Card
      className={cn(
        'rounded-[1.75rem] border border-white/70 bg-white/80 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm',
        isOverdue && 'border-rose-200/80 bg-rose-50/60',
      )}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold text-slate-900">{props.title}</div>
          <div className="flex items-center gap-2">
            {props.onTogglePin && (
              <button
                type="button"
                onClick={handleTogglePin}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm shadow-sm transition',
                  isPinned
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                )}
                aria-label={isPinned ? 'Unpin task' : 'Pin task'}
                title={isPinned ? 'Pinned' : 'Pin'}
              >
                {isPinned ? '★' : '☆'}
              </button>
            )}
            {isOverdue && (
              <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm">
                Overdue
              </Badge>
            )}
            {props.tag && (
              <Badge className="border border-blue-200 bg-blue-50 text-blue-700 shadow-sm">
                {props.tag}
              </Badge>
            )}
          </div>
        </div>
        {props.deadlineLabel && (
          <div className={cn('text-xs', isOverdue ? 'text-rose-700' : 'text-slate-500')}>
            {props.deadlineLabel}
          </div>
        )}
        <div className="text-sm text-slate-600">{props.description}</div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700/70">Reward</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{props.reward}</div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="grid w-full grid-cols-2 gap-3">
          <Button
            className="h-11 rounded-2xl text-sm font-semibold"
            onClick={handleVisit}
            disabled={props.visitDisabled || props.isVisited}
            variant="secondary"
          >
            {visitLabel}
          </Button>
          <Button
            className="h-11 rounded-2xl text-sm font-semibold shadow-[0_14px_30px_rgba(37,99,235,0.2)]"
            onClick={handleClaim}
            disabled={props.claimDisabled || isClaimed}
            variant={isClaimed ? 'secondary' : 'default'}
          >
            {buttonLabel}
          </Button>
        </div>
        {props.onNoteChange && !props.visitHref && (
          <div className="flex w-full justify-end">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? 'Hide' : 'Details'}
            </button>
          </div>
        )}
        {props.visitHref && visitUrlLabel && (
          <div className="flex w-full items-center justify-between gap-3">
            <a
              href={props.visitHref}
              target="_blank"
              rel="noreferrer noopener"
              title={props.visitHref}
              className="min-w-0 flex-1 truncate text-xs text-slate-500 underline-offset-4 hover:underline"
            >
              Link: {visitUrlLabel}
            </a>
            <div className="flex shrink-0 items-center gap-2">
              {props.onNoteChange && (
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  aria-expanded={detailsOpen}
                >
                  {detailsOpen ? 'Hide' : 'Details'}
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                aria-label="Copy task link"
              >
                Copy
              </button>
            </div>
          </div>
        )}
        {props.onNoteChange && detailsOpen && (
          <div className="w-full rounded-2xl border border-slate-200 bg-white/70 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</div>
            <textarea
              value={props.note ?? ''}
              onChange={(event) => handleNoteChange(event.target.value)}
              rows={3}
              placeholder="Add a note for yourself (saved on this device)."
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>
        )}
        {props.helperText && (
          <div className={cn('text-xs', props.claimState === 'error' ? 'text-destructive' : 'text-slate-500')}>
            {props.helperText}
          </div>
        )}
      </CardFooter>
    </Card>
  )
})
