import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ReferralCard(props: { code: string; reward: string }) {
  return (
    <Card className="rounded-[1.75rem] border border-blue-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(219,234,254,0.96))] py-5 shadow-[0_18px_50px_rgba(59,130,246,0.12)]">
      <CardHeader>
        <div className="text-lg font-semibold text-slate-950">Referral Boost</div>
        <div className="text-sm text-slate-600">
          Share your code and earn {props.reward} cUSD per friend.
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="rounded-2xl border border-dashed border-blue-300 bg-white/80 px-4 py-3 text-sm font-semibold text-blue-800">
          {props.code}
        </div>
        <Button variant="secondary" className="h-11 shrink-0 rounded-2xl px-4 text-sm font-semibold">
          Copy
        </Button>
      </CardContent>
    </Card>
  )
}
