import { memo } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export type KanbanTaskCardProps = {
  title: string
  reward: string
  deadlineLabel: string
  actionLabel: string
  onAction?: () => void | Promise<void>
  actionDisabled?: boolean
}

export const KanbanTaskCard = memo(function KanbanTaskCard(props: KanbanTaskCardProps) {
  return (
    <Card className="rounded-[1.5rem] border border-white/70 bg-white/80 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
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
        <Button
          type="button"
          className="h-10 w-full rounded-2xl text-sm font-semibold"
          onClick={props.onAction}
          disabled={props.actionDisabled}
        >
          {props.actionLabel}
        </Button>
      </CardFooter>
    </Card>
  )
})

