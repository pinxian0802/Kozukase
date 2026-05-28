import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/wishes/page.tsx：標題列（含「新增商品」CTA）+ 商品 grid。
export function WishesListSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header：標題 + 副標 + CTA */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28 shrink-0 rounded-md" />
      </div>

      {/* Product grid（page.tsx isLoading 只顯示卡片本體，沒有標題副標） */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  )
}
