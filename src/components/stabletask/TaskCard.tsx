import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type TaskCardProps = {
  title: string
  description: string
  reward: string
  tag?: string
  visitHref?: string
  onVisit?: () => void
  onClaim?: () => void
  isVisited?: boolean
  visitState?: 'idle' | 'pending' | 'success' | 'error'
  claimState?: 'idle' | 'pending' | 'success' | 'error'
  visitDisabled?: boolean
  claimDisabled?: boolean
  helperText?: string
}

export function TaskCard(props: TaskCardProps) {
  const isClaimed = props.claimState === 'success'
  const isPending = props.claimState === 'pending'
  const isVisiting = props.visitState === 'pending'
  const buttonLabel = isClaimed ? 'Claimed' : isPending ? 'Claiming...' : 'Claim XP'
  const visitLabel = props.isVisited ? 'Visited' : isVisiting ? 'Opening...' : 'Visit'

  return (
    <Card className="rounded-[1.75rem] border border-white/70 bg-white/80 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold text-slate-900">{props.title}</div>
          {props.tag && (
            <Badge className="border border-blue-200 bg-blue-50 text-blue-700 shadow-sm">
              {props.tag}
            </Badge>
          )}
        </div>
        <div className="text-sm text-slate-600">{props.description}</div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700/70">Reward</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{props.reward}</div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="grid w-full grid-cols-2 gap-3">
          <Button
            className="h-11 rounded-2xl text-sm font-semibold"
            onClick={props.onVisit}
            disabled={props.visitDisabled || props.isVisited}
            variant="secondary"
          >
            {visitLabel}
          </Button>
          <Button
            className="h-11 rounded-2xl text-sm font-semibold shadow-[0_14px_30px_rgba(37,99,235,0.2)]"
            onClick={props.onClaim}
            disabled={props.claimDisabled || isClaimed}
            variant={isClaimed ? 'secondary' : 'default'}
          >
            {buttonLabel}
          </Button>
        </div>
        {props.visitHref && (
          <div className="w-full truncate text-xs text-slate-500">
            Visit URL: {props.visitHref}
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
}
