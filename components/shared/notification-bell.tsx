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
        <Bell className="h-7 w-7" />
        {unreadCount > 0 && (
          <Badge
            variant="default"
            className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-background bg-brand-500 text-cta-foreground"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
    </Button>
  )
}
