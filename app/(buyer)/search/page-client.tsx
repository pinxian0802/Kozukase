'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { useQueryState, useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum, parseAsBoolean, createSerializer } from 'nuqs'
import { Info, SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/product/product-card'
import { ListingComparison } from '@/components/product/listing-comparison'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import type { ProductCategory } from '@/lib/validators/product'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'

// Kozukase brand palette
// teal 改為指向 design-system token；pink 暫保留 hex，待 Phase 4 決定是否進 token。
const KZ = {
  teal:   'var(--brand-500)',
  pink:   '#F0387A',
} as const

// 固定每頁顯示 5 個橫列卡片（已移除使用者可選的每頁筆數下拉）。
// 依桌機格狀欄數換算每頁筆數：商品 4 欄、代購 3 欄。
const ROWS_PER_PAGE = 5
const PRODUCT_PAGE_SIZE = ROWS_PER_PAGE * 4 // 桌機 4 欄 → 20 筆
const LISTING_PAGE_SIZE = ROWS_PER_PAGE * 3 // 桌機 3 欄 → 15 筆

// /search 的篩選參數定義；useQueryStates 與返回連結序列化共用同一份，避免漂移。
const filterParsers = {
  category: parseAsString,
  brand: parseAsString,
  social: parseAsBoolean.withDefault(false),
  // 僅作用於「代購」分頁（is_in_stock）；商品分頁無現貨概念
  stock: parseAsBoolean.withDefault(false),
  proof: parseAsBoolean.withDefault(false),
  tab: parseAsStringEnum(['listings', 'products'] as const).withDefault('listings'),
  page: parseAsInteger.withDefault(1),
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
  const [{ category, brand: brandId, social: socialVerifiedOnly, stock: inStockOnly, proof: proofOnly, tab, page }, setParams] = useQueryStates(
    filterParsers,
    { history: 'push', scroll: false, shallow: true }
  )

  // 保留原有的輸入夾擠/白名單防呆
  const safePage = Math.max(1, page)
  const categoryArg = (category ?? undefined) as ProductCategory | undefined
  const brandArg = brandId ?? undefined

  const [categoryExpanded, setCategoryExpanded] = useState(false)
  const [brandExpanded, setBrandExpanded] = useState(false)

  // 品牌超過這個數量就收合，多的藏在「查看更多品牌」後面
  const BRAND_VISIBLE_LIMIT = 6

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
      socialVerifiedOnly: socialVerifiedOnly || undefined,
      proofOnly: proofOnly || undefined,
      page: safePage,
      limit: PRODUCT_PAGE_SIZE,
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
      socialVerifiedOnly: socialVerifiedOnly || undefined,
      inStockOnly: inStockOnly || undefined,
      proofOnly: proofOnly || undefined,
      page: safePage,
      limit: LISTING_PAGE_SIZE,
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

  const updateParam = (key: 'category' | 'brand', value: string | null) => {
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
  if (socialVerifiedOnly) {
    activeFilters.push({
      key: 'social',
      label: '社群驗證',
      color: KZ.teal,
      onRemove: () => setParams({ social: false, page: 1 }),
    })
  }
  if (proofOnly) {
    activeFilters.push({
      key: 'proof',
      label: '可提供購買證明',
      color: KZ.teal,
      onRemove: () => setParams({ proof: false, page: 1 }),
    })
  }
  // 有現貨僅作用於代購分頁
  if (tab === 'listings' && inStockOnly) {
    activeFilters.push({
      key: 'stock',
      label: '有現貨',
      color: KZ.teal,
      onRemove: () => setParams({ stock: false, page: 1 }),
    })
  }

  const FilterPanel = () => (
    <div className="space-y-4">
      {/* Social verification toggle */}
      <FilterSection
        title="社群驗證"
        titleExtra={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span className="flex cursor-default items-center" />}>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right">只顯示已連結社群帳號的賣家</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
        rightSlot={
          <Switch
            checked={socialVerifiedOnly}
            onCheckedChange={(v) => setParams({ social: v, page: 1 })}
          />
        }
      />

      {/* 可提供購買證明 toggle */}
      <FilterSection
        title="可提供購買證明"
        titleExtra={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={<span className="flex cursor-default items-center" />}>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right">只顯示願意提供購買證明 / 明細的賣家</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
        rightSlot={
          <Switch
            checked={proofOnly}
            onCheckedChange={(v) => setParams({ proof: v, page: 1 })}
          />
        }
      />

      {/* In-stock toggle — 僅代購分頁 */}
      {tab === 'listings' && (
        <FilterSection
          title="有現貨"
          rightSlot={
            <Switch
              checked={inStockOnly}
              onCheckedChange={(v) => setParams({ stock: v, page: 1 })}
            />
          }
        />
      )}

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
          <button
            type="button"
            className="mx-auto block text-sm font-medium text-brand-700 transition-colors hover:text-brand-500"
            onClick={() => setCategoryExpanded(!categoryExpanded)}
          >
            {categoryExpanded ? '收起分類' : '查看更多分類'}
          </button>
        )}
      </FilterSection>

      {/* Brand section */}
      {brands.length > 0 && (
        <FilterSection title="品牌">
          <div className="space-y-1">
            {(brandExpanded ? brands : brands.slice(0, BRAND_VISIBLE_LIMIT)).map((brand) => (
              <FilterCheckbox
                key={brand.id}
                label={brand.name}
                checked={brandId === brand.id}
                onClick={() => updateParam('brand', brandId === brand.id ? null : brand.id)}
              />
            ))}
            {brands.length > BRAND_VISIBLE_LIMIT && (
              <button
                type="button"
                className="mx-auto block text-sm font-medium text-brand-700 transition-colors hover:text-brand-500"
                onClick={() => setBrandExpanded(!brandExpanded)}
              >
                {brandExpanded ? '收起品牌' : '查看更多品牌'}
              </button>
            )}
          </div>
        </FilterSection>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-page">
    <div className="mx-auto max-w-6xl px-3 py-3 md:px-4 md:py-6">
      <div className="flex items-start gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="pr-2">
            {FilterPanel()}
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {/* Title card — mobile: compact inline; desktop: card */}
          {/* Mobile compact header */}
          <div className="mb-2 md:hidden">
            <div className="flex items-center justify-between">
              <h1 className="text-[13px] font-bold text-text-strong">
                {tab === 'products'
                  ? q ? `「${q}」 ${total} 件` : `商品 ${total} 件`
                  : q ? `「${q}」 ${listingTotal} 筆` : `代購 ${listingTotal} 筆`
                }
              </h1>
              <Sheet>
                <SheetTrigger
                  render={
                    <button className="relative flex h-7 cursor-pointer items-center gap-1 rounded-full border border-border-soft bg-white px-2.5 text-[11px] text-neutral-600 shadow-sm">
                      <SlidersHorizontal className="h-3 w-3" />
                      篩選
                      {activeFilters.length > 0 && (
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
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
            {/* Mobile tab bar */}
            <div className="flex gap-0 mt-1.5 border-b border-border-soft">
              {(['listings', 'products'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateTab(t)}
                  className={[
                    'flex-1 py-1.5 text-[13px] font-semibold transition-colors text-center border-b-2',
                    tab === t
                      ? 'border-brand-500 text-brand-500'
                      : 'border-transparent text-text-faint',
                  ].join(' ')}
                >
                  {t === 'products' ? '商品' : '代購'}
                  <span className="text-[11px] font-normal ml-0.5">
                    {t === 'products' ? total : listingTotal}
                  </span>
                </button>
              ))}
            </div>
            {/* Mobile active filter chips */}
            {activeFilters.length > 0 && (
              <div className="flex gap-1 mt-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="shrink-0 inline-flex cursor-pointer items-center gap-1 rounded-full border border-border-soft bg-white px-2 py-0.5 text-[10px] font-medium text-text-muted"
                    onClick={f.onRemove}
                  >
                    {f.label}
                    <X className="h-2.5 w-2.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop title card */}
          <section className="mb-4 hidden overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:block">
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
            </div>
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
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
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
                <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      href={`/products/${product.id}?from=${encodeURIComponent(`/search${serializeSearch({ q, category, brand: brandId, social: socialVerifiedOnly, stock: inStockOnly, proof: proofOnly, tab, page: safePage })}`)}`}
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
                icon="notFound"
                title="找不到相符的商品"
                description="試試其他關鍵字或調整篩選條件"
              />
            )
          ) : (
            listingFetching ? (
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : listings.length > 0 ? (
              <>
                <ListingComparison listings={listings as any} columns={4} />
                <Pagination
                  page={safePage}
                  totalPages={listingTotalPages}
                  onPageChange={handlePageChange}
                  className="mt-8"
                />
              </>
            ) : (
              <EmptyState
                icon="notFound"
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
  titleExtra,
  rightSlot,
  children,
}: {
  title: string
  titleExtra?: ReactNode
  rightSlot?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-border-soft bg-surface-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-text-strong">
            {title}
            {titleExtra}
          </div>
          {rightSlot}
        </div>
        {children}
      </div>
    </section>
  )
}
