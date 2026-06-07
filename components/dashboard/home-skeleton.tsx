import { Skeleton } from '@/components/ui/skeleton'

// 共用：/dashboard 首頁的骨架，loading.tsx 與 page.tsx 的 isLoading 共用同一份，
// 避免「navigation skeleton → page skeleton → 實際畫面」的兩層跳動。
// 結構需與 app/(seller)/dashboard/page.tsx 的真實版面對齊（含手機版）。
export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header：問候 + 日期 + 兩顆 CTA（手機亦為 row） */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36 md:h-7 md:w-48" />
          <Skeleton className="h-3 w-24 md:h-4 md:w-32" />
        </div>
        <div className="flex shrink-0 gap-1.5 md:gap-2">
          <Skeleton className="h-8 w-16 rounded-lg md:h-9 md:w-24" />
          <Skeleton className="h-8 w-16 rounded-lg md:h-9 md:w-24" />
        </div>
      </div>

      {/* 數據總覽：標題列 + 期間切換 + stat card（手機 4 張 + 展開鈕，電腦 8 張） */}
      <div className="space-y-2 md:space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16 md:h-5 md:w-20" />
          <div className="flex gap-0.5 md:gap-1">
            <Skeleton className="h-8 w-10 rounded-lg md:h-7 md:w-12" />
            <Skeleton className="h-8 w-10 rounded-lg md:h-7 md:w-12" />
            <Skeleton className="h-8 w-10 rounded-lg md:h-7 md:w-12" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-[68px] rounded-lg md:h-28 md:rounded-xl ${i >= 4 ? 'max-md:hidden' : ''}`}
            />
          ))}
        </div>
        {/* 展開更多（手機限定） */}
        <Skeleton className="mx-auto h-4 w-20 md:hidden" />
      </div>

      {/* 代購刊登量進度條卡片 */}
      <Skeleton className="h-[92px] rounded-xl md:h-[108px]" />

      {/* 最近代購 + 目前連線：手機單欄、電腦 3fr_2fr */}
      <div className="grid gap-3 md:gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-60 rounded-xl md:h-72" />
        <Skeleton className="h-60 rounded-xl md:h-72" />
      </div>
    </div>
  )
}
