export function TaskCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-blue-200/70 bg-white/80 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-40 animate-pulse rounded-full bg-blue-100" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-cyan-100" />
        </div>
        <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 px-4">
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-100 px-4 py-3">
          <div className="h-3 w-14 animate-pulse rounded-full bg-blue-100" />
          <div className="mt-2 h-7 w-28 animate-pulse rounded-full bg-white/80" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-11 animate-pulse rounded-2xl bg-blue-100" />
      </div>
    </div>
  )
}
