'use client'

import { useState, type ReactNode, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, isValid, parseISO } from 'date-fns'
import { Globe, Info, Search, SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { Switch } from '@/components/ui/switch'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { trpc } from '@/lib/trpc/client'

export default function ConnectionsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [regionId, setRegionId] = useState('')
  const [regionSearch, setRegionSearch] = useState('')
  const [showAllRegions, setShowAllRegions] = useState(false)
  const [activeDuringStart, setActiveDuringStart] = useState('')
  const [activeDuringEnd, setActiveDuringEnd] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [hasBillingMethod, setHasBillingMethod] = useState(false)
  const [brandId, setBrandId] = useState('')
  const [canWish, setCanWish] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const { data: regionsData } = trpc.seller.getRegions.useQuery()
  const { data: brandsData } = trpc.brand.list.useQuery()
  const brands = brandsData ?? []

  const POPULAR_REGION_NAMES = ['日本', '韓國', '澳洲', '美國', '中國', '泰國', '越南']

  const regions = regionsData ?? []
  const regionSearchText = regionSearch.trim().toLowerCase()
  const locationText = locationQuery.trim()
  const filteredRegions = regionSearchText
    ? regions.filter((region: any) => region.name.toLowerCase().includes(regionSearchText))
    : regions

  const popularRegions = POPULAR_REGION_NAMES
    .map(name => regions.find((r: any) => r.name === name))
    .filter(Boolean)
  const otherRegions = regions.filter((r: any) => !POPULAR_REGION_NAMES.includes(r.name))

  // Reset to page 1 when any filter or pageSize changes
  useEffect(() => { setPage(1) }, [regionId, activeDuringStart, activeDuringEnd, locationQuery, hasBillingMethod, brandId, canWish, q, pageSize])

  const { data, isLoading, isFetching } =
    trpc.connection.browse.useQuery(
      {
        limit: pageSize,
        page,
        title_query: q || undefined,
        region_id: regionId || undefined,
        location_query: locationText || undefined,
        has_billing_method: hasBillingMethod || undefined,
        brand_id: brandId || undefined,
        can_wish: canWish || undefined,
        active_during: (activeDuringStart || activeDuringEnd)
          ? {
              start: activeDuringStart || undefined,
              end: activeDuringEnd || undefined,
            }
          : undefined,
      },
      { placeholderData: (prev) => prev }
    )

  const connections = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  useEffect(() => { setIsPending(false) }, [data])
  const listLoading = isPending || isLoading || isFetching

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const regionLabel = regions.find((region: any) => region.id === regionId)?.name ?? ''

  const formatShortDate = (value: string) => {
    const parsed = parseISO(value)
    return isValid(parsed) ? format(parsed, 'M/d') : value
  }

  // date range counts as one filter, not two
  const activeFilterCount = [regionId, activeDuringStart || activeDuringEnd, locationText, hasBillingMethod, brandId, canWish].filter(Boolean).length
  const brandLabel = brands.find((b: any) => b.id === brandId)?.name ?? ''

  const activeDateLabel =
    activeDuringStart || activeDuringEnd
      ? `${activeDuringStart ? formatShortDate(activeDuringStart) : ''} ~ ${activeDuringEnd ? formatShortDate(activeDuringEnd) : ''}`.trim()
      : ''

  const FilterContent = () => {
    const renderRegionRow = (region: any) => {
      const isSelected = regionId === region.id
      return (
        <FilterCheckbox
          key={region.id}
          label={region.name}
          checked={isSelected}
          onClick={() => { setIsPending(true); setRegionId(isSelected ? '' : region.id) }}
        />
      )
    }

    return (
      <div className="space-y-4">
        <FilterSectionCard
          title="可許願"
          titleExtra={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span className="flex cursor-default items-center" />}>
                  <Info className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  允許買家對此連線送出許願商品需求
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
          rightSlot={
            <Switch
              checked={canWish}
              onCheckedChange={(v) => { setIsPending(true); setCanWish(v) }}
            />
          }
        />

        <FilterSectionCard title="地點搜尋">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              placeholder="例如：稻荷神社"
              className="pl-9"
            />
          </div>
        </FilterSectionCard>

        <FilterSectionCard title="國家">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={regionSearch}
                onChange={(event) => setRegionSearch(event.target.value)}
                placeholder="搜尋國家..."
                className="h-11 rounded-[16px] border-[#e1ddd7] bg-white pl-10 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
              />
            </div>

            {regionSearchText ? (
              filteredRegions.length > 0
                ? <div className="space-y-3">{filteredRegions.map(renderRegionRow)}</div>
                : <div className="py-2 text-sm text-muted-foreground">找不到相符的國家</div>
            ) : (
              <>
                <div className="space-y-3">{popularRegions.map(renderRegionRow)}</div>

                {otherRegions.length > 0 && (
                  <>
                    {showAllRegions && (
                      <div className="space-y-3">{otherRegions.map(renderRegionRow)}</div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className={showAllRegions
                        ? "h-12 w-full rounded-[16px] border-[#e1ddd7] text-[#555] hover:bg-[#faf9f7] hover:text-[#333]"
                        : "h-12 w-full rounded-[16px] border-[#28a5cf] text-[#1a9ac4] hover:bg-[#f4fbfe] hover:text-[#168eb4]"
                      }
                      onClick={() => setShowAllRegions(!showAllRegions)}
                    >
                      {showAllRegions ? '收起國家' : '查看更多國家'}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </FilterSectionCard>

        {brands.length > 0 && (
          <FilterSectionCard title="品牌">
            <div className="space-y-3">
              {brands.map((brand: any) => (
                <FilterCheckbox
                  key={brand.id}
                  label={brand.name}
                  checked={brandId === brand.id}
                  onClick={() => { setIsPending(true); setBrandId(brandId === brand.id ? '' : brand.id) }}
                />
              ))}
            </div>
          </FilterSectionCard>
        )}

        <FilterSectionCard title="連線日期">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-[#999]">從</Label>
              <DatePicker
                value={activeDuringStart}
                onValueChange={(v) => { setIsPending(true); setActiveDuringStart(v) }}
                placeholder="選擇開始日期"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-[#999]">到</Label>
              <DatePicker
                value={activeDuringEnd}
                onValueChange={(v) => { setIsPending(true); setActiveDuringEnd(v) }}
                placeholder="選擇結束日期"
                className="w-full"
              />
            </div>

          </div>
        </FilterSectionCard>

        <FilterSectionCard
          title="提供付款方式"
          rightSlot={
            <Switch
              checked={hasBillingMethod}
              onCheckedChange={(v) => { setIsPending(true); setHasBillingMethod(v) }}
            />
          }
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFD]">
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-start gap-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="pr-2">
            {FilterContent()}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <section className="mb-4 overflow-hidden rounded-2xl border border-[#ebe6dd] bg-white p-5 pb-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold font-heading">
                  {q ? `「${q}」的搜尋結果` : '連線代購'}，共 {listLoading ? '' : total} 筆
                </h1>
                {activeFilterCount > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {regionLabel && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={() => { setIsPending(true); setRegionId('') }}
                      >
                        {regionLabel}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {activeDateLabel && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={() => {
                          setIsPending(true)
                          setActiveDuringStart('')
                          setActiveDuringEnd('')
                        }}
                      >
                        {activeDateLabel}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {locationText && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={() => { setIsPending(true); setLocationQuery('') }}
                      >
                        地點：{locationText}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {brandLabel && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={() => { setIsPending(true); setBrandId('') }}
                      >
                        {brandLabel}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {canWish && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={() => { setIsPending(true); setCanWish(false) }}
                      >
                        可許願
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {hasBillingMethod && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#dde1e7] bg-white px-2.5 py-1 text-xs font-medium text-[#444e5a] shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-[#c5cad3] hover:bg-[#f8fafc]"
                        onClick={() => { setIsPending(true); setHasBillingMethod(false) }}
                      >
                        提供付款方式
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-9 w-24 text-sm">
                    <SelectValue>{pageSize} 筆</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 筆</SelectItem>
                    <SelectItem value="20">20 筆</SelectItem>
                    <SelectItem value="50">50 筆</SelectItem>
                  </SelectContent>
                </Select>
                <Sheet>
                <SheetTrigger
                  render={<Button variant="outline" size="icon" className="md:hidden shrink-0"><SlidersHorizontal className="h-4 w-4" /></Button>}
                />
                <SheetContent side="left" className="border-r border-[#e8e3dc] bg-[#fbfaf8] p-0 gap-0">
                  <div className="h-full overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:#d4cfc9_transparent] [&::-webkit-scrollbar]:w-0.75 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d4cfc9]">
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

          {listLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : connections.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {connections.map((c: any) => (
                  <ConnectionCard key={c.id} connection={c} />
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
              icon={Globe}
              title="找不到相符的連線代購"
              description="試試其他地區、日期或地點條件"
            />
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

function FilterSectionCard({ title, titleExtra, rightSlot, children }: { title: string; titleExtra?: ReactNode; rightSlot?: ReactNode; children?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[#ebe6dd] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#222]">
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
