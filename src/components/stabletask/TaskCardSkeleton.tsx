export function TaskCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-blue-200/70 bg-white/80 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="skeleton-shimmer h-5 w-40 rounded-full" />
          <div className="skeleton-shimmer h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton-shimmer h-4 w-full rounded-full" />
        <div className="skeleton-shimmer h-4 w-3/4 rounded-full" />
      </div>
      <div className="mt-4 px-4">
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-4 py-3">
          <div className="skeleton-shimmer h-3 w-14 rounded-full" />
          <div className="skeleton-shimmer mt-2 h-7 w-28 rounded-full" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <div className="skeleton-shimmer h-11 rounded-2xl" />
        <div className="skeleton-shimmer h-11 rounded-2xl" />
      </div>
    </div>
  )
}
