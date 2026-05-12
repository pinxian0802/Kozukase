'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'

export function MessageBell() {
  const { data } = trpc.message.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  })

  const count = data?.count ?? 0

  return (
    <Link
      href="/messages"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon' }),
        'relative'
      )}
    >
      <MessageSquare className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
