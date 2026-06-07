'use client'

import { useRouter } from 'next/navigation'
import { Heart, Plus } from 'lucide-react'
import { WishCard } from '@/components/buyer/wish-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'

export default function WishesPage() {
  const router = useRouter()
  const session = useSession()

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.wish.publicFeed.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const wishes = data?.pages.flatMap((p: any) => p.items) ?? []

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 md:px-4 md:py-6">
      <div className="mb-4 flex items-start justify-between gap-3 md:mb-8 md:gap-4">
        <div>
          <h1 className="text-base font-bold font-heading mb-1 md:text-2xl md:mb-2">許願榜</h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            大家最想代購的商品，一起許願讓更多賣家看見
          </p>
        </div>
        {session && (
          <Button onClick={() => router.push('/wishes/new')} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            新增許願
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : wishes.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {wishes.map((wish: any) => (
              <WishCard key={wish.id} wish={wish} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? '載入中...' : '載入更多'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={Heart} title="還沒有人許願" description="先去新增你想要的商品吧！" />
      )}
    </div>
  )
}
