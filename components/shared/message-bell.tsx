'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'

/**
 * 訊息鈴鐺(未讀數)。
 *
 * 此元件只負責顯示 `message.unreadCount` 的查詢結果。
 * 真正的「有新訊息要刷新」訊號由 Header 內的 <UserChannelListener />
 * 訂閱 user:<myId> 廣播頻道收到後,統一 invalidate。
 */
export function MessageBell() {
  const { data } = trpc.message.unreadCount.useQuery()
  const count = data?.count ?? 0

  return (
    <Link
      href="/messages"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon' }),
        'relative'
      )}
    >
      <MessageSquare className="h-7 w-7" />
      {count > 0 && (
        <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-background bg-brand-500 text-cta-foreground">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
