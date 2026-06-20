'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useQueryState, useQueryStates, parseAsString, parseAsInteger, parseAsBoolean } from 'nuqs'
import { format, isValid, parseISO } from 'date-fns'
import { Info, Search, SlidersHorizontal, X } from 'lucide-react'
import { FilterCheckbox } from '@/components/ui/filter-checkbox'
import { Switch } from '@/components/ui/switch'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { trpc } from '@/lib/trpc/client'

// 固定每頁顯示 5 個橫列卡片（已移除使用者可選的每頁筆數下拉）。
// 卡片格狀桌機為 3 欄 → 5 列 = 15 筆。
const PAGE_SIZE = 5 * 3

export default function ConnectionsPage() {
  // q 由全站搜尋框帶入，本頁唯讀
  const [q] = useQueryState('q', parseAsString.withDefault(''))

  // 地點關鍵字：本地輸入,使用者按 Enter（或點 chip X 清除）時才推進 URL/觸發查詢
  const [locationQuery, setLocationQuery] = useQueryState(
    'location',
    parseAsString.withDefault('').withOptions({ history: 'push', shallow: true }),
  )

  // 一組會一起變動的離散篩選；history:'push' 讓上一頁可逐步回退（與 /search 一致）。
  // 刻意不傳 startTransition：避免被 React transition 延遲而與 react-query
  //（useSyncExternalStore）脫節造成計數抖動。
  const [
    {
      region: regionId,
      brand: brandId,
      billing: hasBillingMethod,
      canWish,
      social: socialVerifiedOnly,
      dateStart: activeDuringStart,
      dateEnd: activeDuringEnd,
      page,
    },
    setParams,
  ] = useQueryStates(
    {
      region: parseAsString,
      brand: parseAsString,
      billing: parseAsBoolean.withDefault(false),
      canWish: parseAsBoolean.withDefault(false),
      social: parseAsBoolean.withDefault(false),
      dateStart: parseAsString.withDefault(''),
      dateEnd: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
    },
    { history: 'push', scroll: false, shallow: true },
  )

  // 防呆（對齊原本 useState 預設與白名單）
  const safePage = Math.max(1, page)

  const [regionSearch, setRegionSearch] = useState('')
  const [showAllRegions, setShowAllRegions] = useState(false)
  const [showAllBrands, setShowAllBrands] = useState(false)

  // 品牌超過這個數量就收合，多的藏在「查看更多品牌」後面
  const BRAND_VISIBLE_LIMIT = 6

  // 任一離散篩選改變 → 回第 1 頁（取代原 reset-page effect）
  const setFilter = (
    patch: Partial<{
      region: string | null
      brand: string | null
      billing: boolean
      canWish: boolean
      social: boolean
      dateStart: string
      dateEnd: string
    }>,
  ) => {
    setParams({ ...patch, page: 1 })
  }

  // 地點輸入用本地 state 控制,按 Enter 才提交;URL 端有變動（如 chip X 清除）時同步回 input
  const [locationInput, setLocationInput] = useState(locationQuery)
  useEffect(() => {
    setLocationInput(locationQuery)
  }, [locationQuery])

  const commitLocation = (value: string) => {
    const next = value.trim()
    if (next === locationQuery) return
    setLocationQuery(next || null)
    if (safePage !== 1) setParams({ page: 1 })
  }
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

  const { data, isLoading, isFetching } =
    trpc.connection.browse.useQuery(
      {
        limit: PAGE_SIZE,
        page: safePage,
        title_query: q || undefined,
        region_id: regionId || undefined,
        location_query: locationText || undefined,
        has_billing_method: hasBillingMethod || undefined,
        brand_id: brandId || undefined,
        can_wish: canWish || undefined,
        social_verified_only: socialVerifiedOnly || undefined,
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
  const listLoading = isLoading || isFetching

  const handlePageChange = (newPage: number) => {
    setParams({ page: newPage })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const regionLabel = regions.find((region: any) => region.id === regionId)?.name ?? ''

  const formatShortDate = (value: string) => {
    const parsed = parseISO(value)
    return isValid(parsed) ? format(parsed, 'M/d') : value
  }

  // date range counts as one filter, not two
  const activeFilterCount = [regionId, activeDuringStart || activeDuringEnd, locationText, hasBillingMethod, brandId, canWish, socialVerifiedOnly].filter(Boolean).length
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
          onClick={() => setFilter({ region: isSelected ? null : region.id })}
        />
      )
    }

    return (
      <div className="space-y-4">
        <FilterSectionCard
          title="社群驗證"
          titleExtra={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span className="flex cursor-default items-center" />}>
                  <Info className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  只顯示已連結社群帳號的賣家
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
          rightSlot={
            <Switch
              checked={socialVerifiedOnly}
              onCheckedChange={(v) => setFilter({ social: v })}
            />
          }
        />

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
              onCheckedChange={(v) => setFilter({ canWish: v })}
            />
          }
        />

        <FilterSectionCard title="地點搜尋">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={locationInput}
              onChange={(event) => setLocationInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitLocation(locationInput)
                }
              }}
              placeholder="例如：稻荷神社（按 Enter 搜尋）"
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
                className="h-11 rounded-[16px] border-border-soft bg-surface-card pl-10 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
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
                    <button
                      type="button"
                      className="mx-auto block text-sm font-medium text-brand-700 transition-colors hover:text-brand-500"
                      onClick={() => setShowAllRegions(!showAllRegions)}
                    >
                      {showAllRegions ? '收起國家' : '查看更多國家'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </FilterSectionCard>

        {brands.length > 0 && (
          <FilterSectionCard title="品牌">
            <div className="space-y-3">
              {(showAllBrands ? brands : brands.slice(0, BRAND_VISIBLE_LIMIT)).map((brand: any) => (
                <FilterCheckbox
                  key={brand.id}
                  label={brand.name}
                  checked={brandId === brand.id}
                  onClick={() => setFilter({ brand: brandId === brand.id ? null : brand.id })}
                />
              ))}
              {brands.length > BRAND_VISIBLE_LIMIT && (
                <button
                  type="button"
                  className="mx-auto block text-sm font-medium text-brand-700 transition-colors hover:text-brand-500"
                  onClick={() => setShowAllBrands(!showAllBrands)}
                >
                  {showAllBrands ? '收起品牌' : '查看更多品牌'}
                </button>
              )}
            </div>
          </FilterSectionCard>
        )}

        <FilterSectionCard title="連線日期">
          <DateRangePicker
            startDate={activeDuringStart}
            endDate={activeDuringEnd}
            onRangeChange={({ startDate, endDate }) => setFilter({ dateStart: startDate, dateEnd: endDate })}
            className="w-full"
          />
        </FilterSectionCard>

        <FilterSectionCard
          title="提供付款方式"
          rightSlot={
            <Switch
              checked={hasBillingMethod}
              onCheckedChange={(v) => setFilter({ billing: v })}
            />
          }
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-page">
    <div className="mx-auto max-w-6xl px-3 py-3 md:px-4 md:py-6">
      <div className="flex items-start gap-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="pr-2">
            {FilterContent()}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile compact header */}
          <div className="mb-2 md:hidden">
            <div className="flex items-center justify-between">
              <h1 className="text-[13px] font-bold text-text-strong">
                {q ? `「${q}」` : '連線代購'} {listLoading ? '' : `${total} 筆`}
              </h1>
              <Sheet>
                <SheetTrigger
                  render={
                    <button className="relative flex h-7 cursor-pointer items-center gap-1 rounded-full border border-border-soft bg-white px-2.5 text-[11px] text-neutral-600 shadow-sm">
                      <SlidersHorizontal className="h-3 w-3" />
                      篩選
                      {activeFilterCount > 0 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                          {activeFilterCount}
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
                    <div className="mt-4">{FilterContent()}</div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop title card */}
          <section className="mb-4 hidden overflow-hidden rounded-2xl border border-border-soft bg-surface-card p-5 pb-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-[17px] font-bold font-heading md:text-2xl">
                  {q ? `「${q}」的搜尋結果` : '連線代購'}，共 {listLoading ? '' : total} 筆
                </h1>
                {activeFilterCount > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {regionLabel && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => setFilter({ region: null })}
                      >
                        {regionLabel}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {activeDateLabel && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => setFilter({ dateStart: '', dateEnd: '' })}
                      >
                        {activeDateLabel}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {locationText && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => commitLocation('')}
                      >
                        地點：{locationText}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {brandLabel && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => setFilter({ brand: null })}
                      >
                        {brandLabel}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {canWish && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => setFilter({ canWish: false })}
                      >
                        可許願
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {socialVerifiedOnly && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => setFilter({ social: false })}
                      >
                        社群驗證
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {hasBillingMethod && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-soft bg-surface-card px-2.5 py-1 text-xs font-medium text-text-muted shadow-[0_1px_2px_rgba(0,0,0,0.07)] transition-colors hover:border-border-strong hover:bg-surface-muted"
                        onClick={() => setFilter({ billing: false })}
                      >
                        提供付款方式
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {listLoading ? (
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : connections.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4">
                {connections.map((c: any) => (
                  <ConnectionCard key={c.id} connection={c} />
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
              icon="connection"
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
