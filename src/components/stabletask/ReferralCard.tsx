import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ReferralCard(props: { code: string; reward: string }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="text-lg font-semibold">Referral Boost</div>
        <div className="text-sm text-muted-foreground">
          Share your code and earn {props.reward} cUSD per friend.
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm font-medium">
          {props.code}
        </div>
        <Button variant="secondary" className="shrink-0">
          Copy
        </Button>
      </CardContent>
    </Card>
  )
}
