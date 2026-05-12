'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function MessageBell() {
  const session = useSession()
  const utils = trpc.useUtils()
  const { data } = trpc.message.unreadCount.useQuery()

  // Real-time: update bell count instantly when a new message arrives
  useEffect(() => {
    if (!session?.user?.id) return
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('bell-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as { sender_id: string }
          if (msg.sender_id !== session.user!.id) {
            utils.message.unreadCount.invalidate()
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

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
