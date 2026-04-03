import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function MiniPayBanner(props: { detected: boolean | null }) {
  if (props.detected === null) {
    return (
      <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
        Detecting MiniPay...
      </div>
    )
  }

  const isMiniPay = props.detected
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
        isMiniPay
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <div>
        {isMiniPay
          ? 'MiniPay detected. You can claim rewards instantly.'
          : 'MiniPay not detected. Open this mini app inside MiniPay for best rewards.'}
      </div>
      <Badge
        className={cn(
          'shrink-0',
          isMiniPay ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white',
        )}
      >
        {isMiniPay ? 'Connected' : 'Not in MiniPay'}
      </Badge>
    </div>
  )
}
