import { Skeleton } from '@/components/ui/skeleton'

// 共用：connections/new/loading.tsx、connections/[id]/edit/loading.tsx、
// 以及 connections/[id]/edit/page.tsx 的 internal isLoading 都使用同一份骨架。
// 結構需與 app/(seller)/dashboard/connections/{new,[id]/edit}/page.tsx 對齊
// （max-w-4xl、手機 text-[15px] 標題、緊湊欄位）。
export function ConnectionFormSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      {/* 返回鈕 + 標題（手機 text-[15px]、電腦 sm:text-4xl） */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg md:h-9 md:w-9" />
        <Skeleton className="h-5 w-40 md:h-10 md:w-56" />
      </div>

      {/* Card：多個欄位（含日期/地區/圖片等較複雜列） */}
      <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm sm:p-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24 md:h-4" />
            <Skeleton
              className={
                i === 1
                  ? 'h-[60px] w-full rounded-lg md:h-24'
                  : 'h-[30px] w-full rounded-lg md:h-10'
              }
            />
          </div>
        ))}

        {/* 送出鈕（w-full） */}
        <Skeleton className="h-9 w-full rounded-lg md:h-10" />
      </div>
    </div>
  )
}
