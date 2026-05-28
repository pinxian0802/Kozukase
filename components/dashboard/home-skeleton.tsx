import { Skeleton } from '@/components/ui/skeleton'

// 共用：/dashboard 首頁的骨架，loading.tsx 與 page.tsx 的 isLoading 共用同一份，
// 避免「navigation skeleton → page skeleton → 實際畫面」的兩層跳動。
// 結構需與 app/(seller)/dashboard/page.tsx 的真實版面對齊。
export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header：問候 + 日期 + 兩顆 CTA */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2 mt-3 sm:mt-0">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* 數據總覽：標題列 + 期間切換 + 10 張 stat card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-7 w-12" />
          </div>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>

      {/* 代購刊登量進度條卡片 */}
      <Skeleton className="h-[108px] rounded-xl" />

      {/* 最近代購 + 目前連線：3fr_2fr 比例 */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
