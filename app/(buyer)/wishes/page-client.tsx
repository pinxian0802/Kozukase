'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryStates, parseAsString, parseAsInteger } from 'nuqs'
import { Heart, Plus, SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { WishCard } from '@/components/buyer/wish-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { ProductCategory } from '@/lib/validators/product'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'

// 固定每頁顯示 5 個橫列卡片，桌機 3 欄 → 15 筆（與連線代購／搜尋頁一致）
const PAGE_SIZE = 5 * 3

export default function WishesPage() {
  const router = useRouter()
  const session = useSession()

  // 一組會一起變動的篩選；history:'push' 讓上一頁可逐步回退（與連線代購頁一致）
  const [{ category, brand: brandId, page }, setParams] = useQueryStates(
    {
      category: parseAsString,
      brand: parseAsString,
      page: parseAsInteger.withDefault(1),
    },
    { history: 'push', scroll: false, shallow: true },
  )

  const safePage = Math.max(1, page)
  const categoryArg = (category ?? undefined) as ProductCategory | undefined

  const [categoryExpanded, setCategoryExpanded] = useState(false)
  const [brandExpanded, setBrandExpanded] = useState(false)

  // 品牌超過這個數量就收合，多的藏在「查看更多品牌」後面
  const BRAND_VISIBLE_LIMIT = 6

  const { data: brandsData } = trpc.brand.list.useQuery()
  const brands = brandsData ?? []

  const { data, isLoading, isFetching } = trpc.wish.publicFeed.useQuery(
    {
      page: safePage,
      limit: PAGE_SIZE,
      category: categoryArg,
      brandId: brandId || undefined,
    },
    { placeholderData: (prev) => prev },
  )

  const wishes = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const listLoading = isLoading || isFetching

  // 任一離散篩選改變 → 回第 1 頁
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

  const categoryLabel = category ? PRODUCT_CATEGORY_LABELS[category] ?? category : ''
  const brandLabel = brands.find((b: any) => b.id === brandId)?.name ?? ''

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = []
  if (category) {
    activeFilters.push({ key: 'category', label: categoryLabel, onRemove: () => updateParam('category', null) })
  }
  if (brandId) {
    activeFilters.push({ key: 'brand', label: brandLabel, onRemove: () => updateParam('brand', null) })
  }

  const FilterPanel = () => (
    <div className="space-y-4">
      {/* 商品類別 */}
      <FilterSection title="商品類別">
        <div className="space-y-1">
          {firstHalf.map(([key, label]) => (
            <FilterCheckbox
              key={key}
              label={label}
              checked={category === key}
              onClick={() => updateParam('category', category === key ? null : key)}
            />
          ))}
          {categoryExpanded &&
            secondHalf.map(([key, label]) => (
              <FilterCheckbox
                key={key}
                label={label}
                checked={category === key}
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

      {/* 品牌 */}
      {brands.length > 0 && (
        <FilterSection title="品牌">
          <div className="space-y-1">
            {(brandExpanded ? brands : brands.slice(0, BRAND_VISIBLE_LIMIT)).map((brand: any) => (
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
          {/* Mobile compact header */}
          <div className="mb-2 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[13px] font-bold text-text-strong">
                許願榜 {listLoading ? '' : `${total} 筆`}
              </h1>
              <div className="flex items-center gap-1.5">
                <Sheet>
                  <SheetTrigger
                    render={
                      <button className="relative flex h-7 cursor-pointer items-center gap-1 rounded-full border border-border-soft bg-white px-2.5 text-[11px] text-neutral-600 shadow-sm">
                        <SlidersHorizontal className="h-3 w-3" />
                        篩選
                        {activeFilters.length > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                            {activeFilters.length}
                          </span>
                        )}
                      </button>
                    }
                  />
                  <SheetContent side="left" className="border-r border-border-soft bg-surface-page p-0 gap-0">
                    <div className="h-full overflow-y-auto p-4 [scrollbar-width:thin]">
                      <SheetHeader className="px-0 py-0">
                        <SheetTitle>篩選條件</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4">{FilterPanel()}</div>
                    </div>
                  </SheetContent>
                </Sheet>
                {session && (
                  <button
                    type="button"
                    onClick={() => router.push('/wishes/new')}
                    className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-brand-500 px-2.5 text-[11px] font-medium text-white shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    新增
                  </button>
                )}
              </div>
            </div>
            {/* Mobile active filter chips */}
            {activeFilters.length > 0 && (
              <div className="mt-1.5 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border-soft bg-white px-2 py-0.5 text-[10px] font-medium text-text-muted"
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
          <section className="mb-4 hidden overflow-hidden rounded-2xl border border-border-soft bg-surface-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-2xl font-bold">
                  許願榜，共 {listLoading ? '' : total} 筆
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
              {session && (
                <Button onClick={() => router.push('/wishes/new')} className="shrink-0 gap-2">
                  <Plus className="h-4 w-4" />
                  新增許願
                </Button>
              )}
            </div>
          </section>

          {listLoading ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl md:aspect-auto md:h-64" />
              ))}
            </div>
          ) : wishes.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
                {wishes.map((wish: any) => (
                  <WishCard key={wish.id} wish={wish} />
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
            <EmptyState icon={Heart} title="還沒有人許願" description="先去新增你想要的商品吧！" />
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

function FilterSection({ title, titleExtra, rightSlot, children }: { title: string; titleExtra?: ReactNode; rightSlot?: ReactNode; children?: ReactNode }) {
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
