'use client'

import type { ReactNode } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { trpc } from '@/lib/trpc/client'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

const SUPPORT_EMAIL = 'support@kozukase.com'

function MailLink() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="text-brand-700 underline"
      onClick={(e) => e.stopPropagation()}
    >
      {SUPPORT_EMAIL}
    </a>
  )
}

// 由 type + payload 組出「標題 + 內文」。標題動態帶名稱；payload 無名稱（改動前的舊通知）時 fallback 成通用標題。
function getNotificationContent(
  type: string,
  payload: Record<string, unknown> | null,
): { title: string; body: ReactNode | null } {
  const p = payload ?? {}
  const productName = typeof p.product_name === 'string' ? p.product_name : null
  const connectionName = typeof p.connection_title === 'string' ? p.connection_title : null
  const reason =
    typeof p.admin_note === 'string' ? p.admin_note
    : typeof p.reason === 'string' ? p.reason
    : null
  const rating = typeof p.rating === 'number' ? p.rating : null

  switch (type) {
    case 'connection_removed_by_admin':
      return {
        title: connectionName ? `「${connectionName}」已被中止` : '代購連線已被中止',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}此代購連線已被中止。改善後可重新發佈，如有任何問題請來信 <MailLink />。
          </>
        ),
      }
    case 'connection_republish_approved':
      return {
        title: connectionName ? `「${connectionName}」已重新發佈` : '代購連線已重新發佈',
        body: '你的重新申請已通過審核，此代購連線已重新公開於平台。',
      }
    case 'listing_removed_by_admin':
      return {
        title: productName ? `「${productName}」代購已被下架` : '代購已被下架',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}此代購已被下架。修正後可至賣家後台重新送出審核，如有疑問請來信 <MailLink />。
          </>
        ),
      }
    case 'listing_republish_approved':
      return {
        title: productName ? `「${productName}」代購已重新上架` : '代購已重新上架',
        body: '你的重新上架申請已通過審核，代購已重新公開於平台。',
      }
    case 'product_removed':
      return {
        title: productName ? `「${productName}」已被移除，相關代購已下架` : '相關商品已被移除，代購已下架',
        body: `商品${productName ? `「${productName}」` : ''}已從平台移除，你針對此商品的代購已自動下架。可在編輯頁改選其他有效商品後重新送出審核。`,
      }
    case 'account_action_taken':
      return {
        title: '你的帳號已被停權',
        body: (
          <>
            {reason ? `因「${reason}」，` : ''}你的帳號已被停權，名下代購與連線已暫停。如有疑問請來信 <MailLink />。
          </>
        ),
      }
    case 'review_received':
      return {
        title: rating ? `你收到一則新評價（${rating} 星）` : '你收到一則新評價',
        body: rating
          ? `有買家給了你 ${rating} 星評價，點擊查看並回覆。`
          : '有買家給了你新評價，點擊查看並回覆。',
      }
    case 'review_liked':
      return {
        title: '你的評價被按讚',
        body: '有使用者覺得你的評價很有幫助。',
      }
    case 'review_replied':
      return {
        title: '賣家回覆了你的評價',
        body: '你評價過的賣家回覆了你，點擊查看。',
      }
    case 'new_listing_for_wish':
      return {
        title: productName ? `「${productName}」有新代購上架` : '許願商品有新上架',
        body: '你許願的商品有賣家新上架代購，快來看看。',
      }
    default:
      return { title: type, body: null }
  }
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
          {notifications.map((n: any) => {
            const { title, body } = getNotificationContent(n.type, n.payload)
            return (
            <div
              key={n.id}
              className={cn(
                'rounded-lg border p-4 transition-colors',
                !n.is_read && 'bg-brand-50 border-brand-300 cursor-pointer'
              )}
              onClick={() => !n.is_read && markRead.mutate({ id: n.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{title}</p>
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
        <EmptyState icon={Bell} title="沒有通知" description="有新動態時會在這裡通知你" />
      )}
    </div>
  )
}
