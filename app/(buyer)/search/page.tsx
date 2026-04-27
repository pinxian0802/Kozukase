'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/product/product-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import type { ProductCategory } from '@/lib/validators/product'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { Package } from 'lucide-react'

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
  const brandId = searchParams.get('brand') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = (() => {
    const raw = parseInt(searchParams.get('pageSize') ?? '20', 10)
    return [10, 20, 50].includes(raw) ? raw : 20
  })()

  const [categoryExpanded, setCategoryExpanded] = useState(false)

  const { data: brandsData } = trpc.brand.list.useQuery()
  const brands = brandsData ?? []

  const { data, isLoading } = trpc.product.browse.useQuery(
    {
      query: q || undefined,
      category: category as ProductCategory | undefined,
      brandId,
      page,
      limit: pageSize,
    },
    { placeholderData: (prev) => prev }
  )

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    // Reset to page 1 on filter/sort/size changes
    params.set('page', '1')
    router.push(`/search?${params.toString()}`)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/search?${params.toString()}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const categoryEntries = Object.entries(PRODUCT_CATEGORY_LABELS)
  const half = Math.ceil(categoryEntries.length / 2)
  const firstHalf = categoryEntries.slice(0, half)
  const secondHalf = categoryEntries.slice(half)

  const FilterContent = () => (
    <div className="space-y-6">
      <FilterSectionCard title="商品類別">
        <div className="space-y-2 p-4">
          {firstHalf.map(([key, label]) => (
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
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: categoryExpanded ? `${secondHalf.length * 32}px` : '0px' }}
        >
          <div className="space-y-2 px-4 pb-4">
            {secondHalf.map(([key, label]) => (
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
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-1 px-4 pb-4 text-xs text-muted-foreground"
          onClick={() => setCategoryExpanded((v) => !v)}
        >
          {categoryExpanded ? '收合' : '展開更多'}
          <ChevronDown className={`size-3 transition-transform duration-300 ${categoryExpanded ? 'rotate-180' : ''}`} />
        </button>
      </FilterSectionCard>

      <FilterSectionCard title="品牌">
        <div className="space-y-2 p-4">
          {brands.length > 0 ? (
            brands.map((brand) => (
              <div key={brand.id} className="flex items-center gap-2">
                <Checkbox
                  id={`brand-${brand.id}`}
                  checked={brandId === brand.id}
                  onCheckedChange={(checked) => updateParam('brand', checked ? brand.id : null)}
                />
                <Label htmlFor={`brand-${brand.id}`} className="text-sm">{brand.name}</Label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">目前沒有品牌資料</p>
          )}
        </div>
        {brandId && (
          <button
            className="w-full px-4 pb-4 text-left text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => updateParam('brand', null)}
          >
            清除品牌篩選
          </button>
        )}
      </FilterSectionCard>
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
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">共 {total} 件商品</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <Select
            value={String(pageSize)}
            onValueChange={(v) => updateParam('pageSize', v)}
          >
            <SelectTrigger className="w-24">
              <SelectValue>
                {(v: string) => v ? `${v} 筆` : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 筆</SelectItem>
              <SelectItem value="20">20 筆</SelectItem>
              <SelectItem value="50">50 筆</SelectItem>
            </SelectContent>
          </Select>

          {/* Mobile filter */}
          <Sheet>
            <SheetTrigger
              render={<Button variant="outline" size="icon" className="md:hidden"><SlidersHorizontal className="h-4 w-4" /></Button>}
            />
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>篩選</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                {FilterContent()}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex items-start gap-8">
        {/* Desktop sidebar filter */}
        <aside className="hidden w-72 flex-shrink-0 self-start md:sticky md:top-24 md:block">
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            {FilterContent()}
          </div>
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
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                className="mt-8"
              />
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

function FilterSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#dedad4] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="border-b border-[#e6e1da] bg-[#f6f4f1] px-4 py-4">
        <h3 className="font-medium">{title}</h3>
      </div>
      {children}
    </section>
  )
}
