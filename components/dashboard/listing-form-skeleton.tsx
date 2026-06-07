import { Skeleton } from '@/components/ui/skeleton'

// 共用：listings/new/loading.tsx、listings/[id]/edit/loading.tsx、
// 以及 listings/[id]/edit/page.tsx 的 internal isLoading 都使用同一份骨架，
// 避免「祖先列表骨架 → 簡陋內部骨架 → 真實表單」的多層跳動。
// 結構需與 app/(seller)/dashboard/listings/{new,[id]/edit}/page.tsx 對齊（含手機緊湊版）。
export function ListingFormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      {/* 返回鈕 + 標題（手機 text-[15px]） */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg md:h-9 md:w-9" />
        <Skeleton className="h-5 w-28 md:h-8 md:w-32" />
      </div>

      {/* Card：商品卡 + 多個欄位 + 送出鈕（手機 p-4、欄位較矮） */}
      <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm sm:p-8">
        {/* 商品 label + ProductCard 區 */}
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12 md:h-4" />
          <Skeleton className="h-20 w-52 rounded-lg md:h-24 md:w-64" />
        </div>

        {/* 數個表單列 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
            <Skeleton className="h-[30px] w-full rounded-lg md:h-10" />
          </div>
        ))}

        {/* 動作列：儲存 + 送出 */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-8 w-24 rounded-lg md:h-10 md:w-28" />
          <Skeleton className="h-8 flex-1 rounded-lg md:h-10" />
        </div>
      </div>
    </div>
  )
}
