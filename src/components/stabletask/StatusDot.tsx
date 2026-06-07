import { cn } from '@/lib/utils'

export type ConnectionStatus = 'online' | 'connecting' | 'offline'

const STATUS_STYLES: Record<ConnectionStatus, { dot: string; glow: string }> = {
  online: { dot: 'bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.9)]', glow: 'bg-lime-400/60' },
  connecting: { dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]', glow: 'bg-amber-400/60' },
  offline: { dot: 'bg-rose-400/80', glow: '' },
}

/**
 * Small connection indicator: a colored dot with a soft pulsing glow ring.
 * Reuses the shared `animate-tap-pulse` keyframe (honors prefers-reduced-motion).
 */
export function StatusDot({
  status,
  className,
}: {
  status: ConnectionStatus
  className?: string
}) {
  const styles = STATUS_STYLES[status]
  const animate = status !== 'offline'

  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} aria-hidden>
      {animate && (
        <span
          className={cn('animate-tap-pulse absolute -inset-1 rounded-full blur-[2px]', styles.glow)}
        />
      )}
      <span className={cn('relative h-2 w-2 rounded-full', styles.dot)} />
    </span>
  )
}
