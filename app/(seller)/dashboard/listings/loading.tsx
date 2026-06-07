import { Skeleton } from '@/components/ui/skeleton'

// 結構需與 components/dashboard/list-shell.tsx 的真實版面（標題列 + pill tabs + 列表）對齊。
// 外層不再加 max-w-6xl/px-4/py-6，因 (seller) layout 已套用 padding。
export default function ListingsLoading() {
  return (
    <div className="space-y-3 md:space-y-6">
      {/* 標題列：title + usage hint + 新增按鈕 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28 md:h-7 md:w-32" />
          <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg md:h-9 md:w-28" />
      </div>

      {/* Tabs（pill）：全部 / 上架中 / 草稿 / 已下架 / 待審核 */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-14 rounded-full md:h-9 md:w-20" />
        ))}
      </div>

      {/* 列表列（與 list-shell 內建 isLoading 的骨架一致，避免雙層跳動） */}
      <div className="space-y-1.5 md:space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[68px] rounded-lg md:h-16" />
        ))}
      </div>
    </div>
  )
}
