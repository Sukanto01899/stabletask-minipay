export function LoadingScreen(props: { title: string; subtitle: string; debug?: { connected: boolean; chainId?: number } }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      {props.debug && (
        <div className="fixed bottom-20 left-4 z-50 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-xs shadow">
          <span>connected: {props.debug.connected ? 'yes' : 'no'}</span>
          <span className="mx-2 text-muted-foreground">|</span>
          <span>chainId: {props.debug.chainId ?? '—'}</span>
        </div>
      )}
      <div className="flex w-full max-w-md flex-col items-center gap-4 px-6 text-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-muted border-t-foreground" />
        <div>
          <div className="text-lg font-semibold">{props.title}</div>
          <div className="text-sm text-muted-foreground">{props.subtitle}</div>
        </div>
      </div>
    </div>
  )
}
