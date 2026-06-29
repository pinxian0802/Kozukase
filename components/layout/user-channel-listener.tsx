'use client'

import { useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useSession } from '@/lib/context/session-context'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

/**
 * 共用的「個人信箱」訂閱器。
 *
 * 訂閱當前登入者的 user:<myId> 私人廣播頻道,
 * 收到 `messages_changed` 事件時就讓鈴鐺/列表的 tRPC query 重新拉資料。
 *
 * 此元件本身不 render UI,只負責「在每個登入頁面背景掛一條訂閱」。
 * 掛在 Header 內,藉由 Header 在所有登入後 layout 都有,等於整站涵蓋。
 *
 * 為什麼集中在這:
 * - MessageBell 與 ConversationList 都需要在「有新訊息」時 invalidate,
 *   各自訂一次會浪費連線/事件量,集中後整個瀏覽器只佔一條頻道。
 *
 * 重要:必須用 { config: { private: true } },否則 Realtime Authorization
 * 不會生效,等於任何人都能訂任何人的個人信箱。
 */
export function UserChannelListener() {
  const session = useSession()
  const utils = trpc.useUtils()
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return

    // private 頻道授權靠 RLS(auth.uid());訂閱前必須先把使用者 JWT 交給 Realtime
    // (realtime.setAuth),否則以匿名身分被擋(CHANNEL_ERROR: Unauthorized)收不到廣播。
    const supabase = createSupabaseBrowserClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      await supabase.realtime.setAuth(data.session?.access_token)
      if (cancelled) return
      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'messages_changed' }, () => {
          utils.message.unreadCount.invalidate()
          utils.message.list.invalidate()
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId, utils])

  return null
}
