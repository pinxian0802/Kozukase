import { Skeleton } from '@/components/ui/skeleton'

// 結構需與 components/dashboard/list-shell.tsx 的真實版面對齊。
export default function ConnectionsLoading() {
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

      {/* Tabs（pill）：全部 / 進行中 / 已結束 / 待審核 */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-14 rounded-full md:h-9 md:w-20" />
        ))}
      </div>

      {/* 列表列（與 list-shell 內建 isLoading 的骨架一致） */}
      <div className="space-y-1.5 md:space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[68px] rounded-lg md:h-16" />
        ))}
      </div>
    </div>
  )
}
