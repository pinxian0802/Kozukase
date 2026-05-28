import { Skeleton } from '@/components/ui/skeleton'

// 共用：connections/new/loading.tsx、connections/[id]/edit/loading.tsx、
// 以及 connections/[id]/edit/page.tsx 的 internal isLoading 都使用同一份骨架。
// 結構需與 app/(seller)/dashboard/connections/{new,[id]/edit}/page.tsx 對齊
// （max-w-4xl + 較大的 heading）。
export function ConnectionFormSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 返回鈕 + 較大的標題（text-3xl sm:text-4xl） */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-10 w-48 sm:h-12 sm:w-56" />
      </div>

      {/* Card：多個欄位（含日期/地區/圖片等較複雜列） */}
      <div className="rounded-xl border bg-white p-6 sm:p-8 shadow-sm space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className={i === 1 ? 'h-24 w-full rounded-md' : 'h-10 w-full rounded-md'} />
          </div>
        ))}

        <Skeleton className="h-10 w-32 ml-auto rounded-md" />
      </div>
    </div>
  )
}
