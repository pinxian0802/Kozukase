'use client'

import { use, useState, useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bookmark, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ListingComparison } from '@/components/product/listing-comparison'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { ImageGallery } from '@/components/shared/image-gallery'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ProductDetailSkeleton } from '@/components/buyer/skeletons/product-detail-skeleton'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { toast } from 'sonner'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'
import { useSession } from '@/lib/context/session-context'

export default function ProductPageClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const session = useSession()
  const backHref = searchParams.get('from') ?? '/search'
  const utils = trpc.useUtils()
  const { data: product, isLoading } = trpc.product.getById.useQuery(
    { id },
    { retry: (count, err) => err.data?.code !== 'NOT_FOUND' && count < 3 }
  )
  const recordView = trpc.analytics.recordProductView.useMutation()
  useEffect(() => {
    if (!product) return
    if (session?.user?.id === product.created_by) return
    const key = `pv_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    recordView.mutate({ product_id: id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])
  const brandLabel = product && (typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null)

  // 固定每頁顯示 5 個橫列卡片（已移除使用者可選的每頁筆數下拉）。
  // ListingComparison 卡片格狀桌機為 3 欄 → 5 列 = 15 筆。
  const PAGE_SIZE = 5 * 3
  const PRICE_STEP = 100
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [listPage, setListPage] = useState(1)

  useEffect(() => { setListPage(1) }, [inStockOnly, minPrice, maxPrice])

  const bookmarkToggle = trpc.bookmark.toggleProductBookmark.useMutation({
    onMutate: async () => {
      await utils.product.getById.cancel({ id })
      const prev = utils.product.getById.getData({ id })
      if (prev) {
        utils.product.getById.setData({ id }, { ...prev, hasBookmarked: !prev.hasBookmarked })
      }
      return { prev }
    },
    onError: (err, _vars, context) => {
      if (context?.prev) utils.product.getById.setData({ id }, context.prev)
      toast.error(err.message)
    },
    onSettled: () => utils.product.getById.invalidate({ id }),
  })

  const allListings = product?.listings ?? []
  const PRICE_MAX = Math.max(10000, ...allListings.map((l: any) => l.price ?? 0))
  const effectiveMax = maxPrice ?? PRICE_MAX
  const isPriceFiltered = minPrice > 0 || (maxPrice !== null && maxPrice < PRICE_MAX)
  const filteredListings = allListings.filter((listing: any) => {
    if (inStockOnly && !listing.is_in_stock) return false
    if (isPriceFiltered && listing.is_price_on_request) return false
    if (listing.price !== null) {
      if (listing.price < minPrice) return false
      if (listing.price > effectiveMax) return false
    }
    return true
  })

  const totalListPages = Math.ceil(filteredListings.length / PAGE_SIZE)
  const paginatedListings = filteredListings.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE)

  const priceRangeLabel = isPriceFiltered
    ? `NT$${minPrice.toLocaleString()} ~ NT$${effectiveMax.toLocaleString()}`
    : ''

  const thumbCls = 'pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-500 [&::-webkit-slider-thumb]:bg-surface-card [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:bg-transparent'

  const FilterContent = () => (
    <div className="space-y-4">
      <FilterSectionCard
        title="有現貨"
        rightSlot={
          <Switch
            checked={inStockOnly}
            onCheckedChange={setInStockOnly}
          />
        }
      />
      <FilterSectionCard title="價格區間 (NT$)">
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-semibold text-text-strong">
            <span>NT${minPrice.toLocaleString()}</span>
            <span>NT${effectiveMax.toLocaleString()}</span>
          </div>

          <div className="relative h-5">
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border-soft" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-500"
              style={{
                left: `${(minPrice / PRICE_MAX) * 100}%`,
                right: `${((PRICE_MAX - effectiveMax) / PRICE_MAX) * 100}%`,
              }}
            />
            <input
              type="range"
              min={0}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={minPrice}
              onChange={(e) => setMinPrice(Math.min(Number(e.target.value), effectiveMax - PRICE_STEP))}
              className={thumbCls}
            />
            <input
              type="range"
              min={0}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={effectiveMax}
              onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice + PRICE_STEP))}
              className={thumbCls}
            />
          </div>

          {isPriceFiltered && (
            <button
              type="button"
              className="cursor-pointer text-left text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => { setMinPrice(0); setMaxPrice(null) }}
            >
              清除
            </button>
          )}
        </div>
      </FilterSectionCard>
    </div>
  )

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-surface-page">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <EmptyState
            icon="notFound"
            title="找不到此商品"
            description="此頁面已失效"
          >
            <Link
              href="/search?tab=products"
              className="inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white hover:opacity-85 active:scale-[0.98] transition-all"
              style={{ background: 'var(--brand-700)' }}
            >
              瀏覽其他商品
            </Link>
          </EmptyState>
        </div>
      </div>
    )
  }

  const galleryImages = [
    ...(product.catalog_image ? [{ url: product.catalog_image.url, alt: product.name }] : []),
    ...(product.product_images ?? [])
      .filter((image: any) => image.id !== product.catalog_image?.id)
      .map((image: any) => ({ url: image.url, alt: product.name })),
  ]

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-6xl px-3 py-3 md:px-4 md:py-6">
        <PageBreadcrumb items={[
          { label: '商品', href: backHref },
          { label: product.name },
        ]} />
        <div className="flex items-start gap-6">
          {/* Left sidebar */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="space-y-4 pr-2">
              {/* Product info card */}
              <section className="overflow-hidden rounded-[24px] border border-border-soft bg-surface-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
                <div className="space-y-3">
                  <ImageGallery
                    images={galleryImages}
                    title="商品圖片"
                    emptyTitle="暫無商品圖片"
                    emptyDescription="這個商品目前還沒有圖片"
                  />
                  <div className="space-y-0.5">
                    {brandLabel && <p className="text-xs text-muted-foreground">{brandLabel}</p>}
                    <h1 className="text-lg font-bold font-heading leading-snug">{product.name}</h1>
                  </div>
                  <div className="pt-1">
                    <Button
                      variant={product.hasBookmarked ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => bookmarkToggle.mutate({ product_id: id })}
                      disabled={bookmarkToggle.isPending}
                    >
                      <Bookmark className={`mr-2 h-4 w-4 shrink-0 ${product.hasBookmarked ? 'fill-current' : ''}`} />
                      收藏
                    </Button>
                  </div>
                </div>
              </section>

              {FilterContent()}
            </div>
          </aside>

          {/* Right content */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* 尋找代購 title card */}
            <section className="mb-3 overflow-hidden rounded-xl border border-border-soft bg-surface-card p-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:mb-4 md:rounded-2xl md:p-5">
              <div className="flex items-start justify-between gap-3 md:gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-bold font-heading md:text-2xl">尋找代購，共 {filteredListings.length} 位</h2>
                  {(isPriceFiltered || inStockOnly) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {inStockOnly && (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                          onClick={() => setInStockOnly(false)}
                        >
                          有現貨
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {isPriceFiltered && (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                          onClick={() => { setMinPrice(0); setMaxPrice(PRICE_MAX) }}
                        >
                          {priceRangeLabel}
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Sheet>
                  <SheetTrigger
                    render={<Button variant="outline" size="icon" className="md:hidden shrink-0"><SlidersHorizontal className="h-4 w-4" /></Button>}
                  />
                  <SheetContent side="left" className="border-r border-border-soft bg-surface-page p-0 gap-0">
                    <div className="h-full overflow-y-auto p-4">
                      <SheetHeader className="px-0 py-0">
                        <SheetTitle>篩選條件</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4">
                        {FilterContent()}
                      </div>
                    </div>
                  </SheetContent>
                  </Sheet>
                </div>
              </div>
            </section>

            <ListingComparison listings={paginatedListings} />
            <Pagination
              page={listPage}
              totalPages={totalListPages}
              onPageChange={(p) => {
                setListPage(p)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="mt-8"
            />
          </div>
        </div>
      </div>
    </div>
  )

}

function FilterSectionCard({ title, rightSlot, children }: { title: string; rightSlot?: ReactNode; children?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-border-soft bg-surface-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-text-strong">{title}</div>
          {rightSlot}
        </div>
        {children}
      </div>
    </section>
  )
}
