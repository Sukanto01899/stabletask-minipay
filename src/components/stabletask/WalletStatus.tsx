import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type WalletStatusProps = {
  isConnected: boolean
  address?: string
  chainId?: number
  errorMessage?: string
}

export function WalletStatus(props: WalletStatusProps) {
  const shortAddress = props.address
    ? `${props.address.slice(0, 6)}...${props.address.slice(-4)}`
    : undefined

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Wallet</div>
          <div className="text-lg font-semibold">{props.isConnected ? 'Connected' : 'Not connected'}</div>
        </div>
        <Badge className={cn(props.isConnected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-900')}>
          {props.isConnected ? 'Online' : 'Offline'}
        </Badge>
      </div>

      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div>Address: {shortAddress ?? '—'}</div>
        <div>Chain ID: {props.chainId ?? '—'}</div>
      </div>

      {props.errorMessage && (
        <div className="mt-4 text-xs text-destructive">{props.errorMessage}</div>
      )}
    </div>
  )
}
