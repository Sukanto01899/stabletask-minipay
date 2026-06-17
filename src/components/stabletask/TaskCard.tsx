'use client'

import { memo, useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { haptics } from '@/lib/haptics'
import { sounds } from '@/lib/sounds'
import { cn } from '@/lib/utils'
import type { Difficulty } from '@/hooks/useVaultTasks'

type TaskCardId = bigint | number | string

const DIFFICULTY_STYLES: Record<Difficulty, { badge: string; label: string }> = {
  Easy:   { badge: 'border-lime-400/40 bg-lime-400/10 text-lime-200',   label: '● Easy'   },
  Medium: { badge: 'border-amber-400/40 bg-amber-400/10 text-amber-200', label: '● Medium' },
  Hard:   { badge: 'border-rose-400/40 bg-rose-400/10 text-rose-200',   label: '● Hard'   },
}

const COUNTDOWN_STYLES: Record<'today' | 'soon' | 'later', string> = {
  today: 'border-rose-300/40 bg-rose-500/15 text-rose-100',
  soon:  'border-amber-300/40 bg-amber-400/15 text-amber-100',
  later: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const s = DIFFICULTY_STYLES[difficulty]
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${s.badge}`}>
      {s.label}
    </span>
  )
}

export type TaskCardProps = {
  taskId?: TaskCardId
  title: string
  description: string
  reward: string
  tag?: string
  difficulty?: Difficulty
  isPinned?: boolean
  onTogglePin?: (taskId: TaskCardId, nextPinned: boolean) => void
  deadlineLabel?: string
  isOverdue?: boolean
  deadlineCountdown?: { label: string; urgency: 'today' | 'soon' | 'later' }
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
  const buttonLabel = isClaimed ? 'Claimed' : isPending ? 'Claiming...' : 'Claim'
  const visitLabel = props.isVisited ? 'Visited' : isVisiting ? 'Opening...' : 'Visit'
  const visitUrlLabel = props.visitHref ? getVisitUrlLabel(props.visitHref) : null
  const isPinned = Boolean(props.isPinned)
  const isOverdue = Boolean(props.isOverdue)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [claimFlash, setClaimFlash] = useState(false)

  const prevClaimState = useRef(props.claimState)
  useEffect(() => {
    const justClaimed = prevClaimState.current !== 'success' && props.claimState === 'success'
    prevClaimState.current = props.claimState
    if (!justClaimed) return

    const val = parseFloat(props.reward)
    if (!isNaN(val) && val >= 1.5) {
      sounds.claimSuccessBig()
      haptics.successBig()
    } else if (!isNaN(val) && val >= 0.5) {
      sounds.claimSuccessMedium()
      haptics.successMedium()
    } else {
      sounds.claimSuccess()
      haptics.success()
    }
    setClaimFlash(true)
    const t = setTimeout(() => setClaimFlash(false), 900)
    return () => clearTimeout(t)
  }, [props.claimState, props.reward])

  const handleVisit = () => {
    if (!props.onVisit || props.taskId === undefined) return
    haptics.tap()
    props.onVisit(props.taskId, props.visitHref, props.isVisited)
  }

  const handleClaim = () => {
    if (!props.onClaim || props.taskId === undefined) return
    haptics.tap()
    props.onClaim(props.taskId, props.isVisited, isClaimed)
  }

  const handleTogglePin = () => {
    if (!props.onTogglePin || props.taskId === undefined) return
    props.onTogglePin(props.taskId, !isPinned)
  }

  const handleCopyLink = async () => {
    if (!props.visitHref || linkCopied) return
    try {
      await copyText(props.visitHref)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    } catch (error) {
      console.error('Failed to copy task link:', error)
      toast({ title: 'Copy failed', description: 'Could not copy task link.', variant: 'error' })
    }
  }

  const handleShare = async () => {
    const shareText = `${props.title} — earn ${props.reward} on StableTask`
    const shareUrl = props.visitHref
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: props.title,
          text: shareText,
          ...(shareUrl ? { url: shareUrl } : {}),
        })
        return
      }
      // Web Share unsupported (e.g. desktop): copy the share text + link instead.
      await copyText(shareUrl ? `${shareText}\n${shareUrl}` : shareText)
      toast({ title: 'Copied', description: 'Share text copied to clipboard.', variant: 'success' })
    } catch (error) {
      // Dismissing the native share sheet throws AbortError — not a real failure.
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Failed to share task:', error)
      toast({ title: 'Share failed', description: 'Could not share this task.', variant: 'error' })
    }
  }

  const handleNoteChange = (value: string) => {
    if (!props.onNoteChange || props.taskId === undefined) return
    props.onNoteChange(props.taskId, value)
  }

  return (
    <Card
      className={cn(
        'game-panel rounded-[1.25rem] py-5',
        isOverdue && 'border-rose-400/50 bg-rose-950/35',
      )}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-black text-slate-50">{props.title}</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {props.onTogglePin && (
              <button
                type="button"
                onClick={handleTogglePin}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm shadow-sm transition',
                  isPinned
                    ? 'border-amber-300/45 bg-amber-300/15 text-amber-100'
                    : 'border-cyan-300/20 bg-slate-900/70 text-slate-400 hover:bg-cyan-300/10',
                )}
                aria-label={isPinned ? 'Unpin task' : 'Pin task'}
                title={isPinned ? 'Pinned' : 'Pin'}
              >
                {isPinned ? '★' : '☆'}
              </button>
            )}
            {isOverdue && (
              <Badge className="border border-rose-300/40 bg-rose-500/15 text-rose-100 shadow-sm">
                Overdue
              </Badge>
            )}
            {!isOverdue && props.deadlineCountdown && (
              <Badge className={cn('border shadow-sm', COUNTDOWN_STYLES[props.deadlineCountdown.urgency])}>
                {props.deadlineCountdown.label}
              </Badge>
            )}
            {props.tag && (
              <Badge className="border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-sm">
                {props.tag}
              </Badge>
            )}
            {props.difficulty && <DifficultyBadge difficulty={props.difficulty} />}
          </div>
        </div>
        {props.deadlineLabel && (
          <div className={cn('text-xs', isOverdue ? 'text-rose-200' : 'text-slate-400')}>
            {props.deadlineLabel}
          </div>
        )}
        <div className="text-sm text-slate-300">{props.description}</div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'rounded-xl border border-lime-300/25 bg-[linear-gradient(90deg,rgba(132,204,22,0.13),rgba(34,211,238,0.12),rgba(245,158,11,0.1))] px-4 py-3',
            claimFlash && 'animate-claim-flash',
          )}
        >
          <div className="text-xs font-black uppercase tracking-[0.2em] text-lime-200">Reward</div>
          <div className="mt-1 text-2xl font-black tabular-nums text-slate-50">{props.reward}</div>
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
              className="rounded-full border border-cyan-300/20 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-cyan-300/10"
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
              className="min-w-0 flex-1 truncate text-xs text-slate-400 underline-offset-4 hover:text-cyan-100 hover:underline"
            >
              Link: {visitUrlLabel}
            </a>
            <div className="flex shrink-0 items-center gap-2">
              {props.onNoteChange && (
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  className="rounded-full border border-cyan-300/20 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-cyan-300/10"
                  aria-expanded={detailsOpen}
                >
                  {detailsOpen ? 'Hide' : 'Details'}
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={linkCopied}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition',
                  linkCopied
                    ? 'border-lime-300/40 bg-lime-300/10 text-lime-300'
                    : 'border-cyan-300/20 bg-slate-900/70 text-slate-300 hover:bg-cyan-300/10',
                )}
                aria-label="Copy task link"
              >
                {linkCopied ? (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  'Copy'
                )}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-xs font-semibold text-lime-100 transition hover:bg-lime-300/20"
                aria-label="Share task"
              >
                Share
              </button>
            </div>
          </div>
        )}
        {props.onNoteChange && detailsOpen && (
          <div className="w-full rounded-xl border border-cyan-300/20 bg-slate-950/60 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Notes</div>
            <textarea
              value={props.note ?? ''}
              onChange={(event) => handleNoteChange(event.target.value)}
              rows={3}
              placeholder="Add a note for yourself (saved on this device)."
              className="mt-2 w-full resize-none rounded-xl border border-cyan-300/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-lime-300/50"
            />
          </div>
        )}
        {props.helperText && (
          <div className={cn('text-xs', props.claimState === 'error' ? 'text-destructive' : 'text-slate-400')}>
            {props.helperText}
          </div>
        )}
      </CardFooter>
    </Card>
  )
})
