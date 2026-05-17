export function LoadingScreen(props: {
  title: string
  subtitle: string
  debug?: { connected: boolean; chainId?: number }
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-4 px-6 text-center">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <div
            className="absolute inset-1 animate-spin rounded-full border-4 border-transparent border-t-primary/30"
            style={{ animationDuration: "1.1s", animationDirection: "reverse" }}
          />
        </div>
        <div>
          <div className="text-lg font-semibold">{props.title}</div>
          <div className="text-sm text-muted-foreground">{props.subtitle}</div>
        </div>
      </div>
    </div>
  )
}
