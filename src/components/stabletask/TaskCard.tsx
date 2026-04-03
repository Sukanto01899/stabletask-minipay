import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type TaskCardProps = {
  title: string
  description: string
  reward: string
  tag?: string
  onClaim?: () => void
  claimState?: 'idle' | 'pending' | 'success' | 'error'
  claimDisabled?: boolean
  helperText?: string
}

export function TaskCard(props: TaskCardProps) {
  const isClaimed = props.claimState === 'success'
  const isPending = props.claimState === 'pending'
  const buttonLabel = isClaimed ? 'Claimed' : isPending ? 'Claiming...' : 'Claim'

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold">{props.title}</div>
          {props.tag && <Badge className="bg-slate-100 text-slate-900">{props.tag}</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">{props.description}</div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">Reward</div>
        <div className="text-2xl font-semibold">{props.reward} cUSD</div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full"
          onClick={props.onClaim}
          disabled={props.claimDisabled || isClaimed}
          variant={isClaimed ? 'secondary' : 'default'}
        >
          {buttonLabel}
        </Button>
        {props.helperText && (
          <div className={cn('text-xs', props.claimState === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {props.helperText}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
