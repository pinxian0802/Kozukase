'use client'

import { Bell, Check, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

const notificationLabels: Record<string, string> = {
  review_received: '收到新評價',
  review_liked: '你的評價被按讚',
  listing_removed_by_admin: '商品上架已被管理員下架',
  listing_republish_approved: '商品重新上架已通過審核',
  connection_removed_by_admin: '連線代購已被管理員結束',
  connection_republish_approved: '連線代購重新上線已通過審核',
  product_removed: '相關商品已被移除',
  product_removed_creator: '你新增的商品已被移除',
  account_action_taken: '帳號通知',
  new_listing_for_wish: '許願商品有新上架',
  followed_seller_new_listing: '追蹤的代購有新上架',
  wish_product_removed: '許願商品已被移除',
  bookmarked_product_removed: '收藏商品已被移除',
}

export default function NotificationsPage() {
  const utils = trpc.useUtils()
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.notification.list.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  })
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate()
      utils.notification.unreadCount.invalidate()
    },
  })

  const notifications = data?.pages.flatMap((p: any) => p.items) ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-heading">通知</h1>
        <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          <CheckCheck className="mr-1 h-4 w-4" />全部已讀
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className={cn(
                'rounded-lg border p-4 transition-colors',
                !n.is_read && 'bg-primary/5 border-primary/20'
              )}
              onClick={() => !n.is_read && markRead.mutate({ id: n.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {notificationLabels[n.type] ?? n.type}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </div>
            </div>
          ))}
          {hasNextPage && (
            <div className="pt-4 text-center">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? '載入中...' : '載入更多'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon={Bell} title="沒有通知" description="有新動態時會在這裡通知你" />
      )}
    </div>
  )
}
