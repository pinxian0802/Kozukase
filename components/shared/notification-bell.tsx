'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSession } from '@/lib/context/session-context'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { getNotificationContent } from '@/components/shared/notification-content'

export function NotificationBell() {
  const session = useSession()
  const userId = session?.user?.id
  const utils = trpc.useUtils()
  const { data: countData } = trpc.notification.unreadCount.useQuery()
  const unreadCount = countData?.count ?? 0

  const { data: listData, isLoading } = trpc.notification.list.useQuery({ limit: 5 })
  const notifications = listData?.items ?? []

  useEffect(() => {
    if (!userId) return

    // 訂閱「只屬於我」的通知。比起聽整張 notifications 表、再靠 RLS 把別人的擋掉,
    // 加上 filter 後 Realtime 在 server 端就會把不相關的列短路掉,
    // 大幅減少每筆 INSERT 對每個訂閱者跑的權限比對。
    // 通道名也帶 userId,避免不同使用者共用同一個通道名造成奇怪行為。
    const supabase = createSupabaseBrowserClient()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          utils.notification.unreadCount.invalidate()
          utils.notification.list.invalidate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, utils])

  const markRead = trpc.notification.markRead.useMutation({
    // 樂觀更新:先把這一則在本地標成已讀、未讀數量 -1,畫面立刻反應;失敗就回滾。
    onMutate: async ({ id }) => {
      await Promise.all([
        utils.notification.list.cancel(),
        utils.notification.unreadCount.cancel(),
      ])
      const prevList = utils.notification.list.getData({ limit: 5 })
      const prevCount = utils.notification.unreadCount.getData()

      utils.notification.list.setData({ limit: 5 }, (old) =>
        old
          ? { ...old, items: old.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)) }
          : old
      )
      utils.notification.unreadCount.setData(undefined, (old) =>
        old ? { count: Math.max(0, old.count - 1) } : old
      )

      return { prevList, prevCount }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) utils.notification.list.setData({ limit: 5 }, ctx.prevList)
      if (ctx?.prevCount) utils.notification.unreadCount.setData(undefined, ctx.prevCount)
    },
    onSettled: () => {
      utils.notification.unreadCount.invalidate()
      utils.notification.list.invalidate()
    },
  })

  const markAllRead = trpc.notification.markAllRead.useMutation({
    // 樂觀更新:本地把全部標成已讀、未讀數量歸零;失敗就回滾。
    onMutate: async () => {
      await Promise.all([
        utils.notification.list.cancel(),
        utils.notification.unreadCount.cancel(),
      ])
      const prevList = utils.notification.list.getData({ limit: 5 })
      const prevCount = utils.notification.unreadCount.getData()

      utils.notification.list.setData({ limit: 5 }, (old) =>
        old ? { ...old, items: old.items.map((n) => ({ ...n, is_read: true })) } : old
      )
      utils.notification.unreadCount.setData(undefined, () => ({ count: 0 }))

      return { prevList, prevCount }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevList) utils.notification.list.setData({ limit: 5 }, ctx.prevList)
      if (ctx?.prevCount) utils.notification.unreadCount.setData(undefined, ctx.prevCount)
    },
    onSettled: () => {
      utils.notification.unreadCount.invalidate()
      utils.notification.list.invalidate()
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <span className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'relative' })}>
            <Bell className="h-7 w-7" />
            {unreadCount > 0 && (
              <Badge
                variant="default"
                className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-background bg-brand-500 text-cta-foreground"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </span>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-[380px] max-w-[calc(100vw-1rem)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold">通知</span>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-cta-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                markAllRead.mutate()
              }}
              disabled={markAllRead.isPending}
              className="text-xs font-medium text-brand-700 transition-colors hover:underline disabled:opacity-50"
            >
              全部已讀
            </button>
          )}
        </div>

        <div className="h-[22.5rem] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-1.5 px-2 pt-1.5 pb-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-2.5 py-3">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="flex flex-col gap-1.5 px-2 pt-1.5 pb-2.5">
              {notifications.map((n) => {
                const { title } = getNotificationContent(n.type, n.payload)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.is_read && markRead.mutate({ id: n.id })}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-3 text-left transition-colors',
                      n.is_read ? 'hover:bg-muted' : 'bg-brand-50 hover:bg-brand-100'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm leading-snug',
                          n.is_read ? 'text-muted-foreground' : 'font-semibold'
                        )}
                      >
                        {title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-muted-foreground">
              目前沒有通知
            </div>
          )}
        </div>

        <div className="p-2">
          <DropdownMenuItem
            render={<Link href="/notifications" />}
            className="cursor-pointer justify-center rounded-xl bg-brand-50 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 focus:bg-brand-100 focus:text-brand-700"
          >
            查看全部通知
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
