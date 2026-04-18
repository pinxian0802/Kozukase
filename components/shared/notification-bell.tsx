'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function NotificationBell() {
  const utils = trpc.useUtils()
  const { data } = trpc.notification.unreadCount.useQuery()
  const unreadCount = data?.count ?? 0

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          utils.notification.unreadCount.invalidate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [utils])

  return (
    <Button variant="ghost" size="icon" render={<Link href="/notifications" />} className="relative">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
    </Button>
  )
}
