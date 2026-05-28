import { Skeleton } from '@/components/ui/skeleton'

// 對齊 app/(buyer)/listings/[id]/page-client.tsx：max-w-5xl + 麵包屑 +
// 2 欄 (md:grid-cols-[1fr_1.15fr])，左圖庫、右詳情區塊。
export function ListingDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* Breadcrumb */}
      <Skeleton className="mb-6 h-5 w-56" />

      <div className="grid gap-12 md:grid-cols-[1fr_1.15fr] items-start">
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
        <div className="space-y-6 min-w-0">
          {/* Header：product link + title + bookmark */}
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-3/4" />
            </div>
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          </div>

          {/* Price + shipping card */}
          <div className="space-y-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>

          {/* Specs */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-16 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>

          {/* CTAs */}
          <div className="flex gap-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>

          {/* Seller card */}
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
