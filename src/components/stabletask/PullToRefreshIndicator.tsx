'use client'

export function PullToRefreshIndicator(props: {
  pullDistance: number
  pullReady: boolean
  isPulling: boolean
  isRefreshing: boolean
  threshold?: number
}) {
  const { pullDistance, pullReady, isPulling, isRefreshing, threshold = 70 } = props
  const progress = Math.min(1, pullDistance / threshold)

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-2">
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          height: pullDistance,
          transition: isPulling ? 'none' : 'height 180ms ease',
        }}
      >
        <div className="flex h-full items-end justify-center gap-1.5 pb-2 text-xs font-semibold text-lime-200">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={isRefreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5 transition-transform duration-150 ease-out'}
            style={isRefreshing ? undefined : { transform: `rotate(${progress * 180}deg)` }}
          >
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
              clipRule="evenodd"
            />
          </svg>
          {isRefreshing ? 'Refreshing…' : pullReady ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div>
    </div>
  )
}
