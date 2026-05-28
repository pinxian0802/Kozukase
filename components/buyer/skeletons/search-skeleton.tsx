import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/search/page-client.tsx：min-h-screen + 左 filter sidebar +
// 標題卡（含商品/代購 tab）+ 4 欄商品 grid（或 3 欄代購 grid）。
// 預設用商品 tab 的版面（最常見的進入點）。
export function SearchSkeleton() {
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
            {/* Title card with tab bar */}
            <div className="mb-4 overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <div className="p-5 flex items-start justify-between gap-4">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-9 w-9 rounded-xl md:hidden" />
              </div>
              <div className="flex items-end gap-1 px-5">
                <Skeleton className="h-9 w-20 rounded-t-lg" />
                <Skeleton className="h-9 w-20 rounded-t-lg" />
              </div>
            </div>

            {/* Product grid (4 cols on lg) */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
