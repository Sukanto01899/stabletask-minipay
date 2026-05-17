export function KanbanTaskCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/80 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="space-y-2 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="skeleton-shimmer h-4 w-40 rounded-full" />
          <div className="skeleton-shimmer h-7 w-7 rounded-full" />
        </div>
        <div className="skeleton-shimmer h-3 w-24 rounded-full" />
      </div>
      <div className="mt-3 px-4">
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-3 py-2">
          <div className="skeleton-shimmer h-3 w-14 rounded-full" />
          <div className="skeleton-shimmer mt-2 h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="mt-3 px-4">
        <div className="skeleton-shimmer h-10 rounded-2xl" />
      </div>
    </div>
  )
}
