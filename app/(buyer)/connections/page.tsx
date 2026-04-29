'use client'

import { useState } from 'react'
import { Globe, Search } from 'lucide-react'
import { ConnectionCard } from '@/components/connection/connection-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'

export default function ConnectionsPage() {
  const [locationQuery, setLocationQuery] = useState('')
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.connection.browse.useInfiniteQuery(
      { limit: 20, location_query: locationQuery.trim() || undefined },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const connections = data?.pages.flatMap((p: any) => p.items) ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold font-heading mb-6">連線代購</h1>
      <p className="text-muted-foreground mb-8">
        代購目前正在當地，可以即時幫你購買商品
      </p>

      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={locationQuery}
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder="搜尋地點，例如：稻荷神社"
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : connections.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <EmptyState icon={Globe} title="目前沒有進行中的連線代購" />
      )}
    </div>
  )
}
