import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/connections/page.tsx：min-h-screen + 左 filter sidebar + 標題卡 + grid。
export function ConnectionListSkeleton() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-start gap-6">
          {/* Filter sidebar */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="space-y-4 pr-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
              ))}
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1">
            {/* Title card */}
            <Skeleton className="mb-4 h-24 w-full rounded-2xl" />

            {/* Connection cards grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
