'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
    onSuccess: () => {
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
      <DropdownMenuContent align="end" className="w-84 p-0">
        <div className="border-b px-4 py-3">
          <span className="text-[15px] font-semibold">通知</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">載入中…</div>
        ) : notifications.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => {
              const { title } = getNotificationContent(n.type, n.payload)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.is_read && markRead.mutate({ id: n.id })}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted',
                    !n.is_read && 'bg-brand-50'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-relaxed">{title}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
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
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">沒有通知</div>
        )}

        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem
          render={<Link href="/notifications" />}
          className="justify-center py-3 text-sm font-medium text-brand-700"
        >
          查看更多
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
