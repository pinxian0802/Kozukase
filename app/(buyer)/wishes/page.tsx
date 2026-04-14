'use client'

import { Heart } from 'lucide-react'
import { ProductCard } from '@/components/product/product-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'

export default function WishesPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.wish.topWished.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const products = data?.pages.flatMap((p: any) => p.items) ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold font-heading mb-2">許願榜</h1>
      <p className="text-muted-foreground mb-8">
        大家最想要代購的商品，許願越多越容易有人上架
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? '載入中...' : '載入更多'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={Heart} title="還沒有人許願" description="先去搜尋商品並按下許願吧！" />
      )}
    </div>
  )
}
