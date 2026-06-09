import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/wishes/[id]/page.tsx：max-w-5xl + 麵包屑 +
// 2 欄 (md:grid-cols-[1fr_1.15fr])，左圖庫、右詳情區塊。
export function WishDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* Breadcrumb */}
      <Skeleton className="mb-6 h-5 w-48" />

      <div className="grid items-start gap-12 md:grid-cols-[1fr_1.15fr]">
        {/* Gallery */}
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-md" />
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-col gap-7">
          {/* Header：brand/category + title + model */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-4 w-28" />
          </div>

          {/* Wish content card */}
          <Skeleton className="h-28 w-full rounded-2xl" />

          {/* Wisher card */}
          <Skeleton className="h-20 w-full rounded-2xl" />

          {/* CTAs */}
          <div className="flex gap-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
