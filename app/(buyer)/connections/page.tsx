'use client'

import { useState, type ReactNode } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { Globe, Search, SlidersHorizontal, X } from 'lucide-react'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'

export default function ConnectionsPage() {
  const [regionId, setRegionId] = useState('')
  const [activeDuringStart, setActiveDuringStart] = useState('')
  const [activeDuringEnd, setActiveDuringEnd] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const { data: regionsData } = trpc.seller.getRegions.useQuery()

  const regions = regionsData ?? []
  const locationText = locationQuery.trim()

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.connection.browse.useInfiniteQuery(
      {
        limit: 20,
        region_id: regionId || undefined,
        location_query: locationText || undefined,
        active_during: (activeDuringStart || activeDuringEnd)
          ? {
              start: activeDuringStart || undefined,
              end: activeDuringEnd || undefined,
            }
          : undefined,
      },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const connections = data?.pages.flatMap((p: any) => p.items) ?? []
  const total = data?.pages[0]?.total ?? connections.length
  const regionLabel = regions.find((region: any) => region.id === regionId)?.name ?? ''

  const formatShortDate = (value: string) => {
    const parsed = parseISO(value)
    return isValid(parsed) ? format(parsed, 'M/d') : value
  }

  // date range counts as one filter, not two
  const activeFilterCount = [regionId, activeDuringStart || activeDuringEnd, locationText].filter(Boolean).length

  const activeDateLabel =
    activeDuringStart || activeDuringEnd
      ? `${activeDuringStart ? formatShortDate(activeDuringStart) : ''} ~ ${activeDuringEnd ? formatShortDate(activeDuringEnd) : ''}`.trim()
      : ''

  const FilterContent = () => (
    <div className="space-y-3">
      <div className="px-0.5 text-[11px] font-bold uppercase tracking-widest text-[#aaa]">篩選條件</div>

      <FilterSectionCard title="國家">
        <SearchableSelect
          value={regionId}
          onValueChange={setRegionId}
          options={regions.map((region: any) => ({ value: region.id, label: region.name }))}
          placeholder="選擇國家"
          searchPlaceholder="搜尋國家..."
          emptyText="找不到相符的國家"
        />
        {regionId && (
          <button
            type="button"
            className="text-left text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => setRegionId('')}
          >
            清除
          </button>
        )}
      </FilterSectionCard>

      <FilterSectionCard title="連線日期">
        <div className="space-y-2">
          <Label className="text-[11px] font-medium text-[#999]">從</Label>
          <DatePicker
            value={activeDuringStart}
            onValueChange={setActiveDuringStart}
            placeholder="選擇開始日期"
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] font-medium text-[#999]">到</Label>
          <DatePicker
            value={activeDuringEnd}
            onValueChange={setActiveDuringEnd}
            placeholder="選擇結束日期"
            className="w-full"
          />
        </div>
        {(activeDuringStart || activeDuringEnd) && (
          <button
            type="button"
            className="text-left text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => {
              setActiveDuringStart('')
              setActiveDuringEnd('')
            }}
          >
            清除
          </button>
        )}
      </FilterSectionCard>

      <FilterSectionCard title="地點搜尋">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={locationQuery}
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder="搜尋地點，例如：稻荷神社"
            className="pl-9"
          />
        </div>
      </FilterSectionCard>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">連線代購</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            代購目前正在當地，可以即時幫你購買商品
          </p>
          {!isLoading && (
            <p className="mt-1 text-sm text-muted-foreground">共 {total} 個連線</p>
          )}
        </div>

        <Sheet>
          <SheetTrigger
            render={<Button variant="outline" size="icon" className="md:hidden"><SlidersHorizontal className="h-4 w-4" /></Button>}
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

      <div className="flex items-start gap-6">
        <aside className="sticky top-24 hidden w-64 shrink-0 md:block">
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:#d4cfc9_transparent] [&::-webkit-scrollbar]:w-0.75 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d4cfc9]">
            {FilterContent()}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {activeFilterCount > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {regionLabel && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e8d9b8] bg-[#f0e9d8] px-3 py-1 text-xs font-medium text-[#8a6a2e]"
                  onClick={() => setRegionId('')}
                >
                  {regionLabel}
                  <X className="h-3 w-3" />
                </button>
              )}

              {activeDateLabel && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e8d9b8] bg-[#f0e9d8] px-3 py-1 text-xs font-medium text-[#8a6a2e]"
                  onClick={() => {
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e8d9b8] bg-[#f0e9d8] px-3 py-1 text-xs font-medium text-[#8a6a2e]"
                  onClick={() => setLocationQuery('')}
                >
                  地點：{locationText}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
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
              {hasNextPage && (
                <div className="mt-8 text-center">
                  <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? '載入中...' : '載入更多'}
                  </Button>
                </div>
              )}
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
  )
}

function FilterSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#e8e3dc] bg-white shadow-sm">
      <div className="border-b border-[#f0ede8] bg-[#faf9f7] px-3.5 py-[11px] text-sm font-semibold text-[#333]">
        {title}
      </div>
      <div className="flex flex-col gap-2 px-3.5 py-3">
        {children}
      </div>
    </section>
  )
}
