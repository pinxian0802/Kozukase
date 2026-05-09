'use client'

import { use, useState, useTransition, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Heart, Bookmark, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ListingComparison } from '@/components/product/listing-comparison'
import { EmptyState } from '@/components/shared/empty-state'
import { ImageGallery } from '@/components/shared/image-gallery'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/lib/trpc/client'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/utils/format'
import { toast } from 'sonner'
import { PageBreadcrumb } from '@/components/shared/page-breadcrumb'

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const backHref = searchParams.get('from') ?? '/search'
  const utils = trpc.useUtils()
  const { data: product, isLoading } = trpc.product.getById.useQuery({ id })
  const brandLabel = product && (typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null)

  const PRICE_STEP = 100
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [isFilterPending, startFilterTransition] = useTransition()

  const wishToggle = trpc.wish.toggle.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id }),
    onError: (err) => toast.error(err.message),
  })

  const bookmarkToggle = trpc.bookmark.toggleProductBookmark.useMutation({
    onSuccess: () => utils.product.getById.invalidate({ id }),
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

  const priceRangeLabel = isPriceFiltered
    ? `NT$${minPrice.toLocaleString()} ~ NT$${effectiveMax.toLocaleString()}`
    : ''

  const thumbCls = 'pointer-events-none absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#2da6cf] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:bg-transparent'

  const FilterContent = () => (
    <div className="space-y-4">
      <FilterSectionCard
        title="有現貨"
        rightSlot={
          <Switch
            checked={inStockOnly}
            onCheckedChange={(checked) => startFilterTransition(() => setInStockOnly(checked))}
          />
        }
      />
      <FilterSectionCard title="價格區間 (NT$)">
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-semibold text-[#222]">
            <span>NT${minPrice.toLocaleString()}</span>
            <span>NT${effectiveMax.toLocaleString()}</span>
          </div>

          <div className="relative h-5">
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-[#e8e3dc]" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#2da6cf]"
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
              onChange={(e) => startFilterTransition(() => setMinPrice(Math.min(Number(e.target.value), effectiveMax - PRICE_STEP)))}
              className={thumbCls}
            />
            <input
              type="range"
              min={0}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={effectiveMax}
              onChange={(e) => startFilterTransition(() => setMaxPrice(Math.max(Number(e.target.value), minPrice + PRICE_STEP)))}
              className={thumbCls}
            />
          </div>

          {isPriceFiltered && (
            <button
              type="button"
              className="cursor-pointer text-left text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => startFilterTransition(() => { setMinPrice(0); setMaxPrice(null) })}
            >
              清除
            </button>
          )}
        </div>
      </FilterSectionCard>
    </div>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFD]">
        <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAFAFD]">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <EmptyState icon={Heart} title="找不到此商品" />
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
    <div className="min-h-screen bg-[#FAFAFD]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <PageBreadcrumb items={[
          { label: '商品', href: backHref },
          { label: product.name },
        ]} />
        <div className="flex items-start gap-6">
          {/* Left sidebar */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="space-y-4 pr-2">
              {/* Product info card */}
              <section className="overflow-hidden rounded-[24px] border border-[#ebe6dd] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
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
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant={product.hasWished ? 'default' : 'outline'}
                      className="flex-1 min-w-0"
                      onClick={() => wishToggle.mutate({ product_id: id })}
                      disabled={wishToggle.isPending}
                    >
                      <Heart className={`mr-2 h-4 w-4 shrink-0 ${product.hasWished ? 'fill-current' : ''}`} />
                      許願
                    </Button>
                    <Button
                      variant={product.hasBookmarked ? 'default' : 'outline'}
                      className="flex-1 min-w-0"
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
            <section className="mb-4 overflow-hidden rounded-2xl border border-[#ebe6dd] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold font-heading">尋找代購，共 {isFilterPending ? '' : filteredListings.length} 位代購</h2>
                  {(isPriceFiltered || inStockOnly) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {inStockOnly && (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                          onClick={() => startFilterTransition(() => setInStockOnly(false))}
                        >
                          有現貨
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {isPriceFiltered && (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                          onClick={() => startFilterTransition(() => { setMinPrice(0); setMaxPrice(PRICE_MAX) })}
                        >
                          {priceRangeLabel}
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Sheet>
                  <SheetTrigger
                    render={<Button variant="outline" size="icon" className="md:hidden shrink-0"><SlidersHorizontal className="h-4 w-4" /></Button>}
                  />
                  <SheetContent side="left" className="border-r border-[#e8e3dc] bg-[#fbfaf8] p-0 gap-0">
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
            </section>

            {isFilterPending ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <ListingComparison listings={filteredListings} />
            )}
          </div>
        </div>
      </div>
    </div>
  )

}

function FilterSectionCard({ title, rightSlot, children }: { title: string; rightSlot?: ReactNode; children?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[#ebe6dd] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[#222]">{title}</div>
          {rightSlot}
        </div>
        {children}
      </div>
    </section>
  )
}
