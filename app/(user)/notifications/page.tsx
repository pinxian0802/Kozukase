'use client'

import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { getNotificationContent } from '@/components/shared/notification-content'

export default function NotificationsPage() {
  const utils = trpc.useUtils()
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.notification.list.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage: any) => lastPage.nextCursor }
    )

  const markRead = trpc.notification.markRead.useMutation({
    // 樂觀更新:點下去先把這一則在本地標成已讀、鈴鐺未讀數量 -1;失敗回滾。
    onMutate: async ({ id }) => {
      await Promise.all([
        utils.notification.list.cancel(),
        utils.notification.unreadCount.cancel(),
      ])
      const prevList = utils.notification.list.getInfiniteData({ limit: 20 })
      const prevCount = utils.notification.unreadCount.getData()

      utils.notification.list.setInfiniteData({ limit: 20 }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
              })),
            }
          : old
      )
      utils.notification.unreadCount.setData(undefined, (old) =>
        old ? { count: Math.max(0, old.count - 1) } : old
      )

      return { prevList, prevCount }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) utils.notification.list.setInfiniteData({ limit: 20 }, ctx.prevList)
      if (ctx?.prevCount) utils.notification.unreadCount.setData(undefined, ctx.prevCount)
    },
    onSettled: () => {
      utils.notification.list.invalidate()
      utils.notification.unreadCount.invalidate()
    },
  })
  const markAllRead = trpc.notification.markAllRead.useMutation({
    // 樂觀更新:本地把全部標成已讀、未讀數量歸零;失敗回滾。
    onMutate: async () => {
      await Promise.all([
        utils.notification.list.cancel(),
        utils.notification.unreadCount.cancel(),
      ])
      const prevList = utils.notification.list.getInfiniteData({ limit: 20 })
      const prevCount = utils.notification.unreadCount.getData()

      utils.notification.list.setInfiniteData({ limit: 20 }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => ({ ...n, is_read: true })),
              })),
            }
          : old
      )
      utils.notification.unreadCount.setData(undefined, () => ({ count: 0 }))

      return { prevList, prevCount }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) utils.notification.list.setInfiniteData({ limit: 20 }, ctx.prevList)
      if (ctx?.prevCount) utils.notification.unreadCount.setData(undefined, ctx.prevCount)
    },
    onSettled: () => {
      utils.notification.list.invalidate()
      utils.notification.unreadCount.invalidate()
    },
  })

  const notifications = data?.pages.flatMap((p: any) => p.items) ?? []

  return (
    <div className="mx-auto max-w-2xl px-3 py-3 md:px-4 md:py-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-base font-bold font-heading md:text-2xl">通知</h1>
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
          {notifications.map((n: any) => {
            const { title, body } = getNotificationContent(n.type, n.payload)
            return (
            <div
              key={n.id}
              className={cn(
                'rounded-xl p-3 transition-colors md:p-4',
                n.is_read
                  ? 'border border-border-soft'
                  : 'bg-brand-50 cursor-pointer hover:bg-brand-100'
              )}
              onClick={() => !n.is_read && markRead.mutate({ id: n.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={cn('text-sm', n.is_read ? 'font-medium text-muted-foreground' : 'font-semibold')}>
                    {title}
                  </p>
                  {body && (
                    <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="h-2 w-2 rounded-full bg-brand-500 shrink-0 self-center" />
                )}
              </div>
            </div>
            )
          })}
          {hasNextPage && (
            <div className="pt-4 text-center">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? '載入中...' : '載入更多'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState icon="notification" title="沒有通知" description="有新動態時會在這裡通知你" />
      )}
    </div>
  )
}
