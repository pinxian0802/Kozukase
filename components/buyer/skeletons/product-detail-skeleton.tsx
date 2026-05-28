import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/products/[id]/page-client.tsx：min-h-screen + max-w-6xl +
// 麵包屑 + 左 sidebar（商品卡）+ 右主內容（賣家列表 / 評價）。
export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumb */}
        <Skeleton className="mb-6 h-5 w-48" />

        <div className="flex items-start gap-6">
          {/* Left sidebar：商品卡 */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="overflow-hidden rounded-[24px] border border-border-soft bg-surface-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <div className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-10 flex-1 rounded-md" />
                  <Skeleton className="h-10 flex-1 rounded-md" />
                </div>
              </div>
            </div>
          </aside>

          {/* Main：賣家列表 / 評價區 */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* 手機版商品卡 fallback */}
            <Skeleton className="h-48 w-full rounded-[24px] md:hidden" />

            {/* 段標 + 列表 */}
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
