'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SlidersHorizontal, ChevronDown, X, ListFilter } from 'lucide-react'
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
    params.set('page', '1')
    router.push(`/search?${params.toString()}`)
  }

  const clearAllFilters = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('pageSize', String(pageSize))
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

  const activeFilters: { key: string; label: string; color: string; onRemove: () => void }[] = []
  if (category) {
    activeFilters.push({
      key: 'category',
      label: `類別：${PRODUCT_CATEGORY_LABELS[category as ProductCategory] ?? category}`,
      color: KZ.teal,
      onRemove: () => updateParam('category', null),
    })
  }
  if (brandId) {
    const brandName = brands.find((b) => b.id === brandId)?.name ?? brandId
    activeFilters.push({
      key: 'brand',
      label: `品牌：${brandName}`,
      color: KZ.pink,
      onRemove: () => updateParam('brand', null),
    })
  }

  const FilterPanel = () => (
    <div>
      {/* Panel header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <ListFilter className="h-4 w-4" style={{ color: KZ.teal }} />
          篩選條件
        </span>
        {activeFilters.length > 0 && (
          <button
            onClick={clearAllFilters}
            className="cursor-pointer text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: KZ.purple }}
          >
            清除全部
          </button>
        )}
      </div>

      {/* Category section */}
      <FilterSection title="商品類別" accentColor={KZ.teal} active={!!category}>
        <div className="flex flex-wrap gap-2 pt-3">
          {firstHalf.map(([key, label]) => (
            <FilterChip
              key={key}
              label={label}
              active={category === key}
              activeColor={KZ.teal}
              onClick={() => updateParam('category', category === key ? null : key)}
            />
          ))}
          {categoryExpanded &&
            secondHalf.map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                active={category === key}
                activeColor={KZ.teal}
                onClick={() => updateParam('category', category === key ? null : key)}
              />
            ))}
        </div>
        {secondHalf.length > 0 && (
          <button
            className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: KZ.gray }}
            onClick={() => setCategoryExpanded((v) => !v)}
          >
            {categoryExpanded ? '收合' : `展開更多（${secondHalf.length}）`}
            <ChevronDown
              className={`size-3 transition-transform duration-200 ${categoryExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </FilterSection>

      {/* Brand section */}
      {brands.length > 0 && (
        <FilterSection title="品牌" accentColor={KZ.pink} active={!!brandId}>
          <div className="flex flex-wrap gap-2 pt-3">
            {brands.map((brand) => (
              <FilterChip
                key={brand.id}
                label={brand.name}
                active={brandId === brand.id}
                activeColor={KZ.pink}
                onClick={() => updateParam('brand', brandId === brand.id ? null : brand.id)}
              />
            ))}
          </div>
        </FilterSection>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {q ? `「${q}」的搜尋結果` : '瀏覽商品'}
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-muted-foreground">
              共{' '}
              <span className="font-medium text-foreground">{total}</span> 件商品
              {activeFilters.length > 0 && (
                <span className="ml-2 text-xs">・{activeFilters.length} 個篩選中</span>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Page size */}
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

          {/* Mobile filter button */}
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

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <ActiveFilterPill
              key={f.key}
              label={f.label}
              color={f.color}
              onRemove={f.onRemove}
            />
          ))}
          <button
            onClick={clearAllFilters}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            清除全部
          </button>
        </div>
      )}

      <div className="flex items-start gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 flex-shrink-0 md:sticky md:top-24 md:block md:self-start">
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
            {FilterPanel()}
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
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

// ─── Sub-components ────────────────────────────────────────────────────────────

function FilterSection({
  title,
  accentColor,
  active,
  children,
}: {
  title: string
  accentColor: string
  active: boolean
  children: ReactNode
}) {
  return (
    <div className="border-t border-gray-100 py-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {active && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: accentColor }}
          >
            已選
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function FilterChip({
  label,
  active,
  activeColor,
  onClick,
}: {
  label: string
  active: boolean
  activeColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150"
      style={
        active
          ? { backgroundColor: activeColor, borderColor: activeColor, color: '#fff' }
          : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#4b5563' }
      }
    >
      {label}
    </button>
  )
}

function ActiveFilterPill({
  label,
  color,
  onRemove,
}: {
  label: string
  color: string
  onRemove: () => void
}) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
      <button
        onClick={onRemove}
        className="flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full bg-white/25 transition-colors hover:bg-white/40"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}
