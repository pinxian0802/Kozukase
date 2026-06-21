'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatLastSeen } from '@/lib/utils/format'
import { format } from 'date-fns'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSession } from '@/lib/context/session-context'
import { toast } from 'sonner'
import { MessageBubble, DateSeparator } from './message-bubble'
import { MessageInput, type SendPayload } from './message-input'
import type { Message } from '@/server/db/types'

export type DisplayMessage = Message & {
  isOptimistic?: boolean
  localImageUrl?: string
  uploadProgress?: number
}

type Props = {
  conversationId: string
  otherName: string | null
  otherAvatar: string | null
  otherLastSeenAt: string | null
  otherPageUrl: string | null
  onBack?: () => void
  pendingContext?: {
    contextType?: 'listing' | 'connection'
    contextId?: string
    contextLabel?: string
  }
  pendingContextImage?: string
}

type ChatItem =
  | { kind: 'message'; data: DisplayMessage }
  | { kind: 'date'; date: string; id: string }

function buildChatItems(messages: DisplayMessage[]): ChatItem[] {
  const items: ChatItem[] = []
  let lastDate: string | null = null
  for (const msg of messages) {
    const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd')
    if (msgDate !== lastDate) {
      items.push({ kind: 'date', date: msgDate, id: `date-${msgDate}` })
      lastDate = msgDate
    }
    items.push({ kind: 'message', data: msg })
  }
  return items
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed: ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

export function ConversationPanel({ conversationId, otherName, otherAvatar, otherLastSeenAt, otherPageUrl, onBack, pendingContext, pendingContextImage }: Props) {
  const router = useRouter()
  const session = useSession()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const { data: history } = trpc.message.messages.useQuery(
    { conversation_id: conversationId },
    { enabled: !!conversationId, staleTime: 0 }
  )

  const utils = trpc.useUtils()
  const markRead = trpc.message.markRead.useMutation({
    onSuccess: () => {
      utils.message.list.invalidate()
      utils.message.unreadCount.invalidate()
    },
  })
  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation()
  const sendMutation = trpc.message.send.useMutation()

  useEffect(() => {
    if (history) {
      setMessages(history.messages)
      setHasMore(history.hasMore)
    }
  }, [history])

  // Track whether user is near the bottom (within 80px threshold)
  // With column-reverse, scrollTop=0 is the visual bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const onScroll = () => {
      isAtBottom.current = container.scrollTop < 80
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!conversationId) return

    markRead.mutate({ conversation_id: conversationId })

    // 訂閱對話私人廣播頻道。後端 message.send 寫入 DB 後會廣播 new_message。
    // 與舊的 postgres_changes 相比,訊息路由改由「頻道名稱」決定,
    // 不再對每筆 INSERT 跑全表的 RLS 比對。
    // 注意:private: true 是必要的,否則 realtime.messages 的權限規則不會套用。
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`conversation:${conversationId}`, { config: { private: true } })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMsg = payload.payload as Message
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        if (isAtBottom.current) scrollToBottom()
        if (newMsg.sender_id !== session?.user?.id) {
          markRead.mutate({ conversation_id: conversationId })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const scrollToBottom = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0
  }

  const handleSend = useCallback(async (payload: SendPayload) => {
    const tempId = `optimistic-${Date.now()}`
    const now = new Date().toISOString()

    const optimisticMsg: DisplayMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: session?.user?.id ?? '',
      body: payload.body ?? null,
      image_url: null,
      context_type: payload.contextType ?? null,
      context_id: payload.contextId ?? null,
      context_label: payload.contextLabel ?? null,
      context_image_url: payload.contextImage ?? null,
      created_at: now,
      isOptimistic: true,
      localImageUrl: payload.localPreviewUrl,
      uploadProgress: payload.file ? 0 : undefined,
    }

    setMessages(prev => [...prev, optimisticMsg])
    scrollToBottom()
    setIsSending(true)

    try {
      let imageUrl: string | undefined

      if (payload.file) {
        const { presignedUrl, publicUrl } = await getPresignedUrl.mutateAsync({
          purpose: 'message',
          contentType: payload.file.type,
          fileSize: payload.file.size,
        })

        await uploadWithProgress(presignedUrl, payload.file, payload.file.type, (p) => {
          setMessages(prev =>
            prev.map(m => m.id === tempId ? { ...m, uploadProgress: p } : m)
          )
        })

        imageUrl = publicUrl
      }

      const realMsg = await sendMutation.mutateAsync({
        conversation_id: conversationId,
        body: payload.body || undefined,
        image_url: imageUrl,
        context_type: payload.contextType,
        context_id: payload.contextId,
        context_label: payload.contextLabel,
        context_image_url: payload.contextImage,
      })

      // Replace the optimistic placeholder with the real message.
      // Also filter out any copy already added by the Realtime broadcast (which can
      // arrive before sendMutation resolves), preventing a duplicate-key render error.
      setMessages(prev => {
        const localImageUrl = prev.find(m => m.id === tempId)?.localImageUrl
        return prev
          .filter(m => m.id !== realMsg.id)
          .map(m => m.id === tempId ? { ...realMsg, isOptimistic: false, localImageUrl } : m)
      })

      // Non-blocking: once R2 image is in browser cache, swap to it and free the blob
      if (realMsg.image_url && payload.localPreviewUrl) {
        const blobUrl = payload.localPreviewUrl
        const realId = realMsg.id
        const img = new Image()
        const onSettled = () => {
          setMessages(prev => prev.map(m => m.id === realId ? { ...m, localImageUrl: undefined } : m))
          URL.revokeObjectURL(blobUrl)
        }
        img.onload = onSettled
        img.onerror = onSettled
        img.src = realMsg.image_url
      } else if (payload.localPreviewUrl) {
        URL.revokeObjectURL(payload.localPreviewUrl)
      }

      utils.message.list.invalidate()
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      toast.error(err?.message ?? '傳送失敗')
    } finally {
      setIsSending(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session?.user?.id])

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return
    setIsLoadingMore(true)
    try {
      const oldest = messages[0]?.created_at
      const result = await utils.message.messages.fetch({
        conversation_id: conversationId,
        before: oldest,
      })
      setMessages(prev => [...result.messages, ...prev])
      setHasMore(result.hasMore)
    } catch {
      toast.error('載入更多訊息失敗')
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <section style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-page)', overflow: 'hidden' }}>
      {/* Chat Header */}
      <div
        className="h-[52px] md:h-[68px] px-2 md:px-5 gap-2 md:gap-3.5"
        style={{
          borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-card)',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            aria-label="返回"
            className="md:hidden"
            style={{
              width: 38, height: 38, marginLeft: -4, borderRadius: 8, border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: 'var(--text-strong)', flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 22, height: 22 }} />
          </button>
        )}
        <div
          onClick={() => otherPageUrl && router.push(otherPageUrl)}
          className="gap-2.5 md:gap-3.5"
          style={{
            display: 'flex', alignItems: 'center', flex: 1, minWidth: 0,
            cursor: otherPageUrl ? 'pointer' : 'default',
            borderRadius: 8, padding: '4px 6px', margin: '-4px -6px',
            transition: 'background .12s',
          }}
          onMouseEnter={e => { if (otherPageUrl) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-muted)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          <Avatar className="h-[34px] w-[34px] md:h-10 md:w-10 shrink-0">
            <AvatarImage src={otherAvatar ?? undefined} />
            <AvatarFallback style={{ background: 'linear-gradient(135deg, #2d3a5e, #0f1a36)', color: 'var(--surface-card)', fontFamily: 'Rubik, sans-serif', fontWeight: 700 }}>
              {otherName?.[0] ?? '?'}
            </AvatarFallback>
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-[14px] md:text-[15px]" style={{ fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {otherName ?? '對話'}
            </div>
            {(() => {
              const lastSeenText = formatLastSeen(otherLastSeenAt)
              return lastSeenText ? (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>
                  {lastSeenText}
                </div>
              ) : null
            })()}
          </div>
        </div>
      </div>

      {/* Messages — column-reverse keeps scrollTop=0 at visual bottom, images loading never push viewport up */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column-reverse', padding: '12px 0' }}>
        {[...buildChatItems(messages)].reverse().map((item, i, arr) => {
          if (item.kind === 'date') {
            return <DateSeparator key={item.id} date={item.date} />
          }
          const prevItem = arr[i + 1]
          const prevMsg = prevItem?.kind === 'message' ? prevItem.data : null
          return (
            <MessageBubble
              key={item.data.id}
              message={item.data}
              isOwn={item.data.sender_id === session?.user?.id}
              prevMessage={prevMsg}
              localImageUrl={item.data.localImageUrl}
              uploadProgress={item.data.uploadProgress}
            />
          )
        })}
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              style={{
                height: 30, padding: '0 16px', borderRadius: 999,
                border: '1px solid var(--border-soft)', background: 'var(--surface-card)',
                fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
                cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {isLoadingMore ? (
                <>
                  <span style={{ width: 12, height: 12, border: '2px solid var(--border-strong)', borderTopColor: 'var(--text-muted)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  載入中…
                </>
              ) : '載入更多訊息'}
            </button>
          </div>
        )}
      </div>

      <MessageInput
        onSend={handleSend}
        isSending={isSending}
        contextType={pendingContext?.contextType}
        contextId={pendingContext?.contextId}
        contextLabel={pendingContext?.contextLabel}
        contextImage={pendingContextImage}
      />
    </section>
  )
}

