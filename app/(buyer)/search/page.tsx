'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/product/product-card'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { Search, Package } from 'lucide-react'

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? undefined
  const sort = (searchParams.get('sort') as 'latest' | 'price_asc') ?? 'latest'

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.product.browse.useInfiniteQuery(
      {
        query: q || undefined,
        category: category as any,
        sort,
        limit: 20,
      },
      {
        getNextPageParam: (lastPage: any) => lastPage.nextCursor,
      }
    )

  const products = data?.pages.flatMap((p: any) => p.items) ?? []

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/search?${params.toString()}`)
  }

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">商品分類</h3>
        <div className="space-y-2">
          {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${key}`}
                checked={category === key}
                onCheckedChange={(checked) => updateParam('category', checked ? key : null)}
              />
              <Label htmlFor={`cat-${key}`} className="text-sm">{label}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {q ? `「${q}」的搜尋結果` : '瀏覽商品'}
          </h1>
          {!isLoading && <p className="text-sm text-muted-foreground mt-1">共 {products.length} 件商品</p>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">最新上架</SelectItem>
              <SelectItem value="price_asc">價格最低</SelectItem>
            </SelectContent>
          </Select>

          {/* Mobile filter */}
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" />}>
                <SlidersHorizontal className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>篩選</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <FilterContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar filter */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <FilterContent />
        </aside>

        {/* Results */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {hasNextPage && (
                <div className="mt-8 text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? '載入中...' : '載入更多'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={Package}
              title="找不到相符的商品"
              description="試試其他關鍵字或調整篩選條件"
            />
          )}
        </div>
      </div>
    </div>
  )
}
