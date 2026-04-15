import { Skeleton } from '@/components/ui/skeleton'

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* 搜尋列 + 篩選按鈕 */}
      <div className="flex gap-3 mb-6">
        <Skeleton className="h-10 flex-1 max-w-lg" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* 商品格格 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
