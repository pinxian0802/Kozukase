'use client'

import { Suspense, useState, useEffect, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/product/product-card'
import { ListingComparison } from '@/components/product/listing-comparison'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import type { ProductCategory } from '@/lib/validators/product'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { Package } from 'lucide-react'

// Kozukase brand palette from logo
const KZ = {
  teal:   '#26C8C2',
  pink:   '#F0387A',
  purple: '#8B24C0',
  orange: '#F97316',
  yellow: '#F5C200',
  gray:   '#9CA3AF',
  green:  '#7DC83A',
} as const

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
  const tab = (searchParams.get('tab') ?? 'products') as 'products' | 'listings'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = (() => {
    const raw = parseInt(searchParams.get('pageSize') ?? '20', 10)
    return [10, 20, 50].includes(raw) ? raw : 20
  })()

  const [categoryExpanded, setCategoryExpanded] = useState(false)
  const [isPending, setIsPending] = useState(false)
  // Optimistic local state — updates immediately on click; syncs back when URL commits
  const [localCategory, setLocalCategory] = useState<string | undefined>(category)
  const [localBrandId, setLocalBrandId] = useState<string | undefined>(brandId)
  useEffect(() => { setLocalCategory(category) }, [category])
  useEffect(() => { setLocalBrandId(brandId) }, [brandId])

  const { data: brandsData } = trpc.brand.forSearch.useQuery({
    query: q || undefined,
    category: category as ProductCategory | undefined,
  })
  const brands = brandsData ?? []

  const { data, isLoading, isFetching } = trpc.product.browse.useQuery(
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

  const {
    data: listingData,
    isFetching: listingFetching,
  } = trpc.listing.browse.useQuery(
    {
      query: q || undefined,
      category: category as ProductCategory | undefined,
      brandId,
      page,
      limit: pageSize,
    },
    {
      enabled: tab === 'listings',
      placeholderData: (prev) => prev,
    }
  )

  const listings = listingData?.items ?? []
  const listingTotal = listingData?.total ?? 0
  const listingTotalPages = listingData?.totalPages ?? 0
  useEffect(() => { setIsPending(false) }, [data, listingData])

  const updateTab = (newTab: 'products' | 'listings') => {
    setIsPending(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    params.set('page', '1')
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  const updateParam = (key: string, value: string | null) => {
    setIsPending(true)
    if (key === 'category') setLocalCategory(value ?? undefined)
    if (key === 'brand') setLocalBrandId(value ?? undefined)
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('page', '1')
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  const clearAllFilters = () => {
    setIsPending(true)
    setLocalCategory(undefined)
    setLocalBrandId(undefined)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('pageSize', String(pageSize))
    router.push(`/search?${params.toString()}`, { scroll: false })
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

  const activeFilters: { key: string; label: string; color: string; onRemove: () => void }[] = []
  if (localCategory) {
    activeFilters.push({
      key: 'category',
      label: PRODUCT_CATEGORY_LABELS[localCategory as ProductCategory] ?? localCategory,
      color: KZ.teal,
      onRemove: () => updateParam('category', null),
    })
  }
  if (localBrandId) {
    const brandName = brands.find((b) => b.id === localBrandId)?.name ?? localBrandId
    activeFilters.push({
      key: 'brand',
      label: brandName,
      color: KZ.pink,
      onRemove: () => updateParam('brand', null),
    })
  }

  const FilterPanel = () => (
    <div className="space-y-4">
      {/* Category section */}
      <FilterSection title="商品類別">
        <div className="space-y-1">
          {firstHalf.map(([key, label]) => (
            <FilterCheckbox
              key={key}
              label={label}
              checked={localCategory === key}
              color={KZ.teal}
              onClick={() => updateParam('category', localCategory === key ? null : key)}
            />
          ))}
          {categoryExpanded &&
            secondHalf.map(([key, label]) => (
              <FilterCheckbox
                key={key}
                label={label}
                checked={localCategory === key}
                color={KZ.teal}
                onClick={() => updateParam('category', localCategory === key ? null : key)}
              />
            ))}
        </div>
        {secondHalf.length > 0 && (
          categoryExpanded ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-[16px] border-[#e1ddd7] text-[#555] hover:bg-[#faf9f7] hover:text-[#333]"
              onClick={() => setCategoryExpanded(false)}
            >
              收起分類
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-[16px] border-[#28a5cf] text-[#1a9ac4] hover:bg-[#f4fbfe] hover:text-[#168eb4]"
              onClick={() => setCategoryExpanded(true)}
            >
              查看更多分類
            </Button>
          )
        )}
      </FilterSection>

      {/* Brand section */}
      {brands.length > 0 && (
        <FilterSection title="品牌">
          <div className="space-y-1">
            {brands.map((brand) => (
              <FilterCheckbox
                key={brand.id}
                label={brand.name}
                checked={localBrandId === brand.id}
                color={KZ.pink}
                onClick={() => updateParam('brand', localBrandId === brand.id ? null : brand.id)}
              />
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFAFD]">
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-start gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="pr-2">
            {FilterPanel()}
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {/* Title card */}
          <section className="mb-4 overflow-hidden rounded-2xl border border-[#ebe6dd] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-2xl font-bold">
                  {tab === 'products'
                    ? q ? `「${q}」的搜尋結果，共 ${isFetching ? '' : total} 件` : `瀏覽商品，共 ${isFetching ? '' : total} 件`
                    : q ? `「${q}」的代購，共 ${listingFetching ? '' : listingTotal} 筆` : `瀏覽代購，共 ${listingFetching ? '' : listingTotal} 筆`
                  }
                </h1>
                <div className="mt-3 flex gap-1">
                  {(['products', 'listings'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateTab(t)}
                      className={[
                        'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                        tab === t
                          ? 'bg-[#26C8C2] text-white'
                          : 'text-[#555] hover:bg-[#f0f0f0]',
                      ].join(' ')}
                    >
                      {t === 'products' ? '商品' : '代購'}
                    </button>
                  ))}
                </div>
                {activeFilters.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {activeFilters.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={f.onRemove}
                      >
                        {f.label}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => updateParam('pageSize', v)}>
                  <SelectTrigger className="h-9 w-24 text-sm">
                    <SelectValue>
                      {(v: string) => (v ? `${v} 筆` : undefined)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 筆</SelectItem>
                    <SelectItem value="20">20 筆</SelectItem>
                    <SelectItem value="50">50 筆</SelectItem>
                  </SelectContent>
                </Select>

                <Sheet>
                  <SheetTrigger
                    render={
                      <button className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 md:hidden">
                        <SlidersHorizontal className="h-4 w-4" />
                        {activeFilters.length > 0 && (
                          <span
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: KZ.teal }}
                          >
                            {activeFilters.length}
                          </span>
                        )}
                      </button>
                    }
                  />
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>篩選條件</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 px-1">{FilterPanel()}</div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </section>

          {tab === 'products' ? (
            (isPending || isFetching) ? (
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
                    <ProductCard
                      key={product.id}
                      product={product}
                      href={`/products/${product.id}?from=${encodeURIComponent(`/search?${searchParams.toString()}`)}`}
                    />
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
            )
          ) : (
            (isPending || listingFetching) ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : listings.length > 0 ? (
              <>
                <ListingComparison listings={listings as any} />
                <Pagination
                  page={page}
                  totalPages={listingTotalPages}
                  onPageChange={handlePageChange}
                  className="mt-8"
                />
              </>
            ) : (
              <EmptyState
                icon={Package}
                title="找不到相符的代購"
                description="試試其他關鍵字或調整篩選條件"
              />
            )
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[#ebe6dd] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-4">
        <div className="text-sm font-semibold text-[#222]">{title}</div>
        {children}
      </div>
    </section>
  )
}


