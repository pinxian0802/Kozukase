import { Skeleton } from '@/components/ui/skeleton'

// 結構需與 components/dashboard/list-shell.tsx 的真實版面對齊。
export default function ConnectionsLoading() {
  return (
    <div className="space-y-6">
      {/* 標題列：title + usage hint + 新增按鈕 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Tabs：全部 / 進行中 / 已結束 / 待審核 */}
      <div className="flex gap-2 border-b border-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      {/* 列表列（與 list-shell 內建 isLoading 的骨架一致） */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
