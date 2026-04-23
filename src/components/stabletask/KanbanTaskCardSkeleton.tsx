export function KanbanTaskCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/80 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="space-y-2 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-100" />
          <div className="h-7 w-7 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-3 px-4">
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-3 py-2">
          <div className="h-3 w-14 animate-pulse rounded-full bg-blue-100" />
          <div className="mt-2 h-6 w-24 animate-pulse rounded-full bg-white/80" />
        </div>
      </div>
      <div className="mt-3 px-4">
        <div className="h-10 animate-pulse rounded-2xl bg-blue-100" />
      </div>
    </div>
  )
}

