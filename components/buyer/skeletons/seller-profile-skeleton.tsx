import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/sellers/[id]/page-client.tsx：min-h-screen bg-white +
// max-w-4xl + 返回 + Hero（avatar + 資訊 / 社群區）+ 4 欄 stats + tabs + 內容。
export function SellerProfileSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-6">
        {/* Back button */}
        <Skeleton className="h-4 w-12" />

        {/* Hero */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr] md:gap-8 items-start">
          {/* Left: avatar + info */}
          <div className="flex gap-6">
            <Skeleton className="h-[104px] w-[104px] shrink-0 rounded-full" />
            <div className="flex flex-col gap-3 pt-1 min-w-0 flex-1">
              <Skeleton className="h-8 w-40" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full max-w-[520px]" />
              <Skeleton className="h-4 w-3/4 max-w-[420px]" />
            </div>
          </div>

          {/* Right: social card */}
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>

        {/* Stats grid */}
        <div className="mt-7 mb-9 grid grid-cols-4 border border-border-soft rounded-[14px] overflow-hidden bg-white">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2 border-r border-border-soft last:border-r-0">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border-soft pb-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>

        {/* Tab content：grid of listing cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
