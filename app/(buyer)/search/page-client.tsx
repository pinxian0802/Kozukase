'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { useQueryState, useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum, createSerializer } from 'nuqs'
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

// Kozukase brand palette
// teal 改為指向 design-system token；pink 暫保留 hex，待 Phase 4 決定是否進 token。
const KZ = {
  teal:   'var(--brand-500)',
  pink:   '#F0387A',
} as const

// /search 的篩選參數定義；useQueryStates 與返回連結序列化共用同一份，避免漂移。
const filterParsers = {
  category: parseAsString,
  brand: parseAsString,
  tab: parseAsStringEnum(['listings', 'products'] as const).withDefault('listings'),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
}
// 從目前 nuqs 篩選狀態（唯一真實來源）序列化出 /search querystring，
// 不再依賴可能與 nuqs shallow 更新脫節的 useSearchParams()。
const serializeSearch = createSerializer({ q: parseAsString.withDefault(''), ...filterParsers })

export default function SearchPageClient() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}

function SearchContent() {
  // q 由站外搜尋框帶入，本頁唯讀
  const [q] = useQueryState('q', parseAsString.withDefault(''))

  // 一組會一起變動的篩選參數；history:'push' 讓瀏覽器上一頁可回到前一組篩選，
  // scroll:false 對齊原本 router.push 的行為（分頁時另行手動捲動）。
  // 刻意不傳 startTransition：篩選參數同步更新，避免被 React transition 延遲
  // 而與 react-query（useSyncExternalStore）脫節造成計數抖動；loading 全由
  // react-query 的 isFetching 提供。
  const [{ category, brand: brandId, tab, page, pageSize }, setParams] = useQueryStates(
    filterParsers,
    { history: 'push', scroll: false, shallow: true }
  )

  // 保留原有的輸入夾擠/白名單防呆
  const safePage = Math.max(1, page)
  const safePageSize = [10, 20, 50].includes(pageSize) ? pageSize : 20
  const categoryArg = (category ?? undefined) as ProductCategory | undefined
  const brandArg = brandId ?? undefined

  const [categoryExpanded, setCategoryExpanded] = useState(false)

  const { data: brandsData } = trpc.brand.forSearch.useQuery({
    query: q || undefined,
    category: categoryArg,
  })
  const brands = brandsData ?? []

  const { data, isFetching } = trpc.product.browse.useQuery(
    {
      query: q || undefined,
      category: categoryArg,
      brandId: brandArg,
      page: safePage,
      limit: safePageSize,
    },
    {
      enabled: tab === 'products',
      placeholderData: (prev) => prev,
    }
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
      category: categoryArg,
      brandId: brandArg,
      page: safePage,
      limit: safePageSize,
    },
    {
      enabled: tab === 'listings',
      placeholderData: (prev) => prev,
    }
  )

  const listings = listingData?.items ?? []
  const listingTotal = listingData?.total ?? 0
  const listingTotalPages = listingData?.totalPages ?? 0

  const updateTab = (newTab: 'products' | 'listings') => {
    if (newTab === tab) return
    setParams({ tab: newTab, page: 1 })
  }

  const updateParam = (key: 'category' | 'brand' | 'pageSize', value: string | null) => {
    if (key === 'pageSize') {
      setParams({ pageSize: value ? parseInt(value, 10) : 20, page: 1 })
      return
    }
    setParams({ [key]: value, page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    setParams({ page: newPage })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const categoryEntries = Object.entries(PRODUCT_CATEGORY_LABELS)
  const half = Math.ceil(categoryEntries.length / 2)
  const firstHalf = categoryEntries.slice(0, half)
  const secondHalf = categoryEntries.slice(half)

  const activeFilters: { key: string; label: string; color: string; onRemove: () => void }[] = []
  if (category) {
    activeFilters.push({
      key: 'category',
      label: PRODUCT_CATEGORY_LABELS[category as ProductCategory] ?? category,
      color: KZ.teal,
      onRemove: () => updateParam('category', null),
    })
  }
  if (brandId) {
    const brandName = brands.find((b) => b.id === brandId)?.name ?? brandId
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
              checked={category === key}
              color={KZ.teal}
              onClick={() => updateParam('category', category === key ? null : key)}
            />
          ))}
          {categoryExpanded &&
            secondHalf.map(([key, label]) => (
              <FilterCheckbox
                key={key}
                label={label}
                checked={category === key}
                color={KZ.teal}
                onClick={() => updateParam('category', category === key ? null : key)}
              />
            ))}
        </div>
        {secondHalf.length > 0 && (
          categoryExpanded ? (
            <Button
              type="button"
              variant="outline-soft"
              className="h-12 w-full rounded-[16px]"
              onClick={() => setCategoryExpanded(false)}
            >
              收起分類
            </Button>
          ) : (
            <Button
              type="button"
              variant="cta-outline"
              className="h-12 w-full rounded-[16px]"
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
                checked={brandId === brand.id}
                color={KZ.pink}
                onClick={() => updateParam('brand', brandId === brand.id ? null : brand.id)}
              />
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-page">
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
          <section className="mb-4 overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-2xl font-bold">
                  {tab === 'products'
                    ? q ? `「${q}」的搜尋結果，共 ${total} 件` : `瀏覽商品，共 ${total} 件`
                    : q ? `「${q}」的代購，共 ${listingTotal} 筆` : `瀏覽代購，共 ${listingTotal} 筆`
                  }
                </h1>
                {activeFilters.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {activeFilters.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
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
                <Select value={String(safePageSize)} onValueChange={(v) => updateParam('pageSize', v)}>
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

            {/* Tab bar — 緊貼 header 底部 */}
            <div className="flex items-end gap-1 px-5">
              {(['listings', 'products'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateTab(t)}
                  className={[
                    'rounded-t-lg px-6 py-2.5 text-sm font-semibold transition-colors',
                    tab === t
                      ? 'bg-brand-500 text-text-inverse'
                      : 'text-text-faint hover:text-text-muted',
                  ].join(' ')}
                >
                  {t === 'products' ? '商品' : '代購'}
                </button>
              ))}
            </div>
          </section>

          {tab === 'products' ? (
            isFetching ? (
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
                      href={`/products/${product.id}?from=${encodeURIComponent(`/search${serializeSearch({ q, category, brand: brandId, tab, page: safePage, pageSize: safePageSize })}`)}`}
                    />
                  ))}
                </div>
                <Pagination
                  page={safePage}
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
            listingFetching ? (
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
                  page={safePage}
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
    <section className="overflow-hidden rounded-[24px] border border-border-soft bg-surface-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-4">
        <div className="text-sm font-semibold text-text-strong">{title}</div>
        {children}
      </div>
    </section>
  )
}
