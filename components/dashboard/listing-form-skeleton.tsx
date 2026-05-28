import { Skeleton } from '@/components/ui/skeleton'

// 共用：listings/new/loading.tsx、listings/[id]/edit/loading.tsx、
// 以及 listings/[id]/edit/page.tsx 的 internal isLoading 都使用同一份骨架，
// 避免「祖先列表骨架 → 簡陋內部骨架 → 真實表單」的多層跳動。
// 結構需與 app/(seller)/dashboard/listings/{new,[id]/edit}/page.tsx 對齊。
export function ListingFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 返回鈕 + 標題 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Card：商品卡 + 多個欄位 + 送出鈕 */}
      <div className="rounded-xl border bg-white p-6 sm:p-8 shadow-sm space-y-5">
        {/* 商品 label + ProductCard 區 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-24 w-64 rounded-lg" />
        </div>

        {/* 數個表單列 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}

        <Skeleton className="h-10 w-32 ml-auto rounded-md" />
      </div>
    </div>
  )
}
